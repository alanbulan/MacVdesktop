use crate::apple_smc::{read_fan_sample, AppleSmcFanSample};
use serde::Deserialize;
use serde::Serialize;
use std::cmp::Ordering;
#[cfg(target_os = "macos")]
use std::ffi::CString;
use std::fs;
use std::path::Path;
#[cfg(target_os = "macos")]
use std::process::Command;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use sysinfo::{DiskKind, Disks, Networks, ProcessesToUpdate, System, MINIMUM_CPU_UPDATE_INTERVAL};
use tauri::State;

#[cfg(target_os = "macos")]
use libc::{
    c_void, host_processor_info, host_statistics64, integer_t, mach_msg_type_number_t,
    natural_t, processor_info_array_t, size_t, sysctlbyname, vm_deallocate, xsw_usage,
    CPU_STATE_MAX, CPU_STATE_NICE, CPU_STATE_SYSTEM, CPU_STATE_USER, HOST_VM_INFO64,
    HOST_VM_INFO64_COUNT, KERN_SUCCESS, PROCESSOR_CPU_LOAD_INFO,
};
#[cfg(target_os = "macos")]
use mach2::{mach_types::host_t, traps::mach_task_self};
#[cfg(target_os = "macos")]
use objc2_foundation::{NSError, NSProcessInfo, NSProcessInfoThermalState, NSString};
#[cfg(target_os = "macos")]
use objc2_metal::{
    MTLBlitCommandEncoder, MTLCommandBuffer, MTLCommandBufferStatus, MTLCommandEncoder,
    MTLCommandQueue, MTLCounterSampleBufferDescriptor, MTLCounterSamplingPoint,
    MTLCreateSystemDefaultDevice, MTLDevice, MTLStorageMode,
};

#[cfg(target_os = "macos")]
unsafe extern "C" {
    fn mach_host_self() -> host_t;
}

#[cfg(target_os = "macos")]
const PAGE_SIZE_BYTES: u64 = 16_384;
const POWERMETRICS_CACHE_TTL: Duration = Duration::from_secs(15);
const METAL_SCAFFOLD_CACHE_TTL: Duration = Duration::from_secs(60);

#[derive(Serialize)]
#[serde(tag = "state")]
enum MetricState {
    #[serde(rename = "live")]
    Live {
        source: &'static str,
        value: String,
        #[serde(rename = "numericValue", skip_serializing_if = "Option::is_none")]
        numeric_value: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        unit: Option<&'static str>,
        #[serde(rename = "updatedAt")]
        updated_at: String,
        freshness: &'static str,
    },
    #[serde(rename = "unavailable")]
    Unavailable {
        source: &'static str,
        reason: String,
    },
}

#[derive(Serialize)]
struct TelemetrySecondaryMetric {
    id: &'static str,
    label: &'static str,
    metric: MetricState,
}

#[derive(Serialize)]
struct TelemetryAlert {
    id: &'static str,
    severity: &'static str,
    message: String,
}

#[derive(Serialize)]
struct TelemetryModuleSnapshot {
    id: &'static str,
    name: &'static str,
    summary: String,
    status: &'static str,
    x: i32,
    y: i32,
    #[serde(rename = "primaryMetric")]
    primary_metric: MetricState,
    #[serde(rename = "secondaryMetrics")]
    secondary_metrics: Vec<TelemetrySecondaryMetric>,
    alerts: Vec<TelemetryAlert>,
}

#[derive(Serialize)]
struct TelemetryRuntime {
    kind: &'static str,
}

#[derive(Serialize)]
pub struct TelemetrySnapshot {
    runtime: TelemetryRuntime,
    modules: Vec<TelemetryModuleSnapshot>,
}

#[derive(Serialize)]
pub struct PrivilegedHelperStatus {
    pub(crate) state: &'static str,
    pub(crate) message: String,
    #[serde(rename = "updatedAt", skip_serializing_if = "Option::is_none")]
    pub(crate) updated_at: Option<String>,
}

#[derive(Clone, Default, Deserialize)]
struct PowermetricsHostSample {
    fan_rpm: Option<f64>,
    cpu_power_mw: Option<f64>,
    gpu_power_mw: Option<f64>,
    combined_power_mw: Option<f64>,
    gpu_active_residency_percent: Option<f64>,
    gpu_active_frequency_mhz: Option<f64>,
}

#[derive(Deserialize)]
pub(crate) struct PowermetricsHelperPayload {
    pub(crate) updated_at: String,
    ok: bool,
    sample: PowermetricsHostSample,
    stderr: String,
}

#[derive(Clone)]
struct SampleStamp {
    updated_at: String,
    captured_at: Instant,
}

impl SampleStamp {
    fn now() -> Self {
        Self {
            updated_at: timestamp(),
            captured_at: Instant::now(),
        }
    }

    fn freshness(&self, ttl: Duration) -> &'static str {
        if self.captured_at.elapsed() <= ttl {
            "fresh"
        } else {
            "stale"
        }
    }
}

struct MetricSnapshot {
    value: String,
    numeric_value: Option<f64>,
    unit: Option<&'static str>,
    updated_at: String,
    freshness: &'static str,
}

#[derive(Default)]
pub struct TelemetryCollectorState {
    #[cfg(target_os = "macos")]
    perf_levels: Option<Vec<PerfLevelInfo>>,
    #[cfg(target_os = "macos")]
    last_cpu_ticks: Option<Vec<[u32; CPU_STATE_MAX as usize]>>,
    #[cfg(target_os = "macos")]
    last_memory_snapshot: Option<MemorySnapshot>,
    last_network_totals: Option<NetworkTotals>,
    last_network_sample: Option<SampleStamp>,
    fan_cache: Option<CachedFanSample>,
    powermetrics_cache: Option<CachedPowermetricsSample>,
    metal_scaffold_cache: Option<CachedMetalScaffoldState>,
}

#[derive(Clone)]
struct CachedPowermetricsSample {
    sample: Option<PowermetricsHostSample>,
    failure_reason: Option<String>,
    stamp: SampleStamp,
}

#[derive(Clone)]
struct CachedFanSample {
    sample: Option<AppleSmcFanSample>,
    failure_reason: Option<String>,
    stamp: SampleStamp,
}

#[derive(Clone)]
struct CachedMetalScaffoldState {
    state: MetalCollectorScaffoldState,
    stamp: SampleStamp,
}

#[derive(Clone)]
struct NetworkTotals {
    received_bytes: u64,
    transmitted_bytes: u64,
}

#[cfg(target_os = "macos")]
#[derive(Clone)]
struct PerfLevelInfo {
    name: String,
    logical_cores: usize,
}

#[cfg(target_os = "macos")]
#[derive(Clone)]
struct CpuGroupSample {
    label: String,
    logical_cores: usize,
    usage_percent: f64,
}

#[cfg(target_os = "macos")]
#[derive(Clone)]
struct CpuClusterSample {
    primary: CpuGroupSample,
    secondary: Vec<CpuGroupSample>,
    host_usage_percent: f64,
    host_logical_cores: usize,
}

#[cfg(target_os = "macos")]
#[derive(Clone)]
struct MemorySnapshot {
    pressure_level: Option<u32>,
    free_bytes: u64,
    active_bytes: u64,
    inactive_bytes: u64,
    wired_bytes: u64,
    compressed_bytes: u64,
    swap_used_bytes: u64,
    pageins: u64,
    pageouts: u64,
    stamp: SampleStamp,
}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
#[derive(Clone)]
enum MetalCollectorExecutionState {
    Live(String),
    Unavailable(String),
}

#[derive(Clone)]
struct MetalCollectorScaffoldState {
    counter_path_available: bool,
    execution_state: Option<MetalCollectorExecutionState>,
}

fn timestamp() -> String {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::from_secs(0));

    duration.as_secs().to_string()
}

fn live_metric(snapshot: MetricSnapshot) -> MetricState {
    MetricState::Live {
        source: "tauri-host",
        value: snapshot.value,
        numeric_value: snapshot.numeric_value,
        unit: snapshot.unit,
        updated_at: snapshot.updated_at,
        freshness: snapshot.freshness,
    }
}

fn metric_snapshot(
    value: String,
    numeric_value: Option<f64>,
    unit: Option<&'static str>,
    stamp: &SampleStamp,
    ttl: Duration,
) -> MetricSnapshot {
    MetricSnapshot {
        value,
        numeric_value,
        unit,
        updated_at: stamp.updated_at.clone(),
        freshness: stamp.freshness(ttl),
    }
}

fn unavailable_metric(reason: impl Into<String>) -> MetricState {
    MetricState::Unavailable {
        source: "tauri-host",
        reason: reason.into(),
    }
}

fn unavailable_module_with_reason(
    id: &'static str,
    name: &'static str,
    summary: impl Into<String>,
    reason: impl Into<String>,
    x: i32,
    y: i32,
) -> TelemetryModuleSnapshot {
    TelemetryModuleSnapshot {
        id,
        name,
        summary: summary.into(),
        status: "unavailable",
        x,
        y,
        primary_metric: unavailable_metric(reason),
        secondary_metrics: vec![],
        alerts: vec![],
    }
}

