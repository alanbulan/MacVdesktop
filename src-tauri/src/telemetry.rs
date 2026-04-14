use serde::Serialize;
use std::cmp::Ordering;
#[cfg(target_os = "macos")]
use std::process::Command;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use sysinfo::{Disks, Networks, ProcessesToUpdate, System, MINIMUM_CPU_UPDATE_INTERVAL};

#[cfg(target_os = "macos")]
use objc2_foundation::{NSError, NSProcessInfo, NSProcessInfoThermalState, NSString};
#[cfg(target_os = "macos")]
use objc2_metal::{
    MTLBlitCommandEncoder, MTLCommandBuffer, MTLCommandBufferStatus, MTLCommandEncoder,
    MTLCommandQueue, MTLCounterSampleBufferDescriptor, MTLCounterSamplingPoint,
    MTLCreateSystemDefaultDevice, MTLDevice, MTLStorageMode,
};

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

#[derive(Default)]
struct PowermetricsSmcSample {
    fan_rpm: Option<f64>,
    cpu_power_mw: Option<f64>,
    gpu_power_mw: Option<f64>,
}

fn timestamp() -> String {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::from_secs(0));

    duration.as_secs().to_string()
}

fn live_metric(value: String, numeric_value: Option<f64>, unit: Option<&'static str>) -> MetricState {
    MetricState::Live {
        source: "tauri-host",
        value,
        numeric_value,
        unit,
        updated_at: timestamp(),
        freshness: "fresh",
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
    summary: &'static str,
    reason: &'static str,
    x: i32,
    y: i32,
) -> TelemetryModuleSnapshot {
    TelemetryModuleSnapshot {
        id,
        name,
        summary: summary.to_string(),
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
    value: String,
    numeric_value: Option<f64>,
    unit: Option<&'static str>,
) -> TelemetrySecondaryMetric {
    TelemetrySecondaryMetric {
        id,
        label,
        metric: live_metric(value, numeric_value, unit),
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
            message: format!("{module_name} is in a critical state at {value}."),
        }],
        "warning" => vec![TelemetryAlert {
            id,
            severity: "warning",
            message: format!("{module_name} is above the warning threshold at {value}."),
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

#[cfg(any(test, target_os = "macos"))]
fn parse_first_number(input: &str) -> Option<f64> {
    input
        .split(|character: char| !(character.is_ascii_digit() || character == '.'))
        .find(|segment| !segment.is_empty())
        .and_then(|segment| segment.parse::<f64>().ok())
}

#[cfg(any(test, target_os = "macos"))]
fn parse_powermetrics_smc_output(output: &str) -> PowermetricsSmcSample {
    let mut sample = PowermetricsSmcSample::default();

    for line in output.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with("Fan:") {
            sample.fan_rpm = parse_first_number(trimmed);
        } else if trimmed.starts_with("CPU Power:") {
            sample.cpu_power_mw = parse_first_number(trimmed);
        } else if trimmed.starts_with("GPU Power:") {
            sample.gpu_power_mw = parse_first_number(trimmed);
        }
    }

    sample
}

#[cfg(target_os = "macos")]
fn sample_powermetrics_smc() -> Result<PowermetricsSmcSample, &'static str> {
    let output = Command::new("/usr/bin/powermetrics")
        .args(["-n", "1", "-i", "1", "--samplers", "smc"])
        .output()
        .map_err(|_| "powermetrics is not available on this Mac")?;

    if !output.status.success() {
        return Err("powermetrics requires elevated privileges or returned no usable data");
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_powermetrics_smc_output(&stdout))
}

#[cfg(not(target_os = "macos"))]
fn sample_powermetrics_smc() -> Result<PowermetricsSmcSample, &'static str> {
    Err("powermetrics is only available on macOS")
}

fn collect_cpu_usage(system: &mut System) -> f64 {
    system.refresh_cpu_usage();
    thread::sleep(MINIMUM_CPU_UPDATE_INTERVAL);
    system.refresh_cpu_usage();
    system.global_cpu_usage() as f64
}

fn collect_memory_module(system: &mut System) -> TelemetryModuleSnapshot {
    system.refresh_memory();

    let used_memory = system.used_memory();
    let total_memory = system.total_memory();
    let pressure = if total_memory == 0 {
        0.0
    } else {
        used_memory as f64 / total_memory as f64 * 100.0
    };
    let status = percent_status(pressure);
    let primary_value = format_percent(pressure);

    TelemetryModuleSnapshot {
        id: "memory-pressure",
        name: "Memory Pressure",
        summary: format!(
            "{} used out of {} total memory.",
            format_gigabytes(used_memory),
            format_gigabytes(total_memory),
        ),
        status,
        x: 2,
        y: 0,
        primary_metric: live_metric(primary_value.clone(), Some(pressure), Some("percent")),
        secondary_metrics: vec![secondary_metric(
            "memory-used",
            "Used memory",
            format_gigabytes(used_memory),
            Some(used_memory as f64),
            None,
        )],
        alerts: alerts_for_status("memory-pressure-alert", "Memory Pressure", status, &primary_value),
    }
}

fn collect_disk_module() -> TelemetryModuleSnapshot {
    let disks = Disks::new_with_refreshed_list();
    let total_space: u64 = disks.list().iter().map(|disk| disk.total_space()).sum();
    let available_space: u64 = disks.list().iter().map(|disk| disk.available_space()).sum();
    let used_space = total_space.saturating_sub(available_space);
    let usage_percent = if total_space == 0 {
        0.0
    } else {
        used_space as f64 / total_space as f64 * 100.0
    };
    let status = percent_status(usage_percent);
    let primary_value = format_percent(usage_percent);

    TelemetryModuleSnapshot {
        id: "disk-usage",
        name: "Disk Usage",
        summary: format!("{} free across mounted disks.", format_gigabytes(available_space)),
        status,
        x: 0,
        y: 1,
        primary_metric: live_metric(primary_value.clone(), Some(usage_percent), Some("percent")),
        secondary_metrics: vec![secondary_metric(
            "disk-free",
            "Free space",
            format_gigabytes(available_space),
            Some(available_space as f64),
            None,
        )],
        alerts: alerts_for_status("disk-usage-alert", "Disk Usage", status, &primary_value),
    }
}

fn collect_network_module() -> TelemetryModuleSnapshot {
    let mut networks = Networks::new_with_refreshed_list();
    thread::sleep(Duration::from_millis(250));
    let _ = networks.refresh(true);

    let bytes_delta: u64 = networks
        .iter()
        .map(|(_, network)| network.received() + network.transmitted())
        .sum();
    let kilobytes_per_second = bytes_delta as f64 / 1024.0 * 4.0;
    let status = if kilobytes_per_second >= 1024.0 {
        "warning"
    } else {
        "healthy"
    };
    let primary_value = format!("{kilobytes_per_second:.0} KB/s");

    TelemetryModuleSnapshot {
        id: "network-throughput",
        name: "Network Throughput",
        summary: format!("Sampled host network activity over {:.0} ms.", 250.0),
        status,
        x: 1,
        y: 1,
        primary_metric: live_metric(primary_value.clone(), Some(kilobytes_per_second), None),
        secondary_metrics: vec![],
        alerts: alerts_for_status(
            "network-throughput-alert",
            "Network Throughput",
            status,
            &primary_value,
        ),
    }
}

fn collect_top_process_module(system: &mut System) -> TelemetryModuleSnapshot {
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
        ("No process data".to_string(), 0.0)
    };
    let status = percent_status(cpu_percent);
    let primary_value = format_percent(cpu_percent);

    TelemetryModuleSnapshot {
        id: "top-process",
        name: "Top Process",
        summary: format!("Highest CPU consumer: {process_name}"),
        status,
        x: 2,
        y: 1,
        primary_metric: live_metric(primary_value.clone(), Some(cpu_percent), Some("percent")),
        secondary_metrics: vec![secondary_metric(
            "top-process-name",
            "Process name",
            process_name,
            None,
            None,
        )],
        alerts: alerts_for_status("top-process-alert", "Top Process", status, &primary_value),
    }
}

