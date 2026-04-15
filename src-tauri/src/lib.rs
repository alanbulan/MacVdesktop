mod apple_smc;
mod helper_manager;
mod llm_runtime;
mod runtime_settings;
mod telemetry;

use runtime_settings::RuntimeSettingsInput;
use std::sync::Mutex;
use telemetry::{get_telemetry_snapshot, TelemetryCollectorState};

#[tauri::command]
fn get_privileged_helper_status() -> telemetry::PrivilegedHelperStatus {
    helper_manager::helper_status()
}

#[tauri::command]
fn start_privileged_helper() -> Result<telemetry::PrivilegedHelperStatus, String> {
    helper_manager::start_privileged_helper()
}

#[tauri::command]
fn stop_privileged_helper() -> Result<telemetry::PrivilegedHelperStatus, String> {
    helper_manager::stop_privileged_helper()
}

#[tauri::command]
fn get_llm_runtime_state(app: tauri::AppHandle) -> Result<llm_runtime::LlmRuntimeState, String> {
    llm_runtime::runtime_state(&app)
}

#[tauri::command]
fn refresh_llm_runtime_state(app: tauri::AppHandle) -> Result<llm_runtime::LlmRuntimeState, String> {
    llm_runtime::refresh_runtime_state(&app)
}

#[tauri::command]
fn save_llm_runtime_config(
    app: tauri::AppHandle,
    settings: RuntimeSettingsInput,
) -> Result<llm_runtime::LlmRuntimeState, String> {
    llm_runtime::save_runtime_config(&app, settings)
}

#[tauri::command]
fn start_llm_runtime(app: tauri::AppHandle) -> Result<llm_runtime::LlmRuntimeState, String> {
    llm_runtime::start_runtime(&app)
}

#[tauri::command]
fn stop_llm_runtime(app: tauri::AppHandle) -> Result<llm_runtime::LlmRuntimeState, String> {
    llm_runtime::stop_runtime(&app)
}

#[tauri::command]
fn pull_llm_model(app: tauri::AppHandle) -> Result<llm_runtime::LlmRuntimeState, String> {
    llm_runtime::pull_model(&app)
}

#[tauri::command]
fn run_llm_smoke_test(app: tauri::AppHandle) -> Result<llm_runtime::SmokeTestResult, String> {
    llm_runtime::run_smoke_test(&app)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(TelemetryCollectorState::default()))
        .invoke_handler(tauri::generate_handler![
            get_telemetry_snapshot,
            get_privileged_helper_status,
            start_privileged_helper,
            stop_privileged_helper,
            get_llm_runtime_state,
            refresh_llm_runtime_state,
            save_llm_runtime_config,
            start_llm_runtime,
            stop_llm_runtime,
            pull_llm_model,
            run_llm_smoke_test
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
