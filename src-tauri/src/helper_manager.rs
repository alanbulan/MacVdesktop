use crate::telemetry::{helper_output_path, PowermetricsHelperPayload, PrivilegedHelperStatus};
use std::fs;
use std::process::Command;

fn helper_process_running() -> bool {
    Command::new("/bin/sh")
        .args(["-c", "ps -ef | egrep 'powermetrics_helper.py|npm run powermetrics:helper' | grep -v egrep >/dev/null"])
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

pub fn helper_status() -> PrivilegedHelperStatus {
    let path = match helper_output_path() {
        Ok(path) => path,
        Err(reason) => {
            return PrivilegedHelperStatus {
                state: "failed",
                message: reason,
                updated_at: None,
            }
        }
    };

    if path.exists() {
        if let Ok(raw) = fs::read_to_string(&path) {
            if let Ok(payload) = serde_json::from_str::<PowermetricsHelperPayload>(&raw) {
                let state = if helper_process_running() { "running" } else { "stale" };
                return PrivilegedHelperStatus {
                    state,
                    message: if state == "running" {
                        "高权限遥测服务正在运行。".to_string()
                    } else {
                        "高权限遥测样本存在，但 helper 当前未运行。".to_string()
                    },
                    updated_at: Some(payload.updated_at),
                };
            }
        }
    }

    if helper_process_running() {
        return PrivilegedHelperStatus {
            state: "starting",
            message: "高权限遥测服务正在启动。".to_string(),
            updated_at: None,
        };
    }

    PrivilegedHelperStatus {
        state: "authorization_required",
        message: "需要启用高权限宿主遥测才能持续读取 GPU/功耗数据。".to_string(),
        updated_at: None,
    }
}

pub fn start_privileged_helper() -> Result<PrivilegedHelperStatus, String> {
    let command = format!(
        "cd '{}' && nohup npm run powermetrics:helper >/tmp/macvdesktop-powermetrics-helper.log 2>&1 &",
        std::env::current_dir()
            .map_err(|_| "无法定位项目目录。".to_string())?
            .display()
    );

    let status = Command::new("osascript")
        .args([
            "-e",
            &format!("do shell script {} with administrator privileges", serde_json::to_string(&command).map_err(|_| "无法构造授权命令。".to_string())?),
        ])
        .status()
        .map_err(|error| format!("无法触发系统授权流程：{error}"))?;

    if !status.success() {
        return Err("系统授权流程未成功完成。".to_string());
    }

    Ok(helper_status())
}

pub fn stop_privileged_helper() -> Result<PrivilegedHelperStatus, String> {
    let command = "pkill -f 'powermetrics_helper.py|npm run powermetrics:helper' || true";
    let status = Command::new("osascript")
        .args([
            "-e",
            &format!("do shell script {} with administrator privileges", serde_json::to_string(command).map_err(|_| "无法构造停止命令。".to_string())?),
        ])
        .status()
        .map_err(|error| format!("无法触发系统授权流程：{error}"))?;

    if !status.success() {
        return Err("系统授权流程未成功完成。".to_string());
    }

    Ok(helper_status())
}