fn collect_cpu_module(system: &mut System) -> TelemetryModuleSnapshot {
    let cpu_usage = collect_cpu_usage(system);
    let logical_cores = system.cpus().len() as f64;
    let status = percent_status(cpu_usage);
    let primary_value = format_percent(cpu_usage);

    TelemetryModuleSnapshot {
        id: "cpu-cluster",
        name: "CPU Cluster",
        summary: format!("Host CPU usage sampled across {} logical cores.", system.cpus().len()),
        status,
        x: 0,
        y: 0,
        primary_metric: live_metric(primary_value.clone(), Some(cpu_usage), Some("percent")),
        secondary_metrics: vec![secondary_metric(
            "cpu-logical-cores",
            "Logical cores",
            format!("{}", system.cpus().len()),
            Some(logical_cores),
            Some("count"),
        )],
        alerts: alerts_for_status("cpu-cluster-alert", "CPU Cluster", status, &primary_value),
    }
}

#[cfg(target_os = "macos")]
fn collect_thermal_module() -> TelemetryModuleSnapshot {
    let process_info = NSProcessInfo::processInfo();
    let thermal_state = process_info.thermalState();

    let (value, status, summary) = if thermal_state == NSProcessInfoThermalState::Nominal {
        (
            "Nominal".to_string(),
            "healthy",
            "Thermal pressure is nominal according to NSProcessInfo.thermalState.".to_string(),
        )
    } else if thermal_state == NSProcessInfoThermalState::Fair {
        (
            "Fair".to_string(),
            "warning",
            "Thermal pressure is elevated but still manageable according to NSProcessInfo.thermalState.".to_string(),
        )
    } else if thermal_state == NSProcessInfoThermalState::Serious {
        (
            "Serious".to_string(),
            "critical",
            "Thermal pressure is serious according to NSProcessInfo.thermalState.".to_string(),
        )
    } else {
        (
            "Critical".to_string(),
            "critical",
            "Thermal pressure is critical according to NSProcessInfo.thermalState.".to_string(),
        )
    };

    TelemetryModuleSnapshot {
        id: "thermal-state",
        name: "Thermal State",
        summary,
        status,
        x: 0,
        y: 2,
        primary_metric: live_metric(value.clone(), None, Some("state")),
        secondary_metrics: vec![],
        alerts: alerts_for_status("thermal-state-alert", "Thermal State", status, &value),
    }
}

