//! Serial port communication module
//!
//! For equipment that communicates via serial ports
//! (scales, label printers, barcode scanners, etc.)

use std::time::Duration;
use serialport::{SerialPort, SerialPortInfo};
use crate::{Result, CoreError};

/// List available serial ports
pub fn list_ports() -> Result<Vec<PortInfo>> {
    let ports = serialport::available_ports()
        .map_err(|e| CoreError::Serial(e))?;
    
    Ok(ports.into_iter().map(|p| PortInfo {
        name: p.port_name.clone(),
        port_type: format!("{:?}", p.port_type),
    }).collect())
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct PortInfo {
    pub name: String,
    pub port_type: String,
}

/// Serial port connection wrapper
pub struct SerialConnection {
    port: Box<dyn SerialPort>,
    name: String,
}

impl SerialConnection {
    /// Open a serial port
    pub fn open(port_name: &str, baud_rate: u32) -> Result<Self> {
        let port = serialport::new(port_name, baud_rate)
            .timeout(Duration::from_millis(500))
            .open()
            .map_err(|e| CoreError::Serial(e))?;
        
        Ok(Self {
            port,
            name: port_name.to_string(),
        })
    }

    /// Read data from the port
    pub fn read(&mut self) -> Result<Vec<u8>> {
        let mut buffer = vec![0u8; 1024];
        let bytes_read = self.port.read(&mut buffer)?;
        buffer.truncate(bytes_read);
        Ok(buffer)
    }

    /// Read a line (until newline)
    pub fn read_line(&mut self) -> Result<String> {
        let mut result = Vec::new();
        let mut byte = [0u8; 1];
        
        loop {
            match self.port.read(&mut byte) {
                Ok(1) => {
                    if byte[0] == b'\n' {
                        break;
                    }
                    result.push(byte[0]);
                }
                Ok(_) => break,
                Err(e) if e.kind() == std::io::ErrorKind::TimedOut => break,
                Err(e) => return Err(e.into()),
            }
        }
        
        Ok(String::from_utf8_lossy(&result).trim().to_string())
    }

    /// Write data to the port
    pub fn write(&mut self, data: &[u8]) -> Result<usize> {
        let written = self.port.write(data)?;
        self.port.flush()?;
        Ok(written)
    }

    /// Write a string with newline
    pub fn write_line(&mut self, line: &str) -> Result<usize> {
        let data = format!("{}\r\n", line);
        self.write(data.as_bytes())
    }

    /// Get port name
    pub fn name(&self) -> &str {
        &self.name
    }
}

/// Scale reader (for shipping scales)
pub struct ScaleReader {
    conn: SerialConnection,
    scale_type: ScaleType,
}

#[derive(Debug, Clone, Copy)]
pub enum ScaleType {
    Generic,    // Send weight on request
    Continuous, // Continuously sends weight
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ScaleReading {
    pub weight: f64,
    pub unit: WeightUnit,
    pub stable: bool,
}

#[derive(Debug, Clone, Copy, serde::Serialize)]
pub enum WeightUnit {
    Pounds,
    Ounces,
    Kilograms,
    Grams,
}

impl ScaleReader {
    pub fn new(port_name: &str, baud_rate: u32, scale_type: ScaleType) -> Result<Self> {
        let conn = SerialConnection::open(port_name, baud_rate)?;
        Ok(Self { conn, scale_type })
    }

    /// Request weight from scale
    pub fn read_weight(&mut self) -> Result<Option<ScaleReading>> {
        // Send weight request command (common format)
        self.conn.write(b"W\r\n")?;
        
        // Read response
        let response = self.conn.read_line()?;
        
        if response.is_empty() {
            return Ok(None);
        }
        
        // Parse weight (format varies by scale, this is generic)
        // Typical format: "  12.5 lb" or "ST,GS,  12.50, lb"
        self.parse_weight_response(&response)
    }

    fn parse_weight_response(&self, response: &str) -> Result<Option<ScaleReading>> {
        // Try to extract numeric value and unit
        let parts: Vec<&str> = response.split_whitespace().collect();
        
        for (i, part) in parts.iter().enumerate() {
            if let Ok(weight) = part.parse::<f64>() {
                let unit = parts.get(i + 1).map(|u| match u.to_lowercase().as_str() {
                    "lb" | "lbs" => WeightUnit::Pounds,
                    "oz" => WeightUnit::Ounces,
                    "kg" => WeightUnit::Kilograms,
                    "g" => WeightUnit::Grams,
                    _ => WeightUnit::Pounds,
                }).unwrap_or(WeightUnit::Pounds);
                
                let stable = !response.contains("?") && !response.contains("M");
                
                return Ok(Some(ScaleReading { weight, unit, stable }));
            }
        }
        
        Ok(None)
    }
}

/// Label printer (Zebra ZPL)
pub struct LabelPrinter {
    conn: SerialConnection,
}

impl LabelPrinter {
    pub fn new(port_name: &str) -> Result<Self> {
        let conn = SerialConnection::open(port_name, 9600)?;
        Ok(Self { conn })
    }

    /// Print a ZPL label
    pub fn print_zpl(&mut self, zpl: &str) -> Result<()> {
        self.conn.write(zpl.as_bytes())?;
        Ok(())
    }

    /// Print a simple text label
    pub fn print_text(&mut self, lines: &[&str], barcode: Option<&str>) -> Result<()> {
        let mut zpl = String::from("^XA\n");
        
        // Add text lines
        let mut y = 50;
        for line in lines {
            zpl.push_str(&format!("^FO50,{}^A0N,30,30^FD{}^FS\n", y, line));
            y += 40;
        }
        
        // Add barcode if provided
        if let Some(code) = barcode {
            zpl.push_str(&format!("^FO50,{}^BY2^BCN,100,Y,N,N^FD{}^FS\n", y, code));
        }
        
        zpl.push_str("^XZ\n");
        
        self.print_zpl(&zpl)
    }
}
