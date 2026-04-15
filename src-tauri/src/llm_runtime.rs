use crate::runtime_settings::{
    load_runtime_settings, save_runtime_settings, RuntimeProfile, RuntimeSelection, RuntimeSettings,
    RuntimeSettingsInput, SmokeTestRecord, SmokeTestStatus,
};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::AppHandle;

const OLLAMA_BINARY: &str = "/opt/homebrew/opt/ollama/bin/ollama";
const OLLAMA_DEFAULT_MODEL: &str = "qwen3.5:4b-q4_K_M";
const OLLAMA_DEFAULT_KEEP_ALIVE: &str = "5m";
const OLLAMA_DEFAULT_CONTEXT_LENGTH: u32 = 4096;
const LLAMA_CPP_DEFAULT_ENDPOINT: &str = "http://127.0.0.1:8080";
const SMOKE_TEST_PROMPT: &str = "请只回答：已连接";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeInstallationStatus {
    Missing,
    Installed,
    Running,
    Unhealthy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeProbeModel {
    pub id: String,
    pub size_label: Option<String>,
    pub digest: Option<String>,
    pub modified_at: Option<String>,
    pub family: Option<String>,
    pub parameter_size: Option<String>,
    pub quantization: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeProbeRunningModel {
    pub id: String,
    pub size_label: Option<String>,
    pub processor: Option<String>,
    pub until: Option<String>,
    pub context_length: Option<u32>,
    pub quantization: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmRuntimeState {
    pub runtime_kind: RuntimeSelection,
    pub installation_status: RuntimeInstallationStatus,
    pub runtime_label: String,
    pub version: Option<String>,
    pub endpoint: String,
    pub openai_base_url: String,
    pub lan_openai_base_url: Option<String>,
    pub lan_native_base_url: Option<String>,
    pub api_key_hint: String,
    pub active_model_id: Option<String>,
    pub preferred_model_id: Option<String>,
    pub profile: RuntimeProfile,
    pub model_family: Option<String>,
    pub model_class: String,
    pub quantization: Option<String>,
    pub context_length: u32,
    pub keep_alive: String,
    pub threads: Option<u32>,
    pub gpu_offload: String,
    pub managed_by_app: bool,
    pub available_models: Vec<RuntimeProbeModel>,
    pub running_models: Vec<RuntimeProbeRunningModel>,
    pub warnings: Vec<String>,
    pub last_error: Option<String>,
    pub last_smoke_test: SmokeTestRecord,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmokeTestResult {
    pub status: SmokeTestStatus,
    pub latency_ms: Option<u64>,
    pub updated_at: String,
    pub preview: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OllamaVersionResponse {
    version: String,
}

#[derive(Debug, Deserialize)]
struct OllamaTagsResponse {
    models: Vec<OllamaTagModel>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
struct OllamaTagModel {
    name: String,
    size: Option<u64>,
    digest: Option<String>,
    modified_at: Option<String>,
    details: Option<OllamaModelDetails>,
}

#[derive(Debug, Deserialize)]
struct OllamaPsResponse {
    models: Vec<OllamaPsModel>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
struct OllamaPsModel {
    name: String,
    size: Option<u64>,
    expires_at: Option<String>,
    details: Option<OllamaPsDetails>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
struct OllamaPsDetails {
    format: Option<String>,
    quantization_level: Option<String>,
    num_ctx: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
struct OllamaModelDetails {
    family: Option<String>,
    parameter_size: Option<String>,
    quantization_level: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OllamaGenerateRequest<'a> {
    model: &'a str,
    prompt: &'a str,
    stream: bool,
    keep_alive: &'a str,
    options: OllamaGenerateOptions,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OllamaGenerateOptions {
    num_ctx: u32,
}

#[derive(Debug, Deserialize)]
struct OllamaGenerateResponse {
    response: String,
}

fn timestamp() -> String {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::from_secs(0));

    duration.as_secs().to_string()
}

fn format_size(bytes: u64) -> String {
    const GIB: f64 = 1024.0 * 1024.0 * 1024.0;
    const MIB: f64 = 1024.0 * 1024.0;

    if bytes as f64 >= GIB {
        format!("{:.1} GiB", bytes as f64 / GIB)
    } else {
        format!("{:.0} MiB", bytes as f64 / MIB)
    }
}

fn profile_label(profile: &RuntimeProfile) -> String {
    match profile {
        RuntimeProfile::Utility => "utility".to_string(),
        RuntimeProfile::Default => "default".to_string(),
        RuntimeProfile::Quality => "quality".to_string(),
    }
}

fn gpu_offload_label(settings: &RuntimeSettings) -> String {
    match settings.gpu_offload {
        crate::runtime_settings::GpuOffloadMode::Auto => "auto".to_string(),
        crate::runtime_settings::GpuOffloadMode::Metal => "metal".to_string(),
        crate::runtime_settings::GpuOffloadMode::Disabled => "disabled".to_string(),
    }
}

fn runtime_label(selection: &RuntimeSelection) -> String {
    match selection {
        RuntimeSelection::Ollama => "Ollama".to_string(),
        RuntimeSelection::LlamaCpp => "llama.cpp".to_string(),
    }
}

fn http_client() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_read(Duration::from_secs(60))
        .timeout_write(Duration::from_secs(60))
        .timeout_connect(Duration::from_secs(5))
        .build()
}

fn command_output(command: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new(command)
        .args(args)
        .output()
        .map_err(|error| format!("无法执行命令 {command}：{error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            format!("命令 {command} 执行失败。")
        } else {
            stderr
        });
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn ollama_installed() -> bool {
    Path::new(OLLAMA_BINARY).exists()
}

fn normalize_endpoint(settings: &RuntimeSettings) -> String {
    if settings.endpoint.trim().is_empty() {
        return match settings.selected_runtime {
            RuntimeSelection::Ollama => "http://127.0.0.1:11434".to_string(),
            RuntimeSelection::LlamaCpp => LLAMA_CPP_DEFAULT_ENDPOINT.to_string(),
        };
    }

    settings.endpoint.trim().trim_end_matches('/').to_string()
}

fn lan_host_ip() -> Option<String> {
    let output = Command::new("/bin/sh")
        .args(["-c", "ipconfig getifaddr en0 || ipconfig getifaddr en1"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let ip = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if ip.is_empty() {
        None
    } else {
        Some(ip)
    }
}

fn openai_base_url(endpoint: &str) -> String {
    format!("{}/v1", endpoint.trim_end_matches('/'))
}

fn detect_default_model_id(settings: &RuntimeSettings) -> String {
    settings
        .preferred_model_id
        .clone()
        .unwrap_or_else(|| OLLAMA_DEFAULT_MODEL.to_string())
}

fn probe_ollama_version(endpoint: &str) -> Result<String, String> {
    let response = http_client()
        .get(&format!("{endpoint}/api/version"))
        .call()
        .map_err(|error| format!("无法连接 Ollama 版本接口：{error}"))?;

    let parsed: OllamaVersionResponse = response
        .into_json()
        .map_err(|error| format!("无法解析 Ollama 版本响应：{error}"))?;

    Ok(parsed.version)
}

fn probe_ollama_models(endpoint: &str) -> Result<Vec<RuntimeProbeModel>, String> {
    let response = http_client()
        .get(&format!("{endpoint}/api/tags"))
        .call()
        .map_err(|error| format!("无法读取 Ollama 模型列表：{error}"))?;

    let parsed: OllamaTagsResponse = response
        .into_json()
        .map_err(|error| format!("无法解析 Ollama 模型列表：{error}"))?;

    Ok(parsed
        .models
        .into_iter()
        .map(|model| RuntimeProbeModel {
            id: model.name,
            size_label: model.size.map(format_size),
            digest: model.digest,
            modified_at: model.modified_at,
            family: model.details.as_ref().and_then(|details| details.family.clone()),
            parameter_size: model
                .details
                .as_ref()
                .and_then(|details| details.parameter_size.clone()),
            quantization: model
                .details
                .as_ref()
                .and_then(|details| details.quantization_level.clone()),
        })
        .collect())
}

fn probe_ollama_running_models(endpoint: &str) -> Result<Vec<RuntimeProbeRunningModel>, String> {
    let response = http_client()
        .get(&format!("{endpoint}/api/ps"))
        .call()
        .map_err(|error| format!("无法读取 Ollama 运行模型列表：{error}"))?;

    let parsed: OllamaPsResponse = response
        .into_json()
        .map_err(|error| format!("无法解析 Ollama 运行模型列表：{error}"))?;

    Ok(parsed
        .models
        .into_iter()
        .map(|model| RuntimeProbeRunningModel {
            id: model.name,
            size_label: model.size.map(format_size),
            processor: model.details.as_ref().and_then(|details| details.format.clone()),
            until: model.expires_at,
            context_length: model.details.as_ref().and_then(|details| details.num_ctx),
            quantization: model
                .details
                .as_ref()
                .and_then(|details| details.quantization_level.clone()),
        })
        .collect())
}

fn build_ollama_state(settings: RuntimeSettings) -> LlmRuntimeState {
    let endpoint = normalize_endpoint(&settings);
    let openai_base_url = openai_base_url(&endpoint);
    let lan_ip = lan_host_ip();
    let lan_native_base_url = lan_ip
        .as_ref()
        .map(|ip| format!("http://{ip}:11434"));
    let lan_openai_base_url = lan_ip
        .as_ref()
        .map(|ip| format!("http://{ip}:11434/v1"));
    let api_key_hint = "sk-local-ollama（占位；当前服务默认不校验）".to_string();
    let preferred_model_id = detect_default_model_id(&settings);
    let profile = settings.selected_profile;
    let model_class = profile_label(&profile);
    let gpu_offload = gpu_offload_label(&settings);
    let context_length = settings.context_length;
    let keep_alive = settings.keep_alive.clone();
    let threads = settings.threads;
    let last_smoke_test = settings.last_smoke_test.clone();
    let mut warnings = Vec::new();
    let mut last_error = None;

    if !ollama_installed() {
        return LlmRuntimeState {
            runtime_kind: RuntimeSelection::Ollama,
            installation_status: RuntimeInstallationStatus::Missing,
            runtime_label: runtime_label(&RuntimeSelection::Ollama),
            version: None,
            endpoint,
            openai_base_url: openai_base_url.clone(),
            lan_openai_base_url: lan_openai_base_url.clone(),
            lan_native_base_url: lan_native_base_url.clone(),
            api_key_hint: api_key_hint.clone(),
            active_model_id: None,
            preferred_model_id: Some(preferred_model_id),
            profile,
            model_family: None,
            model_class,
            quantization: None,
            context_length,
            keep_alive,
            threads,
            gpu_offload,
            managed_by_app: false,
            available_models: vec![],
            running_models: vec![],
            warnings: vec!["当前机器尚未安装 Ollama。".to_string()],
            last_error: None,
            last_smoke_test,
        };
    }

    let version = match probe_ollama_version(&endpoint) {
        Ok(version) => Some(version),
        Err(error) => {
            last_error = Some(error.clone());
            return LlmRuntimeState {
                runtime_kind: RuntimeSelection::Ollama,
                installation_status: RuntimeInstallationStatus::Installed,
                runtime_label: runtime_label(&RuntimeSelection::Ollama),
                version: None,
                endpoint,
                openai_base_url: openai_base_url.clone(),
                lan_openai_base_url: lan_openai_base_url.clone(),
                lan_native_base_url: lan_native_base_url.clone(),
                api_key_hint: api_key_hint.clone(),
                active_model_id: None,
                preferred_model_id: Some(preferred_model_id),
                profile,
                model_family: None,
                model_class,
                quantization: None,
                context_length,
                keep_alive,
                threads,
                gpu_offload,
                managed_by_app: false,
                available_models: vec![],
                running_models: vec![],
                warnings: vec!["Ollama 已安装，但本地服务当前不可达。".to_string()],
                last_error,
                last_smoke_test,
            };
        }
    };

    let available_models = match probe_ollama_models(&endpoint) {
        Ok(models) => models,
        Err(error) => {
            last_error = Some(error);
            vec![]
        }
    };

    let running_models = match probe_ollama_running_models(&endpoint) {
        Ok(models) => models,
        Err(error) => {
            warnings.push("无法读取正在运行的 Ollama 模型列表。".to_string());
            last_error = Some(error);
            vec![]
        }
    };

    let active_model_id = running_models.first().map(|model| model.id.clone());
    let preferred_model = available_models
        .iter()
        .find(|model| model.id == preferred_model_id)
        .or_else(|| available_models.first());

    if !available_models.iter().any(|model| model.id == preferred_model_id) {
        warnings.push(format!("默认模型 {} 还没有拉取到本机。", preferred_model_id));
    }

    if context_length > OLLAMA_DEFAULT_CONTEXT_LENGTH {
        warnings.push("当前 context length 高于默认值，16GB 机器上可能更容易触发内存压力。".to_string());
    }

    LlmRuntimeState {
        runtime_kind: RuntimeSelection::Ollama,
        installation_status: if running_models.is_empty() {
            RuntimeInstallationStatus::Installed
        } else {
            RuntimeInstallationStatus::Running
        },
        runtime_label: runtime_label(&RuntimeSelection::Ollama),
        version,
        endpoint,
        openai_base_url,
        lan_openai_base_url,
        lan_native_base_url,
        api_key_hint,
        active_model_id,
        preferred_model_id: Some(preferred_model_id),
        profile,
        model_family: preferred_model.and_then(|model| model.family.clone()),
        model_class,
        quantization: preferred_model.and_then(|model| model.quantization.clone()),
        context_length,
        keep_alive,
        threads,
        gpu_offload,
        managed_by_app: false,
        available_models,
        running_models,
        warnings,
        last_error,
        last_smoke_test,
    }
}

fn build_llama_cpp_state(settings: RuntimeSettings) -> LlmRuntimeState {
    let endpoint = normalize_endpoint(&settings);
    let openai_base_url_value = openai_base_url(&endpoint);
    let lan_ip = lan_host_ip();
    let lan_openai_base_url = lan_ip.as_ref().map(|ip| format!("http://{ip}:8080/v1"));
    let lan_native_base_url = lan_ip.as_ref().map(|ip| format!("http://{ip}:8080"));
    let profile = settings.selected_profile;
    let model_class = profile_label(&profile);
    let gpu_offload = gpu_offload_label(&settings);
    let context_length = settings.context_length;
    let keep_alive = settings.keep_alive;
    let threads = settings.threads;
    let last_smoke_test = settings.last_smoke_test;
    let mut warnings = vec!["llama.cpp fallback 已预留，但当前首版优先接入 Ollama。".to_string()];

    if settings.local_model_path.is_none() {
        warnings.push("尚未配置本地 GGUF 模型路径。".to_string());
    }

    LlmRuntimeState {
        runtime_kind: RuntimeSelection::LlamaCpp,
        installation_status: RuntimeInstallationStatus::Missing,
        runtime_label: runtime_label(&RuntimeSelection::LlamaCpp),
        version: None,
        endpoint,
        openai_base_url: openai_base_url_value,
        lan_openai_base_url,
        lan_native_base_url,
        api_key_hint: "首版仅给出占位说明；llama.cpp fallback 尚未启用鉴权。".to_string(),
        active_model_id: None,
        preferred_model_id: settings.preferred_model_id,
        profile,
        model_family: None,
        model_class,
        quantization: None,
        context_length,
        keep_alive,
        threads,
        gpu_offload,
        managed_by_app: true,
        available_models: vec![],
        running_models: vec![],
        warnings,
        last_error: None,
        last_smoke_test,
    }
}

pub fn runtime_state(app: &AppHandle) -> Result<LlmRuntimeState, String> {
    let settings = load_runtime_settings(app)?;

    Ok(match settings.selected_runtime {
        RuntimeSelection::Ollama => build_ollama_state(settings),
        RuntimeSelection::LlamaCpp => build_llama_cpp_state(settings),
    })
}

pub fn refresh_runtime_state(app: &AppHandle) -> Result<LlmRuntimeState, String> {
    runtime_state(app)
}

pub fn save_runtime_config(app: &AppHandle, input: RuntimeSettingsInput) -> Result<LlmRuntimeState, String> {
    let existing_settings = load_runtime_settings(app)?;
    let settings = RuntimeSettings::from_input(input, existing_settings.last_smoke_test);
    save_runtime_settings(app, &settings)?;
    runtime_state(app)
}

pub fn start_runtime(app: &AppHandle) -> Result<LlmRuntimeState, String> {
    let settings = load_runtime_settings(app)?;

    match settings.selected_runtime {
        RuntimeSelection::Ollama => {
            if !ollama_installed() {
                return Err("当前机器还未安装 Ollama。".to_string());
            }

            let output = Command::new(OLLAMA_BINARY)
                .arg("serve")
                .env("OLLAMA_FLASH_ATTENTION", "1")
                .env("OLLAMA_KV_CACHE_TYPE", "q8_0")
                .spawn()
                .map_err(|error| format!("无法启动 Ollama：{error}"))?;

            let _ = output.id();
            std::thread::sleep(Duration::from_secs(2));
            runtime_state(app)
        }
        RuntimeSelection::LlamaCpp => Err("首版暂未实现 llama.cpp 自动启动，请先继续使用 Ollama 主线。".to_string()),
    }
}

pub fn stop_runtime(app: &AppHandle) -> Result<LlmRuntimeState, String> {
    let settings = load_runtime_settings(app)?;

    match settings.selected_runtime {
        RuntimeSelection::Ollama => {
            let _ = Command::new("pkill")
                .args(["-f", "ollama serve|ollama runner --ollama-engine"])
                .status();
            std::thread::sleep(Duration::from_secs(1));
            runtime_state(app)
        }
        RuntimeSelection::LlamaCpp => Err("首版暂未实现 llama.cpp 自动停止。".to_string()),
    }
}

pub fn pull_model(app: &AppHandle) -> Result<LlmRuntimeState, String> {
    let settings = load_runtime_settings(app)?;

    if !matches!(settings.selected_runtime, RuntimeSelection::Ollama) {
        return Err("首版仅支持通过 Ollama 拉取模型。".to_string());
    }

    if !ollama_installed() {
        return Err("当前机器还未安装 Ollama。".to_string());
    }

    let model_id = detect_default_model_id(&settings);
    command_output(OLLAMA_BINARY, &["pull", &model_id])?;
    runtime_state(app)
}

pub fn run_smoke_test(app: &AppHandle) -> Result<SmokeTestResult, String> {
    let mut settings = load_runtime_settings(app)?;
    let endpoint = normalize_endpoint(&settings);
    let model_id = detect_default_model_id(&settings);

    if !matches!(settings.selected_runtime, RuntimeSelection::Ollama) {
        return Err("首版 smoke test 仅支持 Ollama。".to_string());
    }

    let started_at = Instant::now();
    let response = http_client()
        .post(&format!("{endpoint}/api/generate"))
        .send_json(OllamaGenerateRequest {
            model: &model_id,
            prompt: SMOKE_TEST_PROMPT,
            stream: false,
            keep_alive: if settings.keep_alive.trim().is_empty() {
                OLLAMA_DEFAULT_KEEP_ALIVE
            } else {
                settings.keep_alive.as_str()
            },
            options: OllamaGenerateOptions {
                num_ctx: if settings.context_length == 0 {
                    OLLAMA_DEFAULT_CONTEXT_LENGTH
                } else {
                    settings.context_length
                },
            },
        })
        .map_err(|error| format!("LLM smoke test 请求失败：{error}"))?;

    let parsed: OllamaGenerateResponse = response
        .into_json()
        .map_err(|error| format!("无法解析 LLM smoke test 响应：{error}"))?;

    let result = SmokeTestResult {
        status: SmokeTestStatus::Passed,
        latency_ms: Some(started_at.elapsed().as_millis() as u64),
        updated_at: timestamp(),
        preview: Some(parsed.response.trim().to_string()),
        error: None,
    };

    settings.last_smoke_test = SmokeTestRecord {
        status: result.status.clone(),
        latency_ms: result.latency_ms,
        updated_at: Some(result.updated_at.clone()),
        preview: result.preview.clone(),
        error: None,
    };

    save_runtime_settings(app, &settings)?;

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::{format_size, profile_label};
    use crate::runtime_settings::RuntimeProfile;

    #[test]
    fn formats_sizes_for_small_and_large_models() {
        assert_eq!(format_size(512 * 1024 * 1024), "512 MiB");
        assert_eq!(format_size(4 * 1024 * 1024 * 1024), "4.0 GiB");
    }

    #[test]
    fn maps_profiles_to_expected_labels() {
        assert_eq!(profile_label(&RuntimeProfile::Utility), "utility");
        assert_eq!(profile_label(&RuntimeProfile::Default), "default");
        assert_eq!(profile_label(&RuntimeProfile::Quality), "quality");
    }
}