fn secondary_metric(
    id: &'static str,
    label: &'static str,
    snapshot: MetricSnapshot,
) -> TelemetrySecondaryMetric {
    TelemetrySecondaryMetric {
        id,
        label,
        metric: live_metric(snapshot),
    }
}

fn unavailable_secondary_metric(
    id: &'static str,
    label: &'static str,
    reason: impl Into<String>,
) -> TelemetrySecondaryMetric {
    TelemetrySecondaryMetric {
        id,
        label,
        metric: unavailable_metric(reason),
    }
}

fn percent_status(value: f64) -> &'static str {
    if value >= 90.0 {
        "critical"
    } else if value >= 75.0 {
        "warning"
    } else {
        "healthy"
    }
}

fn alerts_for_status(
    id: &'static str,
    module_name: &'static str,
    status: &'static str,
    value: &str,
) -> Vec<TelemetryAlert> {
    match status {
        "critical" => vec![TelemetryAlert {
            id,
            severity: "critical",
            message: format!("{module_name} 当前处于严重状态：{value}。"),
        }],
        "warning" => vec![TelemetryAlert {
            id,
            severity: "warning",
            message: format!("{module_name} 已超过警告阈值：{value}。"),
        }],
        _ => vec![],
    }
}

fn normalize_process_cpu(cpu_usage: f64, logical_cores: usize) -> f64 {
    if logical_cores == 0 {
        return 0.0;
    }

    (cpu_usage / logical_cores as f64).clamp(0.0, 100.0)
}

fn format_percent(value: f64) -> String {
    format!("{value:.0}%")
}

fn format_gigabytes(value: u64) -> String {
    format!("{:.1} GB", value as f64 / 1024.0 / 1024.0 / 1024.0)
}

fn format_bytes_per_second(bytes_per_second: f64) -> String {
    if bytes_per_second >= 1024.0 * 1024.0 {
        format!("{:.1} MB/s", bytes_per_second / 1024.0 / 1024.0)
    } else {
        format!("{:.0} KB/s", bytes_per_second / 1024.0)
    }
}

fn localize_perf_level_label(label: &str) -> String {
    match label.trim() {
        "Performance" => "性能".to_string(),
        "Efficiency" => "能效".to_string(),
        _ => label.to_string(),
    }
}

#[cfg(any(test, target_os = "macos"))]
fn parse_first_number(input: &str) -> Option<f64> {
    input
        .split(|character: char| !(character.is_ascii_digit() || character == '.'))
        .find(|segment| !segment.is_empty())
        .and_then(|segment| segment.parse::<f64>().ok())
}

#[cfg(any(test, target_os = "macos"))]
fn parse_powermetrics_output(output: &str) -> PowermetricsHostSample {
    let mut sample = PowermetricsHostSample::default();

    for line in output.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with("Fan:") {
            sample.fan_rpm = parse_first_number(trimmed);
        } else if trimmed.starts_with("CPU Power:") {
            sample.cpu_power_mw = parse_first_number(trimmed);
        } else if trimmed.starts_with("GPU Power:") {
            sample.gpu_power_mw = parse_first_number(trimmed);
        } else if trimmed.starts_with("Combined Power") {
            sample.combined_power_mw = parse_first_number(trimmed);
        } else if trimmed.starts_with("GPU HW active residency:") {
            sample.gpu_active_residency_percent = parse_first_number(trimmed);
        } else if trimmed.starts_with("GPU HW active frequency:") {
            sample.gpu_active_frequency_mhz = parse_first_number(trimmed);
        }
    }

    sample
}

#[cfg(target_os = "macos")]
fn read_powermetrics_helper_sample() -> Result<(PowermetricsHostSample, SampleStamp), String> {
    let helper_path = helper_output_path()?;

    let raw = fs::read_to_string(&helper_path)
        .map_err(|_| "高权限 powermetrics helper 输出暂不可用。".to_string())?;
    let payload: PowermetricsHelperPayload = serde_json::from_str(&raw)
        .map_err(|_| "高权限 powermetrics helper 输出不是有效的 JSON。".to_string())?;

    if !payload.ok {
        return Err(if payload.stderr.is_empty() {
            "高权限 powermetrics helper 未返回可用样本。".to_string()
        } else {
            payload.stderr
        });
    }

    Ok((
        payload.sample,
        SampleStamp {
            updated_at: payload.updated_at,
            captured_at: Instant::now(),
        },
    ))
}

