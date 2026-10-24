use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use std::ptr;
use std::sync::{Arc, Mutex};
use windows::core::{PCWSTR, PWSTR};
use windows::Win32::Foundation::HANDLE;
use windows::Win32::Graphics::Printing::{
    ClosePrinter, EndDocPrinter, EndPagePrinter, EnumPrintersW, OpenPrinterW, StartDocPrinterW,
    StartPagePrinter, WritePrinter, DOC_INFO_1W, PRINTER_ENUM_CONNECTIONS, PRINTER_ENUM_LOCAL,
    PRINTER_INFO_1W,
};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use tauri::Manager;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Open Windows built-in on-screen keyboard (Touch Keyboard / OSK).
#[tauri::command]
fn open_onscreen_keyboard() -> Result<(), String> {
    let tabtip = r"C:\Program Files\Common Files\microsoft shared\ink\TabTip.exe";
    if std::path::Path::new(tabtip).exists() {
        let mut cmd = std::process::Command::new(tabtip);
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.spawn()
            .map_err(|e| format!("Failed to open Touch Keyboard: {e}"))?;
        return Ok(());
    }

    let mut cmd = std::process::Command::new("osk.exe");
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd.spawn()
        .map_err(|e| format!("Failed to open On-Screen Keyboard: {e}"))?;
    Ok(())
}


/// List installed Windows printers via native Win32 EnumPrintersW API (~1ms vs ~3500ms PowerShell)
#[tauri::command]
fn list_printers() -> Result<Vec<String>, String> {
    unsafe {
        let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
        let mut bytes_needed: u32 = 0;
        let mut count: u32 = 0;

        // First call to determine buffer size needed (Level 1 returns PRINTER_INFO_1W)
        let _ = EnumPrintersW(
            flags,
            PCWSTR::null(),
            1,
            None,
            &mut bytes_needed,
            &mut count,
        );

        if bytes_needed == 0 {
            return Ok(Vec::new());
        }

        let mut buffer: Vec<u8> = vec![0u8; bytes_needed as usize];
        let result = EnumPrintersW(
            flags,
            PCWSTR::null(),
            1,
            Some(buffer.as_mut_slice()),
            &mut bytes_needed,
            &mut count,
        );

        if result.is_ok() && count > 0 {
            let p_info = buffer.as_ptr() as *const PRINTER_INFO_1W;
            let mut printers = Vec::with_capacity(count as usize);

            for i in 0..count as usize {
                let info = &*p_info.add(i);
                if !info.pName.is_null() {
                    let mut len = 0;
                    while *info.pName.0.add(len) != 0 {
                        len += 1;
                    }
                    let slice = std::slice::from_raw_parts(info.pName.0, len);
                    let name = String::from_utf16_lossy(slice).trim().to_string();
                    if !name.is_empty() && !printers.contains(&name) {
                        printers.push(name);
                    }
                }
            }

            return Ok(printers);
        }

        Ok(Vec::new())
    }
}

/// Send raw ESC/POS bytes directly to a Windows printer via the Spooler RAW datatype.
/// Executed on a dedicated background thread so Windows Spooler I/O can NEVER block Tauri webview UI thread.
#[tauri::command]
async fn print_raw_bytes(printer_name: String, data: Vec<u8>) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        print_raw_bytes_blocking(printer_name, data)
    })
    .await
    .map_err(|e| format!("Print thread failed: {e}"))?
}

