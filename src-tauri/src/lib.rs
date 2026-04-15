mod apple_smc;
mod telemetry;

use std::sync::Mutex;
use telemetry::{
    get_privileged_helper_status, get_telemetry_snapshot, start_privileged_helper,
    stop_privileged_helper, TelemetryCollectorState,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(TelemetryCollectorState::default()))
        .invoke_handler(tauri::generate_handler![
            get_telemetry_snapshot,
            get_privileged_helper_status,
            start_privileged_helper,
            stop_privileged_helper
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