#[cfg(target_os = "macos")]
fn sample_powermetrics_smc() -> Result<(PowermetricsHostSample, SampleStamp), String> {
    if let Ok(sample) = read_powermetrics_helper_sample() {
        return Ok(sample);
    }

    let output = Command::new("/usr/bin/powermetrics")
        .args(["-n", "1", "-i", "1000", "--samplers", "cpu_power,gpu_power"])
        .output()
        .map_err(|_| "这台 Mac 无法直接使用 powermetrics。".to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("superuser") || stderr.to_ascii_lowercase().contains("permission") {
            return Err("powermetrics 需要系统授权后才能读取 GPU / 功耗遥测。请先启用高权限宿主遥测。".to_string());
        }
        if stderr.to_ascii_lowercase().contains("unrecognized sampler") {
            return Err("当前主机的 powermetrics 不支持所需的 CPU / GPU 功耗采样器。".to_string());
        }

        return Err("powermetrics 未返回可用的 CPU / GPU 功耗遥测。".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok((parse_powermetrics_output(&stdout), SampleStamp::now()))
}

#[cfg(not(target_os = "macos"))]
fn sample_powermetrics_smc() -> Result<PowermetricsHostSample, String> {
    Err("powermetrics 仅在 macOS 上可用。".to_string())
}

pub(crate) fn helper_output_path() -> Result<std::path::PathBuf, String> {
    std::env::var("HOME")
        .map(|home| Path::new(&home).join(".local/state/macvdesktop/powermetrics.json"))
        .map_err(|_| "无法定位当前用户目录中的高权限遥测样本路径。".to_string())
}

fn get_cached_fan_sample(
    state: &mut TelemetryCollectorState,
) -> (Option<AppleSmcFanSample>, Option<String>, SampleStamp) {
    if let Some(cache) = &state.fan_cache {
        if cache.stamp.captured_at.elapsed() <= POWERMETRICS_CACHE_TTL {
            return (
                cache.sample.clone(),
                cache.failure_reason.clone(),
                cache.stamp.clone(),
            );
        }
    }

    let cache = match read_fan_sample() {
        Ok(sample) => CachedFanSample {
            sample: Some(sample),
            failure_reason: None,
            stamp: SampleStamp::now(),
        },
        Err(reason) => CachedFanSample {
            sample: None,
            failure_reason: Some(reason),
            stamp: SampleStamp::now(),
        },
    };

    state.fan_cache = Some(cache.clone());
    (cache.sample, cache.failure_reason, cache.stamp)
}

fn get_cached_powermetrics_sample(
    state: &mut TelemetryCollectorState,
) -> (Option<PowermetricsHostSample>, Option<String>, SampleStamp) {
    if let Some(cache) = &state.powermetrics_cache {
        if cache.stamp.captured_at.elapsed() <= POWERMETRICS_CACHE_TTL {
            return (
                cache.sample.clone(),
                cache.failure_reason.clone(),
                cache.stamp.clone(),
            );
        }
    }

    let cache = match sample_powermetrics_smc() {
        Ok((sample, stamp)) => CachedPowermetricsSample {
            sample: Some(sample),
            failure_reason: None,
            stamp,
        },
        Err(reason) => CachedPowermetricsSample {
            sample: None,
            failure_reason: Some(reason),
            stamp: SampleStamp::now(),
        },
    };

    state.powermetrics_cache = Some(cache.clone());
    (cache.sample, cache.failure_reason, cache.stamp)
}

#[cfg(target_os = "macos")]
fn read_sysctl_value<T: Copy>(name: &str) -> Option<T> {
    let c_name = CString::new(name).ok()?;
    let mut value = unsafe { std::mem::zeroed::<T>() };
    let mut size = std::mem::size_of::<T>() as size_t;
    let result = unsafe {
        sysctlbyname(
            c_name.as_ptr(),
            &mut value as *mut _ as *mut c_void,
            &mut size,
            std::ptr::null_mut(),
            0,
        )
    };

    if result == 0 && size == std::mem::size_of::<T>() as size_t {
        Some(value)
    } else {
        None
    }
}

#[cfg(target_os = "macos")]
fn read_sysctl_string(name: &str) -> Option<String> {
    let c_name = CString::new(name).ok()?;
    let mut size: size_t = 0;
    let probe = unsafe {
        sysctlbyname(
            c_name.as_ptr(),
            std::ptr::null_mut(),
            &mut size,
            std::ptr::null_mut(),
            0,
        )
    };
    if probe != 0 || size == 0 {
        return None;
    }

    let mut buffer = vec![0u8; size];
    let result = unsafe {
        sysctlbyname(
            c_name.as_ptr(),
            buffer.as_mut_ptr() as *mut c_void,
            &mut size,
            std::ptr::null_mut(),
            0,
        )
    };
    if result != 0 {
        return None;
    }

    let content = buffer
        .split(|byte| *byte == 0)
        .next()
        .unwrap_or(&buffer)
        .to_vec();
    String::from_utf8(content).ok()
}

#[cfg(target_os = "macos")]
fn get_perf_levels(state: &mut TelemetryCollectorState) -> Option<Vec<PerfLevelInfo>> {
    if let Some(perf_levels) = &state.perf_levels {
        return Some(perf_levels.clone());
    }

    let count: u32 = read_sysctl_value("hw.nperflevels")?;
    if count == 0 {
        return None;
    }

    let mut perf_levels = Vec::with_capacity(count as usize);
    for index in 0..count {
        let logical_cores = read_sysctl_value::<u32>(&format!("hw.perflevel{index}.logicalcpu"))?;
        let name = read_sysctl_string(&format!("hw.perflevel{index}.name"))
            .unwrap_or_else(|| format!("性能层级 {index}"));
        perf_levels.push(PerfLevelInfo {
            name,
            logical_cores: logical_cores as usize,
        });
    }

    state.perf_levels = Some(perf_levels.clone());
    Some(perf_levels)
}

#[cfg(target_os = "macos")]
fn collect_processor_ticks() -> Result<Vec<[u32; CPU_STATE_MAX as usize]>, String> {
    let host = unsafe { mach_host_self() };
    let mut processor_count: natural_t = 0;
    let mut processor_info: processor_info_array_t = std::ptr::null_mut();
    let mut processor_info_count: mach_msg_type_number_t = 0;
    let result = unsafe {
        host_processor_info(
            host,
            PROCESSOR_CPU_LOAD_INFO,
            &mut processor_count,
            &mut processor_info,
            &mut processor_info_count,
        )
    };

    if result != KERN_SUCCESS {
        return Err(format!("host_processor_info 调用失败，状态码 {result}"));
    }

    let slice = unsafe {
        std::slice::from_raw_parts(
            processor_info,
            processor_info_count as usize,
        )
    };

    let mut ticks = Vec::with_capacity(processor_count as usize);
    for chunk in slice.chunks(CPU_STATE_MAX as usize) {
        if chunk.len() != CPU_STATE_MAX as usize {
            continue;
        }
        ticks.push([chunk[0] as u32, chunk[1] as u32, chunk[2] as u32, chunk[3] as u32]);
    }

    let deallocate_result = unsafe {
        vm_deallocate(
            mach_task_self(),
            processor_info as usize,
            (processor_info_count as usize * std::mem::size_of::<integer_t>()) as usize,
        )
    };
    if deallocate_result != KERN_SUCCESS {
        return Err(format!("vm_deallocate 调用失败，状态码 {deallocate_result}"));
    }

    Ok(ticks)
}

#[cfg(target_os = "macos")]
fn compute_cpu_cluster_sample(
    current_ticks: &[[u32; CPU_STATE_MAX as usize]],
    previous_ticks: Option<&[[u32; CPU_STATE_MAX as usize]]>,
    perf_levels: &[PerfLevelInfo],
) -> Option<CpuClusterSample> {
    if current_ticks.is_empty() {
        return None;
    }

    let previous_ticks = previous_ticks?;
    if previous_ticks.len() != current_ticks.len() {
        return None;
    }

    let usages: Vec<f64> = current_ticks
        .iter()
        .zip(previous_ticks.iter())
        .map(|(current, previous)| {
            let total_delta: u64 = current
                .iter()
                .zip(previous.iter())
                .map(|(left, right)| left.saturating_sub(*right) as u64)
                .sum();
            if total_delta == 0 {
                return 0.0;
            }
            let active_delta = current[CPU_STATE_USER as usize].saturating_sub(previous[CPU_STATE_USER as usize]) as u64
                + current[CPU_STATE_SYSTEM as usize].saturating_sub(previous[CPU_STATE_SYSTEM as usize]) as u64
                + current[CPU_STATE_NICE as usize].saturating_sub(previous[CPU_STATE_NICE as usize]) as u64;
            active_delta as f64 / total_delta as f64 * 100.0
        })
        .collect();

    let host_usage_percent = if usages.is_empty() {
        0.0
    } else {
        usages.iter().sum::<f64>() / usages.len() as f64
    };

    let total_declared_cores: usize = perf_levels.iter().map(|level| level.logical_cores).sum();
    if total_declared_cores != usages.len() {
        return None;
    }

    let mut offset = 0usize;
    let mut groups = Vec::with_capacity(perf_levels.len());
    for level in perf_levels {
        let end = offset + level.logical_cores;
        let group_slice = usages.get(offset..end)?;
        let usage_percent = if group_slice.is_empty() {
            0.0
        } else {
            group_slice.iter().sum::<f64>() / group_slice.len() as f64
        };
        groups.push(CpuGroupSample {
            label: level.name.clone(),
            logical_cores: level.logical_cores,
            usage_percent,
        });
        offset = end;
    }

    let primary = groups.first()?.clone();
    let secondary = groups.iter().skip(1).cloned().collect();

    Some(CpuClusterSample {
        primary,
        secondary,
        host_usage_percent,
        host_logical_cores: usages.len(),
    })
}

#[cfg(target_os = "macos")]
fn collect_cpu_module(state: &mut TelemetryCollectorState) -> TelemetryModuleSnapshot {
    let current_ticks = match collect_processor_ticks() {
        Ok(current_ticks) => current_ticks,
        Err(reason) => {
            return unavailable_module_with_reason(
                "cpu-cluster",
                "CPU 簇",
                "由于未能读取每核心 CPU tick，当前无法提供 Apple Silicon 簇遥测。",
                reason,
                0,
                0,
            )
        }
    };
    let stamp = SampleStamp::now();
    let perf_levels = get_perf_levels(state);
    let previous_ticks = state.last_cpu_ticks.clone();
    state.last_cpu_ticks = Some(current_ticks.clone());

    let Some(perf_levels) = perf_levels else {
        return unavailable_module_with_reason(
            "cpu-cluster",
            "CPU 簇",
            "由于未能识别性能层级拓扑，当前仍无法提供 Apple Silicon 簇遥测。",
            "当前主机未暴露可用的性能层级拓扑信息。",
            0,
            0,
        );
    };

    let Some(sample) = compute_cpu_cluster_sample(&current_ticks, previous_ticks.as_deref(), &perf_levels) else {
        return unavailable_module_with_reason(
            "cpu-cluster",
            "CPU 簇",
            "CPU 簇遥测正在等待第二个每核心 CPU 样本。",
            "CPU 簇遥测需要两个主机 CPU tick 样本后才能报告实时数据。",
            0,
            0,
        );
    };

    let primary_value = format_percent(sample.primary.usage_percent);
    let status = percent_status(sample.primary.usage_percent);
    let mut secondary_metrics = vec![secondary_metric(
        "cpu-host-usage",
        "主机 CPU 使用率",
        metric_snapshot(
            format_percent(sample.host_usage_percent),
            Some(sample.host_usage_percent),
            Some("percent"),
            &stamp,
            Duration::from_secs(10),
        ),
    )];

    for (index, group) in sample.secondary.iter().enumerate() {
        let id = if index == 0 { "cpu-efficiency-cluster" } else { "cpu-additional-cluster" };
        let label = format!("{} 簇", localize_perf_level_label(&group.label));
        secondary_metrics.push(secondary_metric(
            id,
            Box::leak(label.into_boxed_str()),
            metric_snapshot(
                format_percent(group.usage_percent),
                Some(group.usage_percent),
                Some("percent"),
                &stamp,
                Duration::from_secs(10),
            ),
        ));
        let core_label = format!("{} 核心数", localize_perf_level_label(&group.label));
        secondary_metrics.push(secondary_metric(
            "cpu-cluster-core-count",
            Box::leak(core_label.into_boxed_str()),
            metric_snapshot(
                format!("{}", group.logical_cores),
                Some(group.logical_cores as f64),
                Some("count"),
                &stamp,
                Duration::from_secs(10),
            ),
        ));
    }

    secondary_metrics.push(secondary_metric(
        "cpu-logical-cores",
        "逻辑核心数",
        metric_snapshot(
            format!("{}", sample.host_logical_cores),
            Some(sample.host_logical_cores as f64),
            Some("count"),
            &stamp,
            Duration::from_secs(10),
        ),
    ));

    TelemetryModuleSnapshot {
        id: "cpu-cluster",
        name: "CPU 簇",
        summary: format!(
            "{}簇使用率基于每核心 CPU tick 差值计算，覆盖 {} 个逻辑核心。",
            localize_perf_level_label(&sample.primary.label), sample.host_logical_cores
        ),
        status,
        x: 0,
        y: 0,
        primary_metric: live_metric(metric_snapshot(
            primary_value.clone(),
            Some(sample.primary.usage_percent),
            Some("percent"),
            &stamp,
            Duration::from_secs(10),
        )),
        secondary_metrics,
        alerts: alerts_for_status("cpu-cluster-alert", "CPU 簇", status, &primary_value),
    }
}

#[cfg(not(target_os = "macos"))]
fn collect_cpu_module(_state: &mut TelemetryCollectorState) -> TelemetryModuleSnapshot {
    unavailable_module_with_reason(
        "cpu-cluster",
        "CPU 簇",
        "Apple Silicon 簇遥测仅在暴露性能层级拓扑的 macOS 主机上可用。",
        "当前平台尚未实现性能层级簇遥测。",
        0,
        0,
    )
}

#[cfg(target_os = "macos")]
fn collect_memory_snapshot() -> Result<MemorySnapshot, String> {
    let host = unsafe { mach_host_self() };
    let mut stats = std::mem::MaybeUninit::<libc::vm_statistics64>::zeroed();
    let mut count: mach_msg_type_number_t = HOST_VM_INFO64_COUNT;
    let result = unsafe {
        host_statistics64(
            host,
            HOST_VM_INFO64,
            stats.as_mut_ptr() as *mut integer_t,
            &mut count,
        )
    };
    if result != KERN_SUCCESS {
        return Err(format!("host_statistics64 调用失败，状态码 {result}"));
    }

    let stats = unsafe { stats.assume_init() };
    let swap = read_sysctl_value::<xsw_usage>("vm.swapusage").ok_or_else(|| "vm.swapusage 当前不可用。".to_string())?;
    let pressure_level = read_sysctl_value::<u32>("kern.memorystatus_level");
    let stamp = SampleStamp::now();

    Ok(MemorySnapshot {
        pressure_level,
        free_bytes: (stats.free_count as u64) * PAGE_SIZE_BYTES,
        active_bytes: (stats.active_count as u64) * PAGE_SIZE_BYTES,
        inactive_bytes: (stats.inactive_count as u64) * PAGE_SIZE_BYTES,
        wired_bytes: (stats.wire_count as u64) * PAGE_SIZE_BYTES,
        compressed_bytes: (stats.compressor_page_count as u64) * PAGE_SIZE_BYTES,
        swap_used_bytes: swap.xsu_used,
        pageins: stats.pageins,
        pageouts: stats.pageouts,
        stamp,
    })
}

#[cfg(target_os = "macos")]
fn memory_pressure_state_label(level: u32) -> (&'static str, &'static str, &'static str) {
    if level <= 10 {
        (
            "严重",
            "critical",
            "系统 memorystatus 级别显示当前内存压力已达到严重状态。",
        )
    } else if level <= 40 {
        (
            "告警",
            "warning",
            "系统 memorystatus 级别显示当前内存压力正在升高。",
        )
    } else {
        (
            "正常",
            "healthy",
            "系统 memorystatus 级别显示当前内存压力处于正常范围。",
        )
    }
}

#[cfg(target_os = "macos")]
fn collect_memory_module(state: &mut TelemetryCollectorState) -> TelemetryModuleSnapshot {
    let current_snapshot = match collect_memory_snapshot() {
        Ok(snapshot) => snapshot,
        Err(reason) => {
            return unavailable_module_with_reason(
                "memory-pressure",
                "内存压力",
                "由于未能读取 VM 统计信息，当前无法提供 macOS 内存压力遥测。",
                reason,
                2,
                0,
            )
        }
    };

    let previous_snapshot = state.last_memory_snapshot.clone();
    state.last_memory_snapshot = Some(current_snapshot.clone());

    let mut secondary_metrics = vec![
        secondary_metric(
            "memory-used",
            "已用内存",
            metric_snapshot(
                format_gigabytes(current_snapshot.active_bytes + current_snapshot.inactive_bytes + current_snapshot.wired_bytes),
                Some((current_snapshot.active_bytes + current_snapshot.inactive_bytes + current_snapshot.wired_bytes) as f64),
                None,
                &current_snapshot.stamp,
                Duration::from_secs(10),
            ),
        ),
        secondary_metric(
            "memory-wired",
            "锁定内存",
            metric_snapshot(
                format_gigabytes(current_snapshot.wired_bytes),
                Some(current_snapshot.wired_bytes as f64),
                None,
                &current_snapshot.stamp,
                Duration::from_secs(10),
            ),
        ),
        secondary_metric(
            "memory-compressed",
            "压缩内存",
            metric_snapshot(
                format_gigabytes(current_snapshot.compressed_bytes),
                Some(current_snapshot.compressed_bytes as f64),
                None,
                &current_snapshot.stamp,
                Duration::from_secs(10),
            ),
        ),
        secondary_metric(
            "memory-swap-used",
            "已用交换区",
            metric_snapshot(
                format_gigabytes(current_snapshot.swap_used_bytes),
                Some(current_snapshot.swap_used_bytes as f64),
                None,
                &current_snapshot.stamp,
                Duration::from_secs(10),
            ),
        ),
        secondary_metric(
            "memory-free",
            "可用内存",
            metric_snapshot(
                format_gigabytes(current_snapshot.free_bytes),
                Some(current_snapshot.free_bytes as f64),
                None,
                &current_snapshot.stamp,
                Duration::from_secs(10),
            ),
        ),
    ];

    if let Some(previous_snapshot) = previous_snapshot {
        let pagein_delta = current_snapshot.pageins.saturating_sub(previous_snapshot.pageins);
        let pageout_delta = current_snapshot.pageouts.saturating_sub(previous_snapshot.pageouts);
        secondary_metrics.push(secondary_metric(
            "memory-pageins",
            "换入页",
            metric_snapshot(
                format!("{}", pagein_delta),
                Some(pagein_delta as f64),
                Some("count"),
                &current_snapshot.stamp,
                Duration::from_secs(10),
            ),
        ));
        secondary_metrics.push(secondary_metric(
            "memory-pageouts",
            "换出页",
            metric_snapshot(
                format!("{}", pageout_delta),
                Some(pageout_delta as f64),
                Some("count"),
                &current_snapshot.stamp,
                Duration::from_secs(10),
            ),
        ));
    } else {
        secondary_metrics.push(unavailable_secondary_metric(
            "memory-page-delta",
            "页交换变化",
            "页换入 / 换出遥测需要两个 VM 样本后才能报告实时变化量。",
        ));
    }

    let Some(level) = current_snapshot.pressure_level else {
        return TelemetryModuleSnapshot {
            id: "memory-pressure",
            name: "内存压力",
            summary: "当前已拿到 macOS VM 统计信息，但主机未暴露可信的 memorystatus 压力级别。".to_string(),
            status: "unavailable",
            x: 2,
            y: 0,
            primary_metric: unavailable_metric("当前主机未暴露可信的 memorystatus 内存压力级别。"),
            secondary_metrics,
            alerts: vec![],
        };
    };

    let (label, status, summary) = memory_pressure_state_label(level);
    TelemetryModuleSnapshot {
        id: "memory-pressure",
        name: "内存压力",
        summary: summary.to_string(),
        status,
        x: 2,
        y: 0,
        primary_metric: live_metric(metric_snapshot(
            label.to_string(),
            None,
            Some("state"),
            &current_snapshot.stamp,
            Duration::from_secs(10),
        )),
        secondary_metrics,
        alerts: alerts_for_status("memory-pressure-alert", "内存压力", status, label),
    }
}

#[cfg(not(target_os = "macos"))]
fn collect_memory_module(_state: &mut TelemetryCollectorState) -> TelemetryModuleSnapshot {
    unavailable_module_with_reason(
        "memory-pressure",
        "内存压力",
        "内存压力遥测仅在暴露 VM 统计信息和 memorystatus 压力级别的 macOS 主机上可用。",
        "当前平台尚未实现内存压力遥测。",
        2,
        0,
    )
}

fn select_primary_disk<'a>(disks: &'a Disks) -> Option<&'a sysinfo::Disk> {
    disks
        .list()
        .iter()
        .find(|disk| disk.mount_point() == Path::new("/"))
        .or_else(|| {
            disks
                .list()
                .iter()
                .filter(|disk| !disk.is_removable() && disk.kind() != DiskKind::Unknown(-1))
                .min_by_key(|disk| disk.mount_point().components().count())
        })
        .or_else(|| disks.list().first())
}

