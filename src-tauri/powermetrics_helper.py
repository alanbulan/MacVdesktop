#!/usr/bin/env python3
import json
import os
import re
import signal
import subprocess
import sys
import time
from pathlib import Path

OUTPUT_PATH = Path.home() / '.local' / 'state' / 'macvdesktop' / 'powermetrics.json'
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

PATTERNS = {
    'fan_rpm': re.compile(r'^Fan:\s*([0-9.]+)\s*rpm$', re.I),
    'cpu_power_mw': re.compile(r'^CPU Power:\s*([0-9.]+)\s*mW$', re.I),
    'gpu_power_mw': re.compile(r'^GPU Power:\s*([0-9.]+)\s*mW$', re.I),
    'combined_power_mw': re.compile(r'^Combined Power .*:\s*([0-9.]+)\s*mW$', re.I),
    'gpu_active_frequency_mhz': re.compile(r'^GPU HW active frequency:\s*([0-9.]+)\s*MHz$', re.I),
    'gpu_active_residency_percent': re.compile(r'^GPU HW active residency:\s*([0-9.]+)%', re.I),
}

running = True


def handle_stop(_signum, _frame):
    global running
    running = False


signal.signal(signal.SIGINT, handle_stop)
signal.signal(signal.SIGTERM, handle_stop)


def parse_output(text: str) -> dict:
    sample: dict[str, float] = {}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        for key, pattern in PATTERNS.items():
            match = pattern.match(line)
            if match:
                sample[key] = float(match.group(1))
    return sample


while running:
    started_at = int(time.time())
    try:
        completed = subprocess.run(
            ['/usr/bin/powermetrics', '-n', '1', '-i', '1000', '--samplers', 'cpu_power,gpu_power'],
            capture_output=True,
            text=True,
            check=False,
        )
        payload = {
            'updated_at': str(started_at),
            'ok': completed.returncode == 0,
            'sample': parse_output(completed.stdout),
            'stderr': completed.stderr.strip(),
        }
        tmp_path = OUTPUT_PATH.with_suffix('.json.tmp')
        tmp_path.write_text(json.dumps(payload), encoding='utf-8')
        tmp_path.replace(OUTPUT_PATH)
    except Exception as exc:  # pragma: no cover - defensive helper path
        payload = {
            'updated_at': str(started_at),
            'ok': False,
            'sample': {},
            'stderr': str(exc),
        }
        tmp_path = OUTPUT_PATH.with_suffix('.json.tmp')
        tmp_path.write_text(json.dumps(payload), encoding='utf-8')
        tmp_path.replace(OUTPUT_PATH)

    time.sleep(1)

sys.exit(0)
