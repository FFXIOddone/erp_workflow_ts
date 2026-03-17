// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Write crash info to a log file if the app panics
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let msg = format!("Shop Floor PANIC: {}", info);
        // Try to write to a log file next to the executable
        if let Ok(exe) = std::env::current_exe() {
            let log_path = exe.with_file_name("crash.log");
            let _ = std::fs::write(&log_path, &msg);
        }
        // Also try AppData
        if let Some(appdata) = std::env::var_os("APPDATA") {
            let dir = std::path::PathBuf::from(appdata).join("Wilde Signs Shop Floor");
            let _ = std::fs::create_dir_all(&dir);
            let _ = std::fs::write(dir.join("crash.log"), &msg);
        }
        default_hook(info);
    }));

    shop_floor::run()
}