fn collect_disk_module() -> TelemetryModuleSnapshot {
    let disks = Disks::new_with_refreshed_list();
    let Some(primary_disk) = select_primary_disk(&disks) else {
        return unavailable_module_with_reason(
            "disk-usage",
            "磁盘占用",
            "由于未检测到已挂载卷，当前无法提供主机磁盘遥测。",
            "当前未检测到已挂载的磁盘卷。",
            0,
            1,
        );
    };

    let total_space = primary_disk.total_space();
    let available_space = primary_disk.available_space();
    let used_space = total_space.saturating_sub(available_space);
    let usage_percent = if total_space == 0 {
        0.0
    } else {
        used_space as f64 / total_space as f64 * 100.0
    };
    let primary_value = format_percent(usage_percent);
    let status = percent_status(usage_percent);
    let stamp = SampleStamp::now();

    TelemetryModuleSnapshot {
        id: "disk-usage",
        name: "磁盘占用",
        summary: format!(
            "启动卷 {} 当前剩余 {} 可用空间。",
            primary_disk.mount_point().display(),
            format_gigabytes(available_space)
        ),
        status,
        x: 0,
        y: 1,
        primary_metric: live_metric(metric_snapshot(
            primary_value.clone(),
            Some(usage_percent),
            Some("percent"),
            &stamp,
            Duration::from_secs(30),
        )),
        secondary_metrics: vec![
            secondary_metric(
                "disk-free",
                "剩余空间",
                metric_snapshot(
                    format_gigabytes(available_space),
                    Some(available_space as f64),
                    None,
                    &stamp,
                    Duration::from_secs(30),
                ),
            ),
            secondary_metric(
                "disk-volume",
                "卷路径",
                metric_snapshot(
                    primary_disk.mount_point().display().to_string(),
                    None,
                    None,
                    &stamp,
                    Duration::from_secs(30),
                ),
            ),
        ],
        alerts: alerts_for_status("disk-usage-alert", "磁盘占用", status, &primary_value),
    }
}

