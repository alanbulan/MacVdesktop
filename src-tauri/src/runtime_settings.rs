use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const SETTINGS_FILENAME: &str = "llm-runtime.json";
const DEFAULT_ENDPOINT: &str = "http://127.0.0.1:11434";
const DEFAULT_MODEL_ID: &str = "qwen3.5:4b-q4_K_M";
const DEFAULT_KEEP_ALIVE: &str = "5m";
const DEFAULT_CONTEXT_LENGTH: u32 = 4096;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeSelection {
    Ollama,
    LlamaCpp,
}

impl Default for RuntimeSelection {
    fn default() -> Self {
        Self::Ollama
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeProfile {
    Utility,
    Default,
    Quality,
}

impl Default for RuntimeProfile {
    fn default() -> Self {
        Self::Default
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GpuOffloadMode {
    Auto,
    Metal,
    Disabled,
}

impl Default for GpuOffloadMode {
    fn default() -> Self {
        Self::Auto
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SmokeTestStatus {
    NotRun,
    Passed,
    Failed,
}

impl Default for SmokeTestStatus {
    fn default() -> Self {
        Self::NotRun
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SmokeTestRecord {
    #[serde(default)]
    pub status: SmokeTestStatus,
    pub latency_ms: Option<u64>,
    pub updated_at: Option<String>,
    pub preview: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeSettings {
    #[serde(default)]
    pub selected_runtime: RuntimeSelection,
    #[serde(default)]
    pub selected_profile: RuntimeProfile,
    pub preferred_model_id: Option<String>,
    #[serde(default = "default_endpoint")]
    pub endpoint: String,
    #[serde(default = "default_context_length")]
    pub context_length: u32,
    #[serde(default = "default_keep_alive")]
    pub keep_alive: String,
    pub threads: Option<u32>,
    #[serde(default)]
    pub gpu_offload: GpuOffloadMode,
    #[serde(default)]
    pub autostart: bool,
    pub local_model_path: Option<String>,
    #[serde(default)]
    pub last_smoke_test: SmokeTestRecord,
}

impl Default for RuntimeSettings {
    fn default() -> Self {
        Self {
            selected_runtime: RuntimeSelection::Ollama,
            selected_profile: RuntimeProfile::Default,
            preferred_model_id: Some(DEFAULT_MODEL_ID.to_string()),
            endpoint: default_endpoint(),
            context_length: default_context_length(),
            keep_alive: default_keep_alive(),
            threads: None,
            gpu_offload: GpuOffloadMode::Auto,
            autostart: false,
            local_model_path: None,
            last_smoke_test: SmokeTestRecord::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeSettingsInput {
    #[serde(default)]
    pub selected_runtime: RuntimeSelection,
    #[serde(default)]
    pub selected_profile: RuntimeProfile,
    pub preferred_model_id: Option<String>,
    #[serde(default = "default_endpoint")]
    pub endpoint: String,
    #[serde(default = "default_context_length")]
    pub context_length: u32,
    #[serde(default = "default_keep_alive")]
    pub keep_alive: String,
    pub threads: Option<u32>,
    #[serde(default)]
    pub gpu_offload: GpuOffloadMode,
    #[serde(default)]
    pub autostart: bool,
    pub local_model_path: Option<String>,
}

impl Default for RuntimeSettingsInput {
    fn default() -> Self {
        let settings = RuntimeSettings::default();

        Self {
            selected_runtime: settings.selected_runtime,
            selected_profile: settings.selected_profile,
            preferred_model_id: settings.preferred_model_id,
            endpoint: settings.endpoint,
            context_length: settings.context_length,
            keep_alive: settings.keep_alive,
            threads: settings.threads,
            gpu_offload: settings.gpu_offload,
            autostart: settings.autostart,
            local_model_path: settings.local_model_path,
        }
    }
}

impl RuntimeSettings {
    pub fn from_input(input: RuntimeSettingsInput, last_smoke_test: SmokeTestRecord) -> Self {
        Self {
            selected_runtime: input.selected_runtime,
            selected_profile: input.selected_profile,
            preferred_model_id: input.preferred_model_id.or_else(|| Some(DEFAULT_MODEL_ID.to_string())),
            endpoint: input.endpoint,
            context_length: input.context_length,
            keep_alive: input.keep_alive,
            threads: input.threads,
            gpu_offload: input.gpu_offload,
            autostart: input.autostart,
            local_model_path: input.local_model_path,
            last_smoke_test,
        }
    }
}

fn default_endpoint() -> String {
    DEFAULT_ENDPOINT.to_string()
}

fn default_keep_alive() -> String {
    DEFAULT_KEEP_ALIVE.to_string()
}

fn default_context_length() -> u32 {
    DEFAULT_CONTEXT_LENGTH
}

pub fn runtime_settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("无法定位 LLM runtime 配置目录：{error}"))?;

    fs::create_dir_all(&config_dir)
        .map_err(|error| format!("无法创建 LLM runtime 配置目录：{error}"))?;

    Ok(config_dir.join(SETTINGS_FILENAME))
}

pub fn load_runtime_settings(app: &AppHandle) -> Result<RuntimeSettings, String> {
    let path = runtime_settings_path(app)?;

    if !path.exists() {
        return Ok(RuntimeSettings::default());
    }

    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("无法读取 LLM runtime 配置：{error}"))?;

    serde_json::from_str::<RuntimeSettings>(&raw)
        .map_err(|error| format!("无法解析 LLM runtime 配置：{error}"))
}

pub fn save_runtime_settings(app: &AppHandle, settings: &RuntimeSettings) -> Result<(), String> {
    let path = runtime_settings_path(app)?;
    let content = serde_json::to_string_pretty(settings)
        .map_err(|error| format!("无法序列化 LLM runtime 配置：{error}"))?;

    fs::write(&path, content).map_err(|error| format!("无法写入 LLM runtime 配置：{error}"))
}

#[cfg(test)]
mod tests {
    use super::{GpuOffloadMode, RuntimeProfile, RuntimeSelection, RuntimeSettings, RuntimeSettingsInput};

    #[test]
    fn defaults_match_the_expected_local_profile() {
        let settings = RuntimeSettings::default();

        assert!(matches!(settings.selected_runtime, RuntimeSelection::Ollama));
        assert!(matches!(settings.selected_profile, RuntimeProfile::Default));
        assert_eq!(settings.preferred_model_id.as_deref(), Some("qwen3.5:4b-q4_K_M"));
        assert_eq!(settings.context_length, 4096);
        assert_eq!(settings.keep_alive, "5m");
        assert!(matches!(settings.gpu_offload, GpuOffloadMode::Auto));
    }

    #[test]
    fn input_round_trips_into_settings() {
        let settings = RuntimeSettings::from_input(
            RuntimeSettingsInput {
                preferred_model_id: Some("gemma4:e4b".to_string()),
                ..RuntimeSettingsInput::default()
            },
            Default::default(),
        );

        assert_eq!(settings.preferred_model_id.as_deref(), Some("gemma4:e4b"));
    }
}
