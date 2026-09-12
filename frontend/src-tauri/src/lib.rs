use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use std::ptr;
use windows::core::{PCWSTR, PWSTR};
use windows::Win32::Foundation::HANDLE;
use windows::Win32::Graphics::Printing::{
    ClosePrinter, EndDocPrinter, EndPagePrinter, OpenPrinterW, StartDocPrinterW, StartPagePrinter,
    WritePrinter, DOC_INFO_1W,
};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

/// Open Windows built-in on-screen keyboard (Touch Keyboard / OSK).
#[tauri::command]
fn open_onscreen_keyboard() -> Result<(), String> {
    let tabtip = r"C:\Program Files\Common Files\microsoft shared\ink\TabTip.exe";
    if std::path::Path::new(tabtip).exists() {
        std::process::Command::new(tabtip)
            .spawn()
            .map_err(|e| format!("Failed to open Touch Keyboard: {e}"))?;
        return Ok(());
    }

    std::process::Command::new("osk.exe")
        .spawn()
        .map_err(|e| format!("Failed to open On-Screen Keyboard: {e}"))?;
    Ok(())
}

/// List installed Windows printers via PowerShell
#[tauri::command]
fn list_printers() -> Result<Vec<String>, String> {
    let output = std::process::Command::new("powershell")
        .args(&[
            "-NoProfile",
            "-Command",
            "Get-Printer | Select-Object -ExpandProperty Name",
        ])
        .output()
        .map_err(|e| e.to_string())?;

    let text = String::from_utf8_lossy(&output.stdout);
    let mut printers = Vec::new();
    for line in text.lines() {
        let name = line.trim();
        if !name.is_empty() {
            printers.push(name.to_string());
        }
    }
    Ok(printers)
}

/// Send raw ESC/POS bytes directly to a Windows printer via the Spooler RAW datatype.
/// No print dialog, no preview — bytes go directly to the printer head.
#[tauri::command]
fn print_raw_bytes(printer_name: String, data: Vec<u8>) -> Result<bool, String> {
    unsafe {
        let printer_name_wide: Vec<u16> = OsStr::new(&printer_name)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let mut h_printer: HANDLE = HANDLE::default();

        let ok = OpenPrinterW(
            PCWSTR(printer_name_wide.as_ptr()),
            &mut h_printer,
            Some(ptr::null_mut()),
        );

        if ok.is_err() || h_printer.is_invalid() {
            return Err(format!(
                "Failed to open printer '{}'. Make sure it is installed in Windows Settings \u{2192} Printers & Scanners.",
                printer_name
            ));
        }

        let doc_name: Vec<u16> = OsStr::new("POS Receipt")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let datatype: Vec<u16> = OsStr::new("RAW")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let doc_info = DOC_INFO_1W {
            pDocName: PWSTR(doc_name.as_ptr() as *mut _),
            pOutputFile: PWSTR(ptr::null_mut()),
            pDatatype: PWSTR(datatype.as_ptr() as *mut _),
        };

        let job_id = StartDocPrinterW(h_printer, 1, &doc_info as *const _);
        if job_id == 0 {
            let _ = ClosePrinter(h_printer);
            return Err("Failed to start print job in spooler".into());
        }

        if StartPagePrinter(h_printer).0 == 0 {
            let _ = EndDocPrinter(h_printer);
            let _ = ClosePrinter(h_printer);
            return Err("Failed to start printer page".into());
        }

        let mut bytes_written: u32 = 0;
        let write_ok = WritePrinter(
            h_printer,
            data.as_ptr() as *const _,
            data.len() as u32,
            &mut bytes_written,
        );

        if write_ok.0 == 0 {
            let _ = EndPagePrinter(h_printer);
            let _ = EndDocPrinter(h_printer);
            let _ = ClosePrinter(h_printer);
            return Err("Failed to write bytes to spooler".into());
        }

        let _ = EndPagePrinter(h_printer);
        let _ = EndDocPrinter(h_printer);
        let _ = ClosePrinter(h_printer);

        Ok(true)
    }
}

use std::sync::{Arc, Mutex};