fn collect_network_module(state: &mut TelemetryCollectorState) -> TelemetryModuleSnapshot {
    let networks = Networks::new_with_refreshed_list();
    let totals = networks.iter().fold(
        NetworkTotals {
            received_bytes: 0,
            transmitted_bytes: 0,
        },
        |mut totals, (_, network)| {
            totals.received_bytes += network.total_received();
            totals.transmitted_bytes += network.total_transmitted();
            totals
        },
    );
    let stamp = SampleStamp::now();

    let Some(previous_totals) = state.last_network_totals.clone() else {
        state.last_network_totals = Some(totals);
        state.last_network_sample = Some(stamp.clone());
        return unavailable_module_with_reason(
            "network-throughput",
            "网络吞吐",
            "网络吞吐正在等待第二个累计接口样本。",
            "网络吞吐需要两个累计接口样本后才能报告实时速率。",
            1,
            1,
        );
    };
    let Some(previous_stamp) = state.last_network_sample.clone() else {
        state.last_network_totals = Some(totals);
        state.last_network_sample = Some(stamp.clone());
        return unavailable_module_with_reason(
            "network-throughput",
            "网络吞吐",
            "网络吞吐正在等待第二个累计接口样本。",
            "网络吞吐需要两个累计接口样本后才能报告实时速率。",
            1,
            1,
        );
    };

    let elapsed_seconds = stamp
        .captured_at
        .saturating_duration_since(previous_stamp.captured_at)
        .as_secs_f64();
    state.last_network_totals = Some(totals.clone());
    state.last_network_sample = Some(stamp.clone());

    if elapsed_seconds <= 0.0 {
        return unavailable_module_with_reason(
            "network-throughput",
            "网络吞吐",
            "网络吞吐的采样间隔过短，暂时无法计算稳定速率。",
            "网络吞吐需要正的采样间隔后才能报告实时速率。",
            1,
            1,
        );
    }

    let rx_rate = totals.received_bytes.saturating_sub(previous_totals.received_bytes) as f64 / elapsed_seconds;
    let tx_rate = totals.transmitted_bytes.saturating_sub(previous_totals.transmitted_bytes) as f64 / elapsed_seconds;
    let total_rate = rx_rate + tx_rate;
    let primary_value = format_bytes_per_second(total_rate);
    let status = if total_rate >= 1024.0 * 1024.0 {
        "warning"
    } else {
        "healthy"
    };

    TelemetryModuleSnapshot {
        id: "network-throughput",
        name: "网络吞吐",
        summary: format!("网络吞吐基于 {:.1} 秒内的累计接口计数差值计算。", elapsed_seconds),
        status,
        x: 1,
        y: 1,
        primary_metric: live_metric(metric_snapshot(
            primary_value.clone(),
            Some(total_rate),
            None,
            &stamp,
            Duration::from_secs(10),
        )),
        secondary_metrics: vec![
            secondary_metric(
                "network-rx-rate",
                "接收速率",
                metric_snapshot(
                    format_bytes_per_second(rx_rate),
                    Some(rx_rate),
                    None,
                    &stamp,
                    Duration::from_secs(10),
                ),
            ),
            secondary_metric(
                "network-tx-rate",
                "发送速率",
                metric_snapshot(
                    format_bytes_per_second(tx_rate),
                    Some(tx_rate),
                    None,
                    &stamp,
                    Duration::from_secs(10),
                ),
            ),
        ],
        alerts: alerts_for_status(
            "network-throughput-alert",
            "网络吞吐",
            status,
            &primary_value,
        ),
    }
}

fn collect_top_process_module(system: &mut System) -> TelemetryModuleSnapshot {
    let _ = system.refresh_processes(ProcessesToUpdate::All, false);
    std::thread::sleep(MINIMUM_CPU_UPDATE_INTERVAL);
    let _ = system.refresh_processes(ProcessesToUpdate::All, true);

    let maybe_process = system.processes().values().max_by(|left, right| {
        left.cpu_usage()
            .partial_cmp(&right.cpu_usage())
            .unwrap_or(Ordering::Equal)
    });
    let logical_cores = system.cpus().len();

    let (process_name, cpu_percent) = if let Some(process) = maybe_process {
        (
            process.name().to_string_lossy().into_owned(),
            normalize_process_cpu(process.cpu_usage() as f64, logical_cores),
        )
    } else {
        ("暂无进程数据".to_string(), 0.0)
    };
    let status = percent_status(cpu_percent);
    let primary_value = format_percent(cpu_percent);
    let stamp = SampleStamp::now();

    TelemetryModuleSnapshot {
        id: "top-process",
        name: "高占用进程",
        summary: format!("当前 CPU 占用最高的进程：{process_name}"),
        status,
        x: 2,
        y: 1,
        primary_metric: live_metric(metric_snapshot(
            primary_value.clone(),
            Some(cpu_percent),
            Some("percent"),
            &stamp,
            Duration::from_secs(10),
        )),
        secondary_metrics: vec![secondary_metric(
            "top-process-name",
            "进程名称",
            metric_snapshot(process_name, None, None, &stamp, Duration::from_secs(10)),
        )],
        alerts: alerts_for_status("top-process-alert", "高占用进程", status, &primary_value),
    }
}

#[cfg(target_os = "macos")]
fn collect_thermal_module() -> TelemetryModuleSnapshot {
    let process_info = NSProcessInfo::processInfo();
    let thermal_state = process_info.thermalState();
    let stamp = SampleStamp::now();

    let (value, status, summary) = if thermal_state == NSProcessInfoThermalState::Nominal {
        (
            "正常".to_string(),
            "healthy",
            "根据 NSProcessInfo.thermalState，当前热压力处于正常范围。".to_string(),
        )
    } else if thermal_state == NSProcessInfoThermalState::Fair {
        (
            "偏高".to_string(),
            "warning",
            "根据 NSProcessInfo.thermalState，当前热压力已升高但仍可控。".to_string(),
        )
    } else if thermal_state == NSProcessInfoThermalState::Serious {
        (
            "严重".to_string(),
            "critical",
            "根据 NSProcessInfo.thermalState，当前热压力已达到严重状态。".to_string(),
        )
    } else {
        (
            "临界".to_string(),
            "critical",
            "根据 NSProcessInfo.thermalState，当前热压力已达到临界状态。".to_string(),
        )
    };

    TelemetryModuleSnapshot {
        id: "thermal-state",
        name: "热状态",
        summary,
        status,
        x: 0,
        y: 2,
        primary_metric: live_metric(metric_snapshot(
            value.clone(),
            None,
            Some("state"),
            &stamp,
            Duration::from_secs(10),
        )),
        secondary_metrics: vec![],
        alerts: alerts_for_status("thermal-state-alert", "热状态", status, &value),
    }
}

#[cfg(not(target_os = "macos"))]
fn collect_thermal_module() -> TelemetryModuleSnapshot {
    unavailable_module_with_reason(
        "thermal-state",
        "热状态",
        "热状态遥测仅在可用的 macOS NSProcessInfo 热状态采集器存在时才可提供。",
        "当前平台尚未实现 Apple 专用热状态采集器。",
        0,
        2,
    )
}

fn fan_module_from_apple_smc(
    sample: Option<&AppleSmcFanSample>,
    failure_reason: Option<&str>,
    stamp: &SampleStamp,
) -> TelemetryModuleSnapshot {
    if let Some(sample) = sample {
        let fan_rpm = sample.current_rpm;
        let status = if fan_rpm >= 4500.0 {
            "warning"
        } else {
            "healthy"
        };
        let primary_value = format!("{fan_rpm:.0} rpm");
        let mut secondary_metrics = vec![secondary_metric(
            "fan-count",
            "风扇数量",
            metric_snapshot(
                format!("{}", sample.fan_count),
                Some(sample.fan_count as f64),
                Some("count"),
                stamp,
                POWERMETRICS_CACHE_TTL,
            ),
        )];

        if let Some(min_rpm) = sample.min_rpm {
            secondary_metrics.push(secondary_metric(
                "fan-min-rpm",
                "最低转速",
                metric_snapshot(
                    format!("{min_rpm:.0} rpm"),
                    Some(min_rpm),
                    Some("rpm"),
                    stamp,
                    POWERMETRICS_CACHE_TTL,
                ),
            ));
        }

        if let Some(max_rpm) = sample.max_rpm {
            secondary_metrics.push(secondary_metric(
                "fan-max-rpm",
                "最高转速",
                metric_snapshot(
                    format!("{max_rpm:.0} rpm"),
                    Some(max_rpm),
                    Some("rpm"),
                    stamp,
                    POWERMETRICS_CACHE_TTL,
                ),
            ));
        }

        return TelemetryModuleSnapshot {
            id: "fan-speed",
            name: "风扇转速",
            summary: "风扇转速由 AppleSMC 风扇键值采样。".to_string(),
            status,
            x: 1,
            y: 2,
            primary_metric: live_metric(metric_snapshot(
                primary_value.clone(),
                Some(fan_rpm),
                Some("rpm"),
                stamp,
                POWERMETRICS_CACHE_TTL,
            )),
            secondary_metrics,
            alerts: alerts_for_status("fan-speed-alert", "风扇转速", status, &primary_value),
        };
    }

    unavailable_module_with_reason(
        "fan-speed",
        "风扇转速",
        "当前主机未暴露可读的 AppleSMC 风扇转速。",
        failure_reason.unwrap_or("当前主机未暴露可读的 AppleSMC 风扇转速。"),
        1,
        2,
    )
}