#[cfg(not(target_os = "macos"))]
fn collect_thermal_module() -> TelemetryModuleSnapshot {
    unavailable_module_with_reason(
        "thermal-state",
        "Thermal State",
        "Thermal telemetry remains unavailable until a macOS NSProcessInfo thermal collector is available.",
        "Apple-specific native telemetry collector is not implemented yet.",
        0,
        2,
    )
}

fn fan_module_from_powermetrics(
    sample: Option<&PowermetricsSmcSample>,
    failure_reason: Option<&'static str>,
) -> TelemetryModuleSnapshot {
    if let Some(sample) = sample {
        if let Some(fan_rpm) = sample.fan_rpm {
            let status = if fan_rpm >= 4500.0 {
                "warning"
            } else {
                "healthy"
            };
            let primary_value = format!("{fan_rpm:.0} rpm");

            return TelemetryModuleSnapshot {
                id: "fan-speed",
                name: "Fan Speed",
                summary: "Best-effort fan telemetry sampled from powermetrics SMC output.".to_string(),
                status,
                x: 1,
                y: 2,
                primary_metric: live_metric(primary_value.clone(), Some(fan_rpm), Some("rpm")),
                secondary_metrics: vec![],
                alerts: alerts_for_status("fan-speed-alert", "Fan Speed", status, &primary_value),
            };
        }

        return unavailable_module_with_reason(
            "fan-speed",
            "Fan Speed",
            "powermetrics did not expose fan speed in its SMC output.",
            "powermetrics did not expose fan speed in its SMC output.",
            1,
            2,
        );
    }

    unavailable_module_with_reason(
        "fan-speed",
        "Fan Speed",
        "powermetrics fan telemetry is unavailable.",
        failure_reason.unwrap_or("powermetrics fan telemetry is unavailable."),
        1,
        2,
    )
}

