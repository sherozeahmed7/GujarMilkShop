use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use std::ptr;
use windows::core::{PCWSTR, PWSTR};
use windows::Win32::Foundation::HANDLE;
use windows::Win32::Graphics::Printing::{
    ClosePrinter, EndDocPrinter, EndPagePrinter, OpenPrinterW, StartDocPrinterW, StartPagePrinter,
    WritePrinter, DOC_INFO_1W,
};

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
                "Failed to open printer '{}'. Make sure it is installed in Windows Settings → Printers & Scanners.",
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![list_printers, print_raw_bytes])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