fn power_module_from_powermetrics(
    sample: Option<&PowermetricsHostSample>,
    failure_reason: Option<&str>,
    stamp: &SampleStamp,
) -> TelemetryModuleSnapshot {
    if let Some(sample) = sample {
        if let Some(cpu_power_mw) = sample.cpu_power_mw {
            let gpu_power_mw = sample.gpu_power_mw;
            let total_power_mw = sample.combined_power_mw.unwrap_or(cpu_power_mw + gpu_power_mw.unwrap_or(0.0));
            let cpu_power_watts = cpu_power_mw / 1000.0;
            let gpu_power_watts = gpu_power_mw.map(|value| value / 1000.0);
            let total_power_watts = total_power_mw / 1000.0;
            let status = if total_power_mw >= 15_000.0 {
                "warning"
            } else {
                "healthy"
            };
            let primary_value = format!("{total_power_watts:.1} W");
            let mut secondary_metrics = vec![secondary_metric(
                "cpu-power",
                "CPU 功耗",
                metric_snapshot(
                    format!("{cpu_power_watts:.1} W"),
                    Some(cpu_power_watts),
                    Some("watts"),
                    stamp,
                    POWERMETRICS_CACHE_TTL,
                ),
            )];

            if let Some(gpu_power) = gpu_power_watts {
                secondary_metrics.push(secondary_metric(
                    "gpu-power",
                    "GPU 功耗",
                    metric_snapshot(
                        format!("{gpu_power:.1} W"),
                        Some(gpu_power),
                        Some("watts"),
                        stamp,
                        POWERMETRICS_CACHE_TTL,
                    ),
                ));
            }

            if sample.combined_power_mw.is_some() {
                secondary_metrics.push(secondary_metric(
                    "combined-power-source",
                    "总功耗来源",
                    metric_snapshot(
                        "由 powermetrics 直接上报".to_string(),
                        None,
                        None,
                        stamp,
                        POWERMETRICS_CACHE_TTL,
                    ),
                ));
            }

            return TelemetryModuleSnapshot {
                id: "power-draw",
                name: "功耗",
                summary: "功耗遥测基于缓存的 powermetrics CPU / GPU 功耗输出进行真实采样。".to_string(),
                status,
                x: 2,
                y: 2,
                primary_metric: live_metric(metric_snapshot(
                    primary_value.clone(),
                    Some(total_power_watts),
                    Some("watts"),
                    stamp,
                    POWERMETRICS_CACHE_TTL,
                )),
                secondary_metrics,
                alerts: alerts_for_status("power-draw-alert", "功耗", status, &primary_value),
            };
        }

        return unavailable_module_with_reason(
            "power-draw",
            "功耗",
            "powermetrics 的 CPU / GPU 功耗输出中未暴露 CPU 功耗字段。",
            "powermetrics 的 CPU / GPU 功耗输出中未暴露 CPU 功耗字段。",
            2,
            2,
        );
    }

    unavailable_module_with_reason(
        "power-draw",
        "功耗",
        "powermetrics 功耗遥测当前不可用。",
        failure_reason.unwrap_or("powermetrics 功耗遥测当前不可用。"),
        2,
        2,
    )
}

#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {}

#[cfg(target_os = "macos")]
fn ns_error_description(error: &NSError) -> String {
    error.localizedDescription().to_string()
}

#[cfg(target_os = "macos")]
fn try_run_metal_placeholder_counter_pass() -> Result<String, String> {
    let device = MTLCreateSystemDefaultDevice()
        .ok_or_else(|| "这台 Mac 当前不可用 Metal。".to_string())?;

    if !device.supportsCounterSampling(MTLCounterSamplingPoint::AtBlitBoundary) {
        return Err("这台 Mac 不支持在 blit 边界进行计数器采样。".to_string());
    }

    let counter_sets = device
        .counterSets()
        .ok_or_else(|| "当前设备未暴露可用的 Metal 计数器集合。".to_string())?;

    if counter_sets.count() == 0 {
        return Err("当前设备未暴露可用的 Metal 计数器集合。".to_string());
    }

    let counter_set = counter_sets.objectAtIndex(0);
    let descriptor = MTLCounterSampleBufferDescriptor::new();
    descriptor.setCounterSet(Some(&counter_set));
    descriptor.setLabel(&NSString::from_str("MacVdesktop placeholder counter pass"));
    descriptor.setStorageMode(MTLStorageMode::Shared);
    unsafe { descriptor.setSampleCount(1) };

    let sample_buffer = device
        .newCounterSampleBufferWithDescriptor_error(&descriptor)
        .map_err(|error| ns_error_description(&error))?;

    let command_queue = device
        .newCommandQueue()
        .ok_or_else(|| "Metal 未能为占位采样流程创建命令队列。".to_string())?;

    let command_buffer = command_queue
        .commandBuffer()
        .ok_or_else(|| "Metal 未能为占位采样流程创建命令缓冲区。".to_string())?;

    let blit_encoder = command_buffer
        .blitCommandEncoder()
        .ok_or_else(|| "Metal 未能为占位采样流程创建 blit 编码器。".to_string())?;

    unsafe {
        blit_encoder.sampleCountersInBuffer_atSampleIndex_withBarrier(&sample_buffer, 0, true);
    }
    blit_encoder.endEncoding();
    command_buffer.commit();
    command_buffer.waitUntilCompleted();

    match command_buffer.status() {
        MTLCommandBufferStatus::Completed => Ok("占位采样流程已完成".to_string()),
        MTLCommandBufferStatus::Error => Err(command_buffer
            .error()
            .map(|error| ns_error_description(&error))
            .unwrap_or_else(|| "Metal 占位采样流程在命令缓冲区执行期间失败。".to_string())),
        status => Err(format!("Metal 占位采样流程以异常状态 {} 结束。", status.0)),
    }
}

#[cfg(target_os = "macos")]
fn detect_metal_collector_scaffold_state() -> MetalCollectorScaffoldState {
    if let Some(device) = MTLCreateSystemDefaultDevice() {
        if let Some(counter_sets) = device.counterSets() {
            if counter_sets.count() > 0 {
                return match try_run_metal_placeholder_counter_pass() {
                    Ok(value) => MetalCollectorScaffoldState {
                        counter_path_available: true,
                        execution_state: Some(MetalCollectorExecutionState::Live(value)),
                    },
                    Err(reason) => MetalCollectorScaffoldState {
                        counter_path_available: false,
                        execution_state: Some(MetalCollectorExecutionState::Unavailable(reason)),
                    },
                };
            }
        }
    }

    MetalCollectorScaffoldState {
        counter_path_available: false,
        execution_state: None,
    }
}

#[cfg(not(target_os = "macos"))]
fn detect_metal_collector_scaffold_state() -> MetalCollectorScaffoldState {
    MetalCollectorScaffoldState {
        counter_path_available: false,
        execution_state: None,
    }
}

fn get_cached_metal_scaffold_state(state: &mut TelemetryCollectorState) -> (MetalCollectorScaffoldState, SampleStamp) {
    if let Some(cache) = &state.metal_scaffold_cache {
        if cache.stamp.captured_at.elapsed() <= METAL_SCAFFOLD_CACHE_TTL {
            return (cache.state.clone(), cache.stamp.clone());
        }
    }

    let stamp = SampleStamp::now();
    let cache = CachedMetalScaffoldState {
        state: detect_metal_collector_scaffold_state(),
        stamp: stamp.clone(),
    };
    state.metal_scaffold_cache = Some(cache.clone());
    (cache.state, cache.stamp)
}