fn power_module_from_powermetrics(
    sample: Option<&PowermetricsSmcSample>,
    failure_reason: Option<&'static str>,
) -> TelemetryModuleSnapshot {
    if let Some(sample) = sample {
        if let Some(cpu_power_mw) = sample.cpu_power_mw {
            let gpu_power_mw = sample.gpu_power_mw;
            let total_power_mw = cpu_power_mw + gpu_power_mw.unwrap_or(0.0);
            let cpu_power_watts = cpu_power_mw / 1000.0;
            let gpu_power_watts = gpu_power_mw.map(|value| value / 1000.0);
            let total_power_watts = total_power_mw / 1000.0;
            let status = if total_power_mw >= 15000.0 {
                "warning"
            } else {
                "healthy"
            };
            let primary_value = format!("{total_power_watts:.1} W");
            let mut secondary_metrics = vec![secondary_metric(
                "cpu-power",
                "CPU power",
                format!("{cpu_power_watts:.1} W"),
                Some(cpu_power_watts),
                Some("watts"),
            )];

            if let Some(gpu_power) = gpu_power_watts {
                secondary_metrics.push(secondary_metric(
                    "gpu-power",
                    "GPU power",
                    format!("{gpu_power:.1} W"),
                    Some(gpu_power),
                    Some("watts"),
                ));
            }

            return TelemetryModuleSnapshot {
                id: "power-draw",
                name: "Power Draw",
                summary: "Best-effort power telemetry sampled from powermetrics SMC output.".to_string(),
                status,
                x: 2,
                y: 2,
                primary_metric: live_metric(primary_value.clone(), Some(total_power_watts), Some("watts")),
                secondary_metrics,
                alerts: alerts_for_status("power-draw-alert", "Power Draw", status, &primary_value),
            };
        }

        return unavailable_module_with_reason(
            "power-draw",
            "Power Draw",
            "powermetrics did not expose CPU package power in its SMC output.",
            "powermetrics did not expose CPU package power in its SMC output.",
            2,
            2,
        );
    }

    unavailable_module_with_reason(
        "power-draw",
        "Power Draw",
        "powermetrics power telemetry is unavailable.",
        failure_reason.unwrap_or("powermetrics power telemetry is unavailable."),
        2,
        2,
    )
}

#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
enum MetalCollectorExecutionState {
    Live(String),
    Unavailable(String),
}

struct MetalCollectorScaffoldState {
    counter_path_available: bool,
    execution_state: Option<MetalCollectorExecutionState>,
}

#[cfg(target_os = "macos")]
fn ns_error_description(error: &NSError) -> String {
    error.localizedDescription().to_string()
}

