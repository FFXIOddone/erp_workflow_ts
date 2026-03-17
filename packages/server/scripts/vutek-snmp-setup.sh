#!/bin/bash
# ============================================================
# VUTEk GS3250LX Pro — Enable SNMP for Ink Level Monitoring
# Target: 192.168.254.60 (Ubuntu)
# Purpose: Install/enable snmpd so ERP can read ink levels
# 
# TEMPORARY — Remove this script after ink data is confirmed
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "=========================================="
echo "  VUTEk SNMP Setup — Wilde Signs ERP"
echo "=========================================="
echo ""

# Must run as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}ERROR: This script must be run as root.${NC}"
  echo "  Run:  sudo bash vutek-snmp-setup.sh"
  exit 1
fi

# ---- Step 1: Install snmpd if missing ----
echo -e "${YELLOW}[1/5] Checking for snmpd...${NC}"
if command -v snmpd &>/dev/null; then
  echo -e "${GREEN}  snmpd is already installed.${NC}"
else
  echo "  Installing snmp and snmpd..."

  # Detect Ubuntu version
  UBUNTU_VER=$(lsb_release -rs 2>/dev/null || cat /etc/lsb-release 2>/dev/null | grep DISTRIB_RELEASE | cut -d= -f2 || echo "unknown")
  echo "  Detected Ubuntu version: $UBUNTU_VER"

  # On older Ubuntu (14.04, 12.04), repos may be moved to old-releases
  if grep -q "archive.ubuntu.com\|security.ubuntu.com" /etc/apt/sources.list 2>/dev/null; then
    # Check if current repos actually work
    if ! apt-get update -qq 2>/dev/null; then
      echo -e "${YELLOW}  Standard repos failed. Switching to old-releases.ubuntu.com...${NC}"
      cp /etc/apt/sources.list /etc/apt/sources.list.bak.$(date +%Y%m%d%H%M%S)
      sed -i 's|archive.ubuntu.com|old-releases.ubuntu.com|g' /etc/apt/sources.list
      sed -i 's|security.ubuntu.com|old-releases.ubuntu.com|g' /etc/apt/sources.list
      apt-get update -qq
    fi
  else
    apt-get update -qq 2>/dev/null || true
  fi

  # Enable universe repo (snmpd is often in universe on older Ubuntu)
  if command -v add-apt-repository &>/dev/null; then
    add-apt-repository -y universe 2>/dev/null || true
    apt-get update -qq 2>/dev/null || true
  else
    # Manually add universe if add-apt-repository isn't available
    if ! grep -q "universe" /etc/apt/sources.list 2>/dev/null; then
      CODENAME=$(lsb_release -cs 2>/dev/null || echo "trusty")
      echo "deb http://old-releases.ubuntu.com/ubuntu/ $CODENAME universe" >> /etc/apt/sources.list
      apt-get update -qq 2>/dev/null || true
    fi
  fi

  # Try installing snmpd — multiple fallback approaches
  if apt-get install -y snmpd snmp 2>/dev/null; then
    echo -e "${GREEN}  snmpd installed successfully.${NC}"
  elif apt-get install -y snmpd 2>/dev/null; then
    echo -e "${GREEN}  snmpd installed (without snmp client).${NC}"
  else
    echo -e "${YELLOW}  apt-get install failed. Trying to find snmpd .deb on this system...${NC}"

    # Check if snmpd binary exists somewhere already (pre-installed but not in PATH)
    FOUND_SNMPD=$(find / -name "snmpd" -type f 2>/dev/null | head -1)
    if [ -n "$FOUND_SNMPD" ]; then
      echo -e "${GREEN}  Found snmpd at: $FOUND_SNMPD${NC}"
      # Make sure it's executable and in PATH
      chmod +x "$FOUND_SNMPD"
      ln -sf "$FOUND_SNMPD" /usr/sbin/snmpd 2>/dev/null || true
    else
      # Last resort: try downloading the .deb from the flash drive
      SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
      if ls "$SCRIPT_DIR"/snmpd*.deb 1>/dev/null 2>&1; then
        echo "  Found .deb files on flash drive, installing..."
        dpkg -i "$SCRIPT_DIR"/snmpd*.deb
        dpkg -i "$SCRIPT_DIR"/libsnmp*.deb 2>/dev/null || true
        apt-get install -f -y 2>/dev/null || true
      else
        echo -e "${RED}  FAILED: Could not install snmpd.${NC}"
        echo ""
        echo "  Manual fix options:"
        echo "    1. Download snmpd .deb for your Ubuntu version from:"
        echo "       https://packages.ubuntu.com/search?keywords=snmpd"
        echo "    2. Copy it to this flash drive and re-run the script"
        echo "    3. Or install from another machine with internet:"
        echo "       apt-get download snmpd snmp libsnmp-base"
        echo "       Then copy the .deb files here and run: dpkg -i *.deb"
        echo ""
        exit 1
      fi
    fi
  fi