fn gpu_module_from_powermetrics(
    sample: Option<&PowermetricsHostSample>,
    failure_reason: Option<&str>,
    metal_scaffold_state: &MetalCollectorScaffoldState,
    metal_stamp: &SampleStamp,
    power_stamp: &SampleStamp,
) -> TelemetryModuleSnapshot {
    let mut module = unavailable_module_with_reason(
        "gpu-activity",
        "GPU 活动",
        "在 powermetrics 暴露 GPU HW active residency 或可信的应用内 Metal 采集路径就绪前，系统范围 GPU 活动仍不可用。",
        "在可信的 GPU 活动数据源可用前，系统范围 GPU 活动遥测暂不可用。",
        1,
        0,
    );

    let mut secondary_metrics = vec![if metal_scaffold_state.counter_path_available {
        TelemetrySecondaryMetric {
            id: "gpu-counter-path",
            label: "GPU 计数器路径",
            metric: live_metric(metric_snapshot(
                "已检测到".to_string(),
                None,
                None,
                metal_stamp,
                METAL_SCAFFOLD_CACHE_TTL,
            )),
        }
    } else {
        TelemetrySecondaryMetric {
            id: "gpu-counter-path",
            label: "GPU 计数器路径",
            metric: unavailable_metric("当前主机未检测到受支持的 Metal 计数器集合。"),
        }
    }];

    if let Some(execution_state) = &metal_scaffold_state.execution_state {
        secondary_metrics.push(TelemetrySecondaryMetric {
            id: "gpu-collector-execution",
            label: "采集流程执行状态",
            metric: match execution_state {
                MetalCollectorExecutionState::Live(value) => live_metric(metric_snapshot(
                    value.clone(),
                    None,
                    None,
                    metal_stamp,
                    METAL_SCAFFOLD_CACHE_TTL,
                )),
                MetalCollectorExecutionState::Unavailable(reason) => unavailable_metric(reason.clone()),
            },
        });

        module.summary = match execution_state {
            MetalCollectorExecutionState::Live(_) => "系统范围 GPU 活动仍不可用，但应用内 Metal 占位采样流程已在计数器路径上成功完成。".to_string(),
            MetalCollectorExecutionState::Unavailable(_) => "系统范围 GPU 活动仍不可用，且应用内 Metal 占位采样流程尝试未成功。".to_string(),
        };
    }

    if let Some(sample) = sample {
        if let Some(gpu_activity_percent) = sample.gpu_active_residency_percent {
            let status = percent_status(gpu_activity_percent);
            let primary_value = format_percent(gpu_activity_percent);
            let mut activity_secondary_metrics = vec![];

            if let Some(gpu_frequency_mhz) = sample.gpu_active_frequency_mhz {
                activity_secondary_metrics.push(secondary_metric(
                    "gpu-active-frequency",
                    "GPU 活动频率",
                    metric_snapshot(
                        format!("{gpu_frequency_mhz:.0} MHz"),
                        Some(gpu_frequency_mhz),
                        None,
                        power_stamp,
                        POWERMETRICS_CACHE_TTL,
                    ),
                ));
            }

            if let Some(gpu_power_mw) = sample.gpu_power_mw {
                let gpu_power_watts = gpu_power_mw / 1000.0;
                activity_secondary_metrics.push(secondary_metric(
                    "gpu-power",
                    "GPU 功耗",
                    metric_snapshot(
                        format!("{gpu_power_watts:.1} W"),
                        Some(gpu_power_watts),
                        Some("watts"),
                        power_stamp,
                        POWERMETRICS_CACHE_TTL,
                    ),
                ));
            }

            activity_secondary_metrics.extend(secondary_metrics);

            return TelemetryModuleSnapshot {
                id: "gpu-activity",
                name: "GPU 活动",
                summary: "系统范围 GPU 活动基于 powermetrics 的 GPU HW active residency 进行采样。".to_string(),
                status,
                x: 1,
                y: 0,
                primary_metric: live_metric(metric_snapshot(
                    primary_value.clone(),
                    Some(gpu_activity_percent),
                    Some("percent"),
                    power_stamp,
                    POWERMETRICS_CACHE_TTL,
                )),
                secondary_metrics: activity_secondary_metrics,
                alerts: alerts_for_status("gpu-activity-alert", "GPU 活动", status, &primary_value),
            };
        }

        if let Some(gpu_power_mw) = sample.gpu_power_mw {
            let gpu_power_watts = gpu_power_mw / 1000.0;
            module.summary = match metal_scaffold_state.execution_state {
                Some(MetalCollectorExecutionState::Live(_)) => "系统范围 GPU 活动仍不可用，但在应用内占位采样流程成功完成时，powermetrics 已采到 GPU 功耗。".to_string(),
                Some(MetalCollectorExecutionState::Unavailable(_)) => "系统范围 GPU 活动仍不可用，但在应用内 Metal 占位采样流程失败后，powermetrics 仍采到了 GPU 功耗。".to_string(),
                None => "系统范围 GPU 活动仍不可用，但 powermetrics 已采到 GPU 功耗。".to_string(),
            };
            secondary_metrics.insert(
                0,
                secondary_metric(
                    "gpu-power",
                    "GPU 功耗",
                    metric_snapshot(
                        format!("{gpu_power_watts:.1} W"),
                        Some(gpu_power_watts),
                        Some("watts"),
                        power_stamp,
                        POWERMETRICS_CACHE_TTL,
                    ),
                ),
            );
        }
    }

    if let Some(reason) = failure_reason {
        secondary_metrics.push(TelemetrySecondaryMetric {
            id: "gpu-power-source",
            label: "GPU 功耗来源",
            metric: unavailable_metric(reason),
        });
    }

    module.secondary_metrics = secondary_metrics;
    module
}

fn collect_gpu_fan_and_power_modules(
    state: &mut TelemetryCollectorState,
) -> (
    TelemetryModuleSnapshot,
    TelemetryModuleSnapshot,
    TelemetryModuleSnapshot,
) {
    let (metal_scaffold_state, metal_stamp) = get_cached_metal_scaffold_state(state);
    let (powermetrics_sample, powermetrics_failure_reason, powermetrics_stamp) =
        get_cached_powermetrics_sample(state);
    let (fan_sample, fan_failure_reason, fan_stamp) = get_cached_fan_sample(state);

    let sample_ref = powermetrics_sample.as_ref();
    let failure_ref = powermetrics_failure_reason.as_deref();
    let fan_sample_ref = fan_sample.as_ref();
    let fan_failure_ref = fan_failure_reason.as_deref();

    (
        gpu_module_from_powermetrics(
            sample_ref,
            failure_ref,
            &metal_scaffold_state,
            &metal_stamp,
            &powermetrics_stamp,
        ),
        fan_module_from_apple_smc(fan_sample_ref, fan_failure_ref, &fan_stamp),
        power_module_from_powermetrics(sample_ref, failure_ref, &powermetrics_stamp),
    )
}

pub fn collect_telemetry_snapshot(state: &mut TelemetryCollectorState) -> TelemetrySnapshot {
    let mut system = System::new_all();
    let (gpu_module, fan_module, power_module) = collect_gpu_fan_and_power_modules(state);

    TelemetrySnapshot {
        runtime: TelemetryRuntime { kind: "tauri" },
        modules: vec![
            collect_cpu_module(state),
            gpu_module,
            collect_memory_module(state),
            collect_disk_module(),
            collect_network_module(state),
            collect_top_process_module(&mut system),
            collect_thermal_module(),
            fan_module,
            power_module,
        ],
    }
}

#[tauri::command]
pub fn get_telemetry_snapshot(state: State<'_, std::sync::Mutex<TelemetryCollectorState>>) -> TelemetrySnapshot {
    let mut state = state.lock().expect("telemetry collector state lock poisoned");
    collect_telemetry_snapshot(&mut state)
}

#[cfg(test)]
mod tests {
    use super::{
        alerts_for_status, collect_telemetry_snapshot, collect_top_process_module,
        compute_cpu_cluster_sample, fan_module_from_apple_smc, gpu_module_from_powermetrics,
        memory_pressure_state_label, normalize_process_cpu, parse_powermetrics_output,
        power_module_from_powermetrics, MetalCollectorExecutionState,
        MetalCollectorScaffoldState, MetricState, PowermetricsHostSample, SampleStamp,
        TelemetryCollectorState,
    };
    use std::time::{Duration, Instant};
    use sysinfo::System;

    fn fixed_stamp() -> SampleStamp {
        SampleStamp {
            updated_at: "123".to_string(),
            captured_at: Instant::now() - Duration::from_secs(1),
        }
    }

    #[test]
    fn snapshot_covers_expected_module_ids() {
        let mut state = TelemetryCollectorState::default();
        let _ = collect_telemetry_snapshot(&mut state);
        let snapshot = collect_telemetry_snapshot(&mut state);
        let ids: Vec<_> = snapshot.modules.iter().map(|module| module.id).collect();

        assert!(ids.contains(&"cpu-cluster"));
        assert!(ids.contains(&"gpu-activity"));
        assert!(ids.contains(&"memory-pressure"));
        assert!(ids.contains(&"disk-usage"));
        assert!(ids.contains(&"network-throughput"));
        assert!(ids.contains(&"top-process"));
        assert!(ids.contains(&"thermal-state"));
        assert!(ids.contains(&"fan-speed"));
        assert!(ids.contains(&"power-draw"));
        assert_eq!(snapshot.modules.len(), 9);
    }

    #[test]
    fn normalize_process_cpu_scales_to_host_capacity() {
        assert_eq!(normalize_process_cpu(240.0, 8), 30.0);
        assert_eq!(normalize_process_cpu(400.0, 4), 100.0);
    }

    #[test]
    fn top_process_module_reports_a_named_process_metric() {
        let mut system = System::new_all();
        let module = collect_top_process_module(&mut system);

        assert_eq!(module.id, "top-process");
        assert_eq!(module.secondary_metrics[0].id, "top-process-name");
        assert!(!module.summary.is_empty());
    }

    #[test]
    fn warning_status_produces_alert() {
        let alerts = alerts_for_status("cpu-high-usage", "CPU 簇", "warning", "82%");

        assert_eq!(alerts.len(), 1);
        assert_eq!(alerts[0].severity, "warning");
        assert!(alerts[0].message.contains("CPU 簇"));
    }