fn print_raw_bytes_blocking(printer_name: String, data: Vec<u8>) -> Result<bool, String> {
    unsafe {
        let mut target_printer = printer_name.trim().to_string();
        if target_printer.is_empty() {
            if let Ok(printers) = list_printers() {
                if let Some(first) = printers.first() {
                    target_printer = first.clone();
                }
            }
        }

        let printer_name_wide: Vec<u16> = OsStr::new(&target_printer)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let mut h_printer: HANDLE = HANDLE::default();

        let mut ok = OpenPrinterW(
            PCWSTR(printer_name_wide.as_ptr()),
            &mut h_printer,
            Some(ptr::null_mut()),
        );

        // If specific printer failed to open, try to find an alternative active printer
        if (ok.is_err() || h_printer.is_invalid()) && !target_printer.is_empty() {
            if let Ok(printers) = list_printers() {
                for alt in printers {
                    if alt != target_printer {
                        let alt_wide: Vec<u16> = OsStr::new(&alt)
                            .encode_wide()
                            .chain(std::iter::once(0))
                            .collect();
                        let mut alt_h: HANDLE = HANDLE::default();
                        let alt_ok = OpenPrinterW(
                            PCWSTR(alt_wide.as_ptr()),
                            &mut alt_h,
                            Some(ptr::null_mut()),
                        );
                        if alt_ok.is_ok() && !alt_h.is_invalid() {
                            h_printer = alt_h;
                            ok = alt_ok;
                            break;
                        }
                    }
                }
            }
        }

        if ok.is_err() || h_printer.is_invalid() {
            return Err(format!(
                "Failed to open printer '{}'. Make sure it is installed and turned on in Windows Settings -> Printers & Scanners.",
                target_printer
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

fn kill_port_or_orphan_backend() {
    #[cfg(target_os = "windows")]
    {
        // 1. Force kill any existing backend processes by name silently
        let mut cmd1 = std::process::Command::new("taskkill");
        cmd1.creation_flags(CREATE_NO_WINDOW);
        let _ = cmd1.args(&["/F", "/IM", "backend.exe", "/T"]).output();

        let mut cmd2 = std::process::Command::new("taskkill");
        cmd2.creation_flags(CREATE_NO_WINDOW);
        let _ = cmd2
            .args(&["/F", "/IM", "backend-x86_64-pc-windows-msvc.exe", "/T"])
            .output();

        // 2. Kill whatever process is occupying port 5000 using netstat/powershell silently
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
        let mut ps_cmd = std::process::Command::new("powershell");
        ps_cmd.creation_flags(CREATE_NO_WINDOW);
        let _ = ps_cmd
            .args(&["-NoProfile", "-NonInteractive", "-Command", script])
            .output();

        // Allow Windows socket stack a brief moment to free the port completely
        std::thread::sleep(std::time::Duration::from_millis(200));
    }
}

mod pos_sale;
use pos_sale::{clear_pending_journal, recover_pending_journal, save_pos_sale, write_pending_journal};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Clean up any stale backend instances from previous runs before launching
    kill_port_or_orphan_backend();

    let child_handle: Arc<Mutex<Option<std::process::Child>>> = Arc::new(Mutex::new(None));
    let child_handle_window = Arc::clone(&child_handle);
    let child_handle_exit = Arc::clone(&child_handle);

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = app
                .get_webview_window("main")
                .expect("no main window")
                .set_focus();
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(move |_app| {
            // Find backend binary candidate paths
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
                    // In release bundle, resources may be alongside exe or up one dir
                    if let Some(parent) = exe_dir.parent() {
                        candidate_paths.push(parent.join("bin/backend-x86_64-pc-windows-msvc.exe"));
                    }
                }
            }

            let mut started = false;
            for path in &candidate_paths {
                if path.exists() {
                    println!("[Backend] Spawning backend silently from: {:?}", path);
                    let mut cmd = std::process::Command::new(path);
                    #[cfg(target_os = "windows")]
                    cmd.creation_flags(CREATE_NO_WINDOW);

                    cmd.stdout(std::process::Stdio::piped());
                    cmd.stderr(std::process::Stdio::piped());

                    match cmd.spawn() {
                        Ok(mut child) => {
                            println!("[Backend] Background process started (PID: {})", child.id());

                            let stdout = child.stdout.take();
                            let stderr = child.stderr.take();

                            if let Some(out) = stdout {
                                std::thread::spawn(move || {
                                    use std::io::{BufRead, BufReader};
                                    let reader = BufReader::new(out);
                                    for line in reader.lines() {
                                        if let Ok(l) = line {
                                            println!("[Backend] {}", l);
                                        }
                                    }
                                });
                            }

                            if let Some(err) = stderr {
                                std::thread::spawn(move || {
                                    use std::io::{BufRead, BufReader};
                                    let reader = BufReader::new(err);
                                    for line in reader.lines() {
                                        if let Ok(l) = line {
                                            eprintln!("[Backend ERR] {}", l);
                                        }
                                    }
                                });
                            }

                            if let Ok(mut lock) = child_handle.lock() {
                                *lock = Some(child);
                            }
                            started = true;
                            break;
                        }
                        Err(e) => {
                            eprintln!("[Backend] Failed to spawn {:?}: {}", path, e);
                        }
                    }
                }
            }

            if !started {
                eprintln!("[Backend] Could not find backend binary in any candidate path. If running in pure dev without compiled sidecar, please start backend manually.");
            }

            Ok(())
        })
        .on_window_event(move |_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Ok(mut lock) = child_handle_window.lock() {
                    if let Some(mut child) = lock.take() {
                        let _ = child.kill();
                    }
                }
                kill_port_or_orphan_backend();
            }
        })
        .invoke_handler(tauri::generate_handler![
            list_printers,
            print_raw_bytes,
            open_onscreen_keyboard,
            save_pos_sale,
            write_pending_journal,
            clear_pending_journal,
            recover_pending_journal
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit = event {
                if let Ok(mut lock) = child_handle_exit.lock() {
                    if let Some(mut child) = lock.take() {
                        let _ = child.kill();
                    }
                }
                kill_port_or_orphan_backend();
            }
        });
}