fi

# ---- Step 2: Backup existing config ----
echo -e "${YELLOW}[2/5] Backing up snmpd.conf...${NC}"
CONF="/etc/snmp/snmpd.conf"
if [ -f "$CONF" ]; then
  cp "$CONF" "${CONF}.bak.$(date +%Y%m%d%H%M%S)"
  echo -e "${GREEN}  Backup saved.${NC}"
else
  echo "  No existing config to back up."
fi

# ---- Step 3: Write snmpd config ----
echo -e "${YELLOW}[3/5] Configuring snmpd...${NC}"
cat > "$CONF" << 'SNMPCONF'
# VUTEk SNMP config — Wilde Signs ERP monitoring
# Read-only access from local subnet (192.168.254.0/24)

# Listen on all interfaces, UDP 161
agentAddress udp:161

# Read-only community string for our subnet
rocommunity public 192.168.254.0/24

# System info
sysLocation    "Wilde Signs — Production Floor"
sysContact     "jake@wildesigns.com"
sysServices    72

# Expose full Printer-MIB tree (OID 1.3.6.1.2.1.43)
view all included .1
rouser noAuthUser noauth -V all
SNMPCONF

echo -e "${GREEN}  snmpd.conf written.${NC}"

# ---- Step 4: Open firewall for UDP 161 ----
echo -e "${YELLOW}[4/5] Opening firewall for SNMP (UDP 161)...${NC}"
if command -v ufw &>/dev/null; then
  ufw allow from 192.168.254.0/24 to any port 161 proto udp comment "ERP SNMP monitoring"
  echo -e "${GREEN}  UFW rule added.${NC}"
elif command -v iptables &>/dev/null; then
  # Check if rule already exists
  if ! iptables -C INPUT -p udp -s 192.168.254.0/24 --dport 161 -j ACCEPT 2>/dev/null; then
    iptables -I INPUT 1 -p udp -s 192.168.254.0/24 --dport 161 -j ACCEPT
    echo -e "${GREEN}  iptables rule added.${NC}"
    # Persist the rule
    if command -v netfilter-persistent &>/dev/null; then
      netfilter-persistent save
    elif [ -f /etc/iptables/rules.v4 ]; then
      iptables-save > /etc/iptables/rules.v4
    fi
  else
    echo -e "${GREEN}  iptables rule already exists.${NC}"
  fi
else
  echo -e "${YELLOW}  WARNING: No firewall manager found (ufw/iptables). Port may already be open.${NC}"
fi

# ---- Step 5: Enable and start snmpd ----
echo -e "${YELLOW}[5/5] Starting snmpd service...${NC}"
systemctl enable snmpd
systemctl restart snmpd

# Verify it's running
if systemctl is-active --quiet snmpd; then
  echo -e "${GREEN}  snmpd is running.${NC}"
else
  echo -e "${RED}  ERROR: snmpd failed to start. Check: journalctl -u snmpd${NC}"
  exit 1
fi

# ---- Verify SNMP responds ----
echo ""
echo -e "${YELLOW}Verifying SNMP responds locally...${NC}"
if command -v snmpget &>/dev/null; then
  RESULT=$(snmpget -v2c -c public localhost 1.3.6.1.2.1.1.1.0 2>&1) || true
  if echo "$RESULT" | grep -qi "string\|iso\|snmpv2"; then
    echo -e "${GREEN}  SNMP is responding!${NC}"
  else
    echo -e "${YELLOW}  SNMP responded but output was unexpected:${NC}"
    echo "  $RESULT"
  fi
else
  echo -e "${YELLOW}  snmpget not available for local test. Test from ERP server instead.${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}  SETUP COMPLETE${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. From the ERP server (or any PC on 192.168.254.x), run:"
echo "     snmpwalk -v2c -c public 192.168.254.60 1.3.6.1.2.1.43.11"
echo ""
echo "  2. If ink OIDs return data, we're good — the ERP will auto-detect them."
echo ""
echo "  3. Once ink levels are confirmed in the ERP, delete this script."
echo ""