    #[test]
    fn parse_powermetrics_output_extracts_power_and_gpu_activity_metrics() {
        let sample = parse_powermetrics_output(
            "CPU Power: 1234 mW\nGPU Power: 456 mW\nCombined Power (CPU + GPU + ANE): 1690 mW\nGPU HW active frequency: 817 MHz\nGPU HW active residency:  13.32%\n",
        );

        assert_eq!(sample.cpu_power_mw, Some(1234.0));
        assert_eq!(sample.gpu_power_mw, Some(456.0));
        assert_eq!(sample.combined_power_mw, Some(1690.0));
        assert_eq!(sample.gpu_active_frequency_mhz, Some(817.0));
        assert_eq!(sample.gpu_active_residency_percent, Some(13.32));
    }

    #[test]
    fn memory_pressure_state_mapping_is_truthful() {
        assert_eq!(memory_pressure_state_label(80).0, "正常");
        assert_eq!(memory_pressure_state_label(25).0, "告警");
        assert_eq!(memory_pressure_state_label(5).0, "严重");
    }

    #[test]
    fn compute_cpu_cluster_sample_aggregates_perf_levels() {
        let current = vec![
            [150, 50, 100, 0],
            [160, 40, 100, 0],
            [120, 30, 150, 0],
            [120, 30, 150, 0],
        ];
        let previous = vec![
            [100, 40, 80, 0],
            [120, 20, 80, 0],
            [100, 20, 130, 0],
            [100, 20, 130, 0],
        ];
        let perf_levels = vec![
            super::PerfLevelInfo {
                name: "Performance".to_string(),
                logical_cores: 2,
            },
            super::PerfLevelInfo {
                name: "Efficiency".to_string(),
                logical_cores: 2,
            },
        ];

        let sample = compute_cpu_cluster_sample(&current, Some(&previous), &perf_levels).unwrap();
        assert_eq!(sample.primary.label, "Performance");
        assert_eq!(sample.secondary.len(), 1);
        assert!(sample.primary.usage_percent > sample.secondary[0].usage_percent);
        assert_eq!(sample.host_logical_cores, 4);
    }

    #[test]
    fn fan_module_reports_missing_apple_smc_field_truthfully() {
        let fan = fan_module_from_apple_smc(None, None, &fixed_stamp());

        assert!(matches!(
            fan.primary_metric,
            MetricState::Unavailable { reason, .. }
                if reason == "当前主机未暴露可读的 AppleSMC 风扇转速。"
        ));
    }

    #[test]
    fn power_module_reports_missing_powermetrics_field_truthfully() {
        let power = power_module_from_powermetrics(
            Some(&PowermetricsHostSample {
                fan_rpm: None,
                cpu_power_mw: None,
                gpu_power_mw: Some(456.0),
                combined_power_mw: None,
                gpu_active_residency_percent: None,
                gpu_active_frequency_mhz: None,
            }),
            None,
            &fixed_stamp(),
        );

        assert!(matches!(
            power.primary_metric,
            MetricState::Unavailable { reason, .. }
                if reason == "powermetrics 的 CPU / GPU 功耗输出中未暴露 CPU 功耗字段。"
        ));
    }

    #[test]
    fn power_module_reports_watt_units_with_watt_numeric_values() {
        let power = power_module_from_powermetrics(
            Some(&PowermetricsHostSample {
                fan_rpm: None,
                cpu_power_mw: Some(1234.0),
                gpu_power_mw: Some(456.0),
                combined_power_mw: Some(1690.0),
                gpu_active_residency_percent: None,
                gpu_active_frequency_mhz: None,
            }),
            None,
            &fixed_stamp(),
        );

        assert!(matches!(
            power.primary_metric,
            MetricState::Live {
                numeric_value: Some(value),
                unit: Some("watts"),
                freshness: "fresh",
                ..
            } if (value - 1.69).abs() < 0.0001
        ));
        assert!(power.secondary_metrics.iter().any(|metric| matches!(
            metric.metric,
            MetricState::Live {
                numeric_value: Some(value),
                unit: Some("watts"),
                ..
            } if (value - 1.234).abs() < 0.0001
        )));
        assert!(power.secondary_metrics.iter().any(|metric| matches!(
            metric.metric,
            MetricState::Live {
                numeric_value: Some(value),
                unit: Some("watts"),
                ..
            } if (value - 0.456).abs() < 0.0001
        )));
    }

    #[test]
    fn gpu_module_keeps_primary_unavailable_reason_focused_on_activity_gap() {
        let gpu = gpu_module_from_powermetrics(
            None,
            Some("powermetrics 需要系统授权后才能读取 GPU / 功耗遥测。请先启用高权限宿主遥测。"),
            &MetalCollectorScaffoldState {
                counter_path_available: false,
                execution_state: None,
            },
            &fixed_stamp(),
            &fixed_stamp(),
        );

        assert!(matches!(
            gpu.primary_metric,
            MetricState::Unavailable { reason, .. }
                if reason == "在可信的 GPU 活动数据源可用前，系统范围 GPU 活动遥测暂不可用。"
        ));
    }

    #[test]
    fn gpu_module_can_expose_gpu_power_without_claiming_gpu_activity() {
        let sample = PowermetricsHostSample {
            fan_rpm: None,
            cpu_power_mw: None,
            gpu_power_mw: Some(456.0),
            combined_power_mw: None,
            gpu_active_residency_percent: None,
            gpu_active_frequency_mhz: None,
        };
        let gpu = gpu_module_from_powermetrics(
            Some(&sample),
            None,
            &MetalCollectorScaffoldState {
                counter_path_available: false,
                execution_state: None,
            },
            &fixed_stamp(),
            &fixed_stamp(),
        );

        assert!(matches!(gpu.primary_metric, MetricState::Unavailable { reason, .. } if reason == "在可信的 GPU 活动数据源可用前，系统范围 GPU 活动遥测暂不可用。"));
        assert_eq!(gpu.secondary_metrics.len(), 2);
        assert_eq!(gpu.secondary_metrics[0].label, "GPU 功耗");
        assert_eq!(gpu.secondary_metrics[1].label, "GPU 计数器路径");
        assert!(matches!(gpu.secondary_metrics[0].metric, MetricState::Live { numeric_value: Some(value), unit: Some("watts"), .. } if (value - 0.456).abs() < 0.0001));
        assert!(matches!(&gpu.secondary_metrics[1].metric, MetricState::Unavailable { reason, .. } if reason == "当前主机未检测到受支持的 Metal 计数器集合。"));
    }

    #[test]
    fn gpu_module_can_expose_real_gpu_activity_from_powermetrics_residency() {
        let sample = PowermetricsHostSample {
            fan_rpm: None,
            cpu_power_mw: Some(865.0),
            gpu_power_mw: Some(161.0),
            combined_power_mw: Some(1026.0),
            gpu_active_residency_percent: Some(13.32),
            gpu_active_frequency_mhz: Some(817.0),
        };
        let gpu = gpu_module_from_powermetrics(
            Some(&sample),
            None,
            &MetalCollectorScaffoldState {
                counter_path_available: false,
                execution_state: None,
            },
            &fixed_stamp(),
            &fixed_stamp(),
        );

        assert!(matches!(gpu.primary_metric, MetricState::Live { numeric_value: Some(value), unit: Some("percent"), .. } if (value - 13.32).abs() < 0.0001));
        assert_eq!(gpu.secondary_metrics[0].label, "GPU 活动频率");
        assert_eq!(gpu.secondary_metrics[1].label, "GPU 功耗");
    }

    #[test]
    fn gpu_module_reports_counter_path_when_metal_counters_are_available() {
        let gpu = gpu_module_from_powermetrics(
            None,
            None,
            &MetalCollectorScaffoldState {
                counter_path_available: true,
                execution_state: Some(MetalCollectorExecutionState::Live("占位采样流程已完成".to_string())),
            },
            &fixed_stamp(),
            &fixed_stamp(),
        );

        assert!(!gpu.secondary_metrics.is_empty());
        assert_eq!(gpu.secondary_metrics[0].label, "GPU 计数器路径");
        assert!(matches!(&gpu.secondary_metrics[0].metric, MetricState::Live { value, .. } if value == "已检测到"));
    }

    #[test]
    fn gpu_module_reports_collector_execution_scaffold_when_counter_path_is_available() {
        let gpu = gpu_module_from_powermetrics(
            None,
            None,
            &MetalCollectorScaffoldState {
                counter_path_available: true,
                execution_state: Some(MetalCollectorExecutionState::Unavailable(
                    "当前已具备 Metal 计数器支持，但应用内采集骨架尚未真正执行命令通道。".to_string(),
                )),
            },
            &fixed_stamp(),
            &fixed_stamp(),
        );

        assert_eq!(gpu.secondary_metrics.len(), 2);
        assert_eq!(gpu.secondary_metrics[1].label, "采集流程执行状态");
        assert!(matches!(
            &gpu.secondary_metrics[1].metric,
            MetricState::Unavailable { reason, .. }
                if reason == "当前已具备 Metal 计数器支持，但应用内采集骨架尚未真正执行命令通道。"
        ));
    }
}