#[cfg(target_os = "macos")]
fn try_run_metal_placeholder_counter_pass() -> Result<String, String> {
    let device = MTLCreateSystemDefaultDevice()
        .ok_or_else(|| "Metal is unavailable on this Mac.".to_string())?;

    if !device.supportsCounterSampling(MTLCounterSamplingPoint::AtBlitBoundary) {
        return Err("This Mac does not support counter sampling at blit boundaries.".to_string());
    }

    let counter_sets = device
        .counterSets()
        .ok_or_else(|| "Metal did not expose any counter sets for this device.".to_string())?;

    if counter_sets.count() == 0 {
        return Err("Metal did not expose any counter sets for this device.".to_string());
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
        .ok_or_else(|| "Metal failed to create a command queue for the placeholder pass.".to_string())?;

    let command_buffer = command_queue
        .commandBuffer()
        .ok_or_else(|| "Metal failed to create a command buffer for the placeholder pass.".to_string())?;

    let blit_encoder = command_buffer
        .blitCommandEncoder()
        .ok_or_else(|| "Metal failed to create a blit encoder for the placeholder pass.".to_string())?;

    unsafe {
        blit_encoder.sampleCountersInBuffer_atSampleIndex_withBarrier(&sample_buffer, 0, true);
    }
    blit_encoder.endEncoding();
    command_buffer.commit();
    command_buffer.waitUntilCompleted();

    match command_buffer.status() {
        MTLCommandBufferStatus::Completed => Ok("Placeholder pass completed".to_string()),
        MTLCommandBufferStatus::Error => Err(command_buffer
            .error()
            .map(|error| ns_error_description(&error))
            .unwrap_or_else(|| "Metal placeholder pass failed during command buffer execution.".to_string())),
        status => Err(format!("Metal placeholder pass ended in unexpected status {}.", status.0)),
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

fn gpu_module_from_powermetrics(
    sample: Option<&PowermetricsSmcSample>,
    failure_reason: Option<&'static str>,
    metal_scaffold_state: &MetalCollectorScaffoldState,
) -> TelemetryModuleSnapshot {
    let mut module = unavailable_module_with_reason(
        "gpu-activity",
        "GPU Activity",
        "System-wide GPU activity is unavailable without attaching Metal counters to an app-owned command pass.",
        "System-wide GPU activity telemetry is unavailable without an app-owned Metal counter pass.",
        1,
        0,
    );

    let mut secondary_metrics = vec![if metal_scaffold_state.counter_path_available {
        TelemetrySecondaryMetric {
            id: "gpu-counter-path",
            label: "GPU counter path",
            metric: live_metric("Detected".to_string(), None, None),
        }
    } else {
        TelemetrySecondaryMetric {
            id: "gpu-counter-path",
            label: "GPU counter path",
            metric: unavailable_metric("Supported Metal counter sets were not detected on this host."),
        }
    }];

    if let Some(execution_state) = &metal_scaffold_state.execution_state {
        secondary_metrics.push(TelemetrySecondaryMetric {
            id: "gpu-collector-execution",
            label: "Collector execution",
            metric: match execution_state {
                MetalCollectorExecutionState::Live(value) => live_metric(value.clone(), None, None),
                MetalCollectorExecutionState::Unavailable(reason) => unavailable_metric(reason.clone()),
            },
        });

        module.summary = match execution_state {
            MetalCollectorExecutionState::Live(_) => "System-wide GPU activity remains unavailable, but an app-owned placeholder counter pass completed successfully on the Metal collector path.".to_string(),
            MetalCollectorExecutionState::Unavailable(_) => "System-wide GPU activity remains unavailable after attempting an app-owned Metal placeholder counter pass.".to_string(),
        };
    }

    if let Some(sample) = sample {
        if let Some(gpu_power_mw) = sample.gpu_power_mw {
            let gpu_power_watts = gpu_power_mw / 1000.0;
            module.summary = match metal_scaffold_state.execution_state {
                Some(MetalCollectorExecutionState::Live(_)) => "System-wide GPU activity remains unavailable, but GPU power was sampled from powermetrics SMC output while an app-owned placeholder counter pass completed successfully.".to_string(),
                Some(MetalCollectorExecutionState::Unavailable(_)) => "System-wide GPU activity remains unavailable, but GPU power was sampled from powermetrics SMC output after an app-owned Metal placeholder counter pass attempt failed.".to_string(),
                None => "System-wide GPU activity remains unavailable, but GPU power was sampled from powermetrics SMC output.".to_string(),
            };
            secondary_metrics.insert(
                0,
                secondary_metric(
                    "gpu-power",
                    "GPU power",
                    format!("{gpu_power_watts:.1} W"),
                    Some(gpu_power_watts),
                    Some("watts"),
                ),
            );
        }
    }

    if let Some(reason) = failure_reason {
        secondary_metrics.push(TelemetrySecondaryMetric {
            id: "gpu-power-source",
            label: "GPU power source",
            metric: unavailable_metric(reason),
        });
    }

    module.secondary_metrics = secondary_metrics;
    module
}

fn collect_gpu_fan_and_power_modules() -> (TelemetryModuleSnapshot, TelemetryModuleSnapshot, TelemetryModuleSnapshot) {
    let metal_scaffold_state = detect_metal_collector_scaffold_state();

    match sample_powermetrics_smc() {
        Ok(sample) => (
            gpu_module_from_powermetrics(Some(&sample), None, &metal_scaffold_state),
            fan_module_from_powermetrics(Some(&sample), None),
            power_module_from_powermetrics(Some(&sample), None),
        ),
        Err(reason) => (
            gpu_module_from_powermetrics(None, Some(reason), &metal_scaffold_state),
            fan_module_from_powermetrics(None, Some(reason)),
            power_module_from_powermetrics(None, Some(reason)),
        ),
    }
}

pub fn collect_telemetry_snapshot() -> TelemetrySnapshot {
    let mut system = System::new_all();
    let (gpu_module, fan_module, power_module) = collect_gpu_fan_and_power_modules();

    TelemetrySnapshot {
        runtime: TelemetryRuntime { kind: "tauri" },
        modules: vec![
            collect_cpu_module(&mut system),
            gpu_module,
            collect_memory_module(&mut system),
            collect_disk_module(),
            collect_network_module(),
            collect_top_process_module(&mut system),
            collect_thermal_module(),
            fan_module,
            power_module,
        ],
    }
}

#[tauri::command]
pub fn get_telemetry_snapshot() -> TelemetrySnapshot {
    collect_telemetry_snapshot()
}

#[cfg(test)]
mod tests {
    use super::{
        alerts_for_status, collect_telemetry_snapshot, fan_module_from_powermetrics,
        gpu_module_from_powermetrics, normalize_process_cpu, parse_powermetrics_smc_output,
        power_module_from_powermetrics, MetalCollectorExecutionState, MetalCollectorScaffoldState,
        MetricState, PowermetricsSmcSample,
    };

    #[test]
    fn snapshot_covers_expected_module_ids() {
        let snapshot = collect_telemetry_snapshot();
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
    fn snapshot_marks_supported_host_metrics_as_live_and_apple_specific_metrics_as_unavailable() {
        let snapshot = collect_telemetry_snapshot();

        let cpu_cluster = snapshot.modules.iter().find(|module| module.id == "cpu-cluster").unwrap();
        let memory_pressure = snapshot.modules.iter().find(|module| module.id == "memory-pressure").unwrap();
        let disk_usage = snapshot.modules.iter().find(|module| module.id == "disk-usage").unwrap();
        let network_throughput = snapshot.modules.iter().find(|module| module.id == "network-throughput").unwrap();
        let top_process = snapshot.modules.iter().find(|module| module.id == "top-process").unwrap();
        let gpu_activity = snapshot.modules.iter().find(|module| module.id == "gpu-activity").unwrap();
        let thermal_state = snapshot.modules.iter().find(|module| module.id == "thermal-state").unwrap();
        let fan_speed = snapshot.modules.iter().find(|module| module.id == "fan-speed").unwrap();
        let power_draw = snapshot.modules.iter().find(|module| module.id == "power-draw").unwrap();

        assert!(matches!(cpu_cluster.primary_metric, MetricState::Live { .. }));
        assert!(matches!(memory_pressure.primary_metric, MetricState::Live { .. }));
        assert!(matches!(disk_usage.primary_metric, MetricState::Live { .. }));
        assert!(matches!(network_throughput.primary_metric, MetricState::Live { .. }));
        assert!(matches!(top_process.primary_metric, MetricState::Live { .. }));
        #[cfg(target_os = "macos")]
        assert!(matches!(thermal_state.primary_metric, MetricState::Live { .. }));
        #[cfg(not(target_os = "macos"))]
        assert!(matches!(thermal_state.primary_metric, MetricState::Unavailable { .. }));
        assert!(matches!(gpu_activity.primary_metric, MetricState::Unavailable { .. }));
        assert!(matches!(fan_speed.primary_metric, MetricState::Unavailable { .. } | MetricState::Live { .. }));
        assert!(matches!(power_draw.primary_metric, MetricState::Unavailable { .. } | MetricState::Live { .. }));
    }

    #[test]
    fn normalize_process_cpu_scales_to_host_capacity() {
        assert_eq!(normalize_process_cpu(240.0, 8), 30.0);
        assert_eq!(normalize_process_cpu(400.0, 4), 100.0);
    }

    #[test]
    fn warning_status_produces_alert() {
        let alerts = alerts_for_status("cpu-high-usage", "CPU Cluster", "warning", "82%");

        assert_eq!(alerts.len(), 1);
        assert_eq!(alerts[0].severity, "warning");
        assert!(alerts[0].message.contains("CPU Cluster"));
    }

    #[test]
    fn parse_powermetrics_smc_output_extracts_fan_and_power_metrics() {
        let sample = parse_powermetrics_smc_output(
            "**** SMC sensors ****\nFan: 2001.43 rpm\nCPU die temperature: 65.77 C\nGPU die temperature: 58.00 C\nCPU Power: 1234 mW\nGPU Power: 456 mW\n",
        );

        assert_eq!(sample.fan_rpm, Some(2001.43));
        assert_eq!(sample.cpu_power_mw, Some(1234.0));
        assert_eq!(sample.gpu_power_mw, Some(456.0));
    }

    #[test]
    fn powermetrics_failure_reason_is_propagated_to_fan_and_power_modules() {
        let fan = fan_module_from_powermetrics(None, Some("powermetrics requires elevated privileges or returned no usable data"));
        let power = power_module_from_powermetrics(None, Some("powermetrics requires elevated privileges or returned no usable data"));

        assert!(matches!(fan.primary_metric, MetricState::Unavailable { reason, .. } if reason == "powermetrics requires elevated privileges or returned no usable data"));
        assert!(matches!(power.primary_metric, MetricState::Unavailable { reason, .. } if reason == "powermetrics requires elevated privileges or returned no usable data"));
    }

    #[test]
    fn fan_module_reports_missing_powermetrics_field_truthfully() {
        let fan = fan_module_from_powermetrics(
            Some(&PowermetricsSmcSample {
                fan_rpm: None,
                cpu_power_mw: Some(1234.0),
                gpu_power_mw: None,
            }),
            None,
        );

        assert!(matches!(
            fan.primary_metric,
            MetricState::Unavailable { reason, .. }
                if reason == "powermetrics did not expose fan speed in its SMC output."
        ));
    }

    #[test]
    fn power_module_reports_missing_powermetrics_field_truthfully() {
        let power = power_module_from_powermetrics(
            Some(&PowermetricsSmcSample {
                fan_rpm: None,
                cpu_power_mw: None,
                gpu_power_mw: Some(456.0),
            }),
            None,
        );

        assert!(matches!(
            power.primary_metric,
            MetricState::Unavailable { reason, .. }
                if reason == "powermetrics did not expose CPU package power in its SMC output."
        ));
    }

    #[test]
    fn power_module_reports_watt_units_with_watt_numeric_values() {
        let power = power_module_from_powermetrics(
            Some(&PowermetricsSmcSample {
                fan_rpm: None,
                cpu_power_mw: Some(1234.0),
                gpu_power_mw: Some(456.0),
            }),
            None,
        );

        assert!(matches!(
            power.primary_metric,
            MetricState::Live {
                numeric_value: Some(value),
                unit: Some("watts"),
                ..
            } if (value - 1.69).abs() < 0.0001
        ));
        assert!(matches!(
            power.secondary_metrics[0].metric,
            MetricState::Live {
                numeric_value: Some(value),
                unit: Some("watts"),
                ..
            } if (value - 1.234).abs() < 0.0001
        ));
        assert!(matches!(
            power.secondary_metrics[1].metric,
            MetricState::Live {
                numeric_value: Some(value),
                unit: Some("watts"),
                ..
            } if (value - 0.456).abs() < 0.0001
        ));
    }

    #[test]
    fn gpu_module_keeps_primary_unavailable_reason_focused_on_activity_gap() {
        let gpu = gpu_module_from_powermetrics(
            None,
            Some("powermetrics requires elevated privileges or returned no usable data"),
            &MetalCollectorScaffoldState {
                counter_path_available: false,
                execution_state: None,
            },
        );

        assert!(matches!(
            gpu.primary_metric,
            MetricState::Unavailable { reason, .. }
                if reason == "System-wide GPU activity telemetry is unavailable without an app-owned Metal counter pass."
        ));
    }

    #[test]
    fn gpu_module_can_expose_gpu_power_without_claiming_gpu_activity() {
        let sample = PowermetricsSmcSample {
            fan_rpm: None,
            cpu_power_mw: None,
            gpu_power_mw: Some(456.0),
        };
        let gpu = gpu_module_from_powermetrics(
            Some(&sample),
            None,
            &MetalCollectorScaffoldState {
                counter_path_available: false,
                execution_state: None,
            },
        );

        assert!(matches!(gpu.primary_metric, MetricState::Unavailable { reason, .. } if reason == "System-wide GPU activity telemetry is unavailable without an app-owned Metal counter pass."));
        assert_eq!(gpu.secondary_metrics.len(), 2);
        assert_eq!(gpu.secondary_metrics[0].label, "GPU power");
        assert_eq!(gpu.secondary_metrics[1].label, "GPU counter path");
        assert!(matches!(gpu.secondary_metrics[0].metric, MetricState::Live { numeric_value: Some(value), unit: Some("watts"), .. } if (value - 0.456).abs() < 0.0001));
        assert!(matches!(&gpu.secondary_metrics[1].metric, MetricState::Unavailable { reason, .. } if reason == "Supported Metal counter sets were not detected on this host."));
        assert!(gpu.summary.contains("GPU power"));
        assert!(!gpu.summary.contains("collector scaffold"));
    }

    #[test]
    fn gpu_module_reports_counter_path_when_metal_counters_are_available() {
        let gpu = gpu_module_from_powermetrics(
            None,
            None,
            &MetalCollectorScaffoldState {
                counter_path_available: true,
                execution_state: Some(MetalCollectorExecutionState::Live("Placeholder pass completed".to_string())),
            },
        );

        assert!(!gpu.secondary_metrics.is_empty());
        assert_eq!(gpu.secondary_metrics[0].label, "GPU counter path");
        assert!(matches!(&gpu.secondary_metrics[0].metric, MetricState::Live { value, .. } if value == "Detected"));
    }

    #[test]
    fn gpu_module_reports_counter_path_gap_without_execution_language() {
        let gpu = gpu_module_from_powermetrics(
            None,
            None,
            &MetalCollectorScaffoldState {
                counter_path_available: false,
                execution_state: None,
            },
        );

        assert!(matches!(
            &gpu.secondary_metrics[0].metric,
            MetricState::Unavailable { reason, .. }
                if reason == "Supported Metal counter sets were not detected on this host."
        ));
    }

    #[test]
    fn gpu_module_reports_collector_execution_scaffold_when_counter_path_is_available() {
        let gpu = gpu_module_from_powermetrics(
            None,
            None,
            &MetalCollectorScaffoldState {
                counter_path_available: true,
                execution_state: Some(MetalCollectorExecutionState::Unavailable(
                    "Metal counter support is available, but the app-owned collector scaffold is not executing a command pass yet.".to_string(),
                )),
            },
        );

        assert_eq!(gpu.secondary_metrics.len(), 2);
        assert_eq!(gpu.secondary_metrics[1].label, "Collector execution");
        assert!(matches!(
            &gpu.secondary_metrics[1].metric,
            MetricState::Unavailable { reason, .. }
                if reason == "Metal counter support is available, but the app-owned collector scaffold is not executing a command pass yet."
        ));
        assert!(gpu.summary.contains("after attempting an app-owned Metal placeholder counter pass"));
    }

    #[test]
    fn gpu_module_reports_live_collector_execution_when_placeholder_pass_completes() {
        let gpu = gpu_module_from_powermetrics(
            None,
            None,
            &MetalCollectorScaffoldState {
                counter_path_available: true,
                execution_state: Some(MetalCollectorExecutionState::Live("Placeholder pass completed".to_string())),
            },
        );

        assert_eq!(gpu.secondary_metrics.len(), 2);
        assert_eq!(gpu.secondary_metrics[1].label, "Collector execution");
        assert!(matches!(
            &gpu.secondary_metrics[1].metric,
            MetricState::Live { value, .. } if value == "Placeholder pass completed"
        ));
        assert!(gpu.summary.contains("placeholder counter pass"));
    }

    #[test]
    fn gpu_module_propagates_powermetrics_failure_reason_when_no_sample_exists() {
        let gpu = gpu_module_from_powermetrics(
            None,
            Some("powermetrics requires elevated privileges or returned no usable data"),
            &MetalCollectorScaffoldState {
                counter_path_available: false,
                execution_state: None,
            },
        );

        assert!(matches!(gpu.primary_metric, MetricState::Unavailable { reason, .. } if reason == "System-wide GPU activity telemetry is unavailable without an app-owned Metal counter pass."));
        assert_eq!(gpu.secondary_metrics.len(), 2);
        assert_eq!(gpu.secondary_metrics[0].label, "GPU counter path");
        assert_eq!(gpu.secondary_metrics[1].label, "GPU power source");
        assert!(matches!(&gpu.secondary_metrics[0].metric, MetricState::Unavailable { reason, .. } if reason == "Supported Metal counter sets were not detected on this host."));
        assert!(matches!(&gpu.secondary_metrics[1].metric, MetricState::Unavailable { reason, .. } if reason == "powermetrics requires elevated privileges or returned no usable data"));
    }
}