fn kill_port_or_orphan_backend() {
    #[cfg(target_os = "windows")]
    {
        // 1. Force kill any existing backend processes by name
        let _ = std::process::Command::new("taskkill")
            .args(&["/F", "/IM", "backend.exe", "/T"])
            .output();
        let _ = std::process::Command::new("taskkill")
            .args(&["/F", "/IM", "backend-x86_64-pc-windows-msvc.exe", "/T"])
            .output();

        // 2. Kill whatever process is occupying port 5000 using netstat/cmd for instant execution
        let script = r#"
            $conn = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
            if ($conn) {
                $pids = $conn | Select-Object -ExpandProperty OwningProcess -Unique
                foreach ($p in $pids) {
                    if ($p -gt 0) {
                        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
                    }
                }
            }
        "#;
        let _ = std::process::Command::new("powershell")
            .args(&["-NoProfile", "-NonInteractive", "-Command", script])
            .output();

        // Allow Windows socket stack a brief moment to free the port completely
        std::thread::sleep(std::time::Duration::from_millis(200));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Clean up any stale backend instances from previous runs before launching
    kill_port_or_orphan_backend();

    let child_handle: Arc<Mutex<Option<tauri_plugin_shell::process::CommandChild>>> =
        Arc::new(Mutex::new(None));
    let child_handle_cleanup = Arc::clone(&child_handle);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(move |app| {
            // Spawn the backend sidecar.
            // 1. Try Tauri's official sidecar API
            let spawned = match app.shell().sidecar("bin/backend") {
                Ok(cmd) => cmd.spawn(),
                Err(_) => match app.shell().sidecar("backend") {
                    Ok(cmd) => cmd.spawn(),
                    Err(e) => Err(e),
                },
            };

            match spawned {
                Ok((mut rx, child)) => {
                    println!("[Backend] Sidecar spawned successfully (PID: {})", child.pid());
                    
                    if let Ok(mut lock) = child_handle.lock() {
                        *lock = Some(child);
                    }

                    tauri::async_runtime::spawn(async move {
                        while let Some(event) = rx.recv().await {
                            match event {
                                CommandEvent::Stdout(line) => {
                                    print!("[Backend] {}", String::from_utf8_lossy(&line));
                                }
                                CommandEvent::Stderr(line) => {
                                    eprint!("[Backend ERR] {}", String::from_utf8_lossy(&line));
                                }
                                CommandEvent::Terminated(payload) => {
                                    println!(
                                        "[Backend] Process terminated with code: {:?}",
                                        payload.code
                                    );
                                    break;
                                }
                                _ => {}
                            }
                        }
                    });
                }
                Err(e) => {
                    eprintln!("[Backend] Tauri sidecar API failed ({}), trying direct path spawn...", e);
                    
                    // 2. Direct path resolution (works in production installer & dev)
                    let mut candidate_paths = vec![
                        std::path::PathBuf::from("src-tauri/bin/backend-x86_64-pc-windows-msvc.exe"),
                        std::path::PathBuf::from("bin/backend-x86_64-pc-windows-msvc.exe"),
                        std::path::PathBuf::from("backend-x86_64-pc-windows-msvc.exe"),
                    ];

                    if let Ok(current_exe) = std::env::current_exe() {
                        if let Some(exe_dir) = current_exe.parent() {
                            candidate_paths.push(exe_dir.join("bin/backend-x86_64-pc-windows-msvc.exe"));
                            candidate_paths.push(exe_dir.join("backend-x86_64-pc-windows-msvc.exe"));
                            candidate_paths.push(exe_dir.join("backend.exe"));
                            candidate_paths.push(exe_dir.join("bin/backend.exe"));
                        }
                    }

                    let mut fallback_started = false;
                    for path in &candidate_paths {
                        if path.exists() {
                            println!("[Backend] Direct spawning from: {:?}", path);
                            if let Ok(mut child) = std::process::Command::new(path).spawn() {
                                println!("[Backend] Direct backend process spawned (PID: {})", child.id());
                                fallback_started = true;
                                std::thread::spawn(move || {
                                    let _ = child.wait();
                                });
                                break;
                            }
                        }
                    }

                    if !fallback_started {
                        eprintln!("[Backend] Could not find or launch backend executable in any candidate path!");
                    }
                }
            }

            Ok(())
        })
        .on_window_event(move |_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Ok(mut lock) = child_handle_cleanup.lock() {
                    if let Some(child) = lock.take() {
                        let _ = child.kill();
                    }
                }
                kill_port_or_orphan_backend();
            }
        })
        .invoke_handler(tauri::generate_handler![
            list_printers,
            print_raw_bytes,
            open_onscreen_keyboard
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit = event {
                kill_port_or_orphan_backend();
            }
        });
}
