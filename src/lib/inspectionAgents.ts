import { telemetryChamberLayout } from '../domain/telemetry/layout'
import type { DashboardModule, InspectionAgent } from '../types'

const ROLE_SEQUENCE: ReadonlyArray<InspectionAgent['role']> = ['admin', 'engineer', 'security', 'courier']

function getTask(module: DashboardModule, phase: number): string {
  if (module.primaryMetric.state === 'live') {
    const liveTasks = [`巡检 ${module.name}`, `校准 ${module.name}`, `复核 ${module.name}`, `同步 ${module.name}`] as const
    return liveTasks[phase % liveTasks.length]
  }

  if (module.primaryMetric.state === 'loading') {
    return `等待 ${module.name}`
  }

  return `排查 ${module.name}`
}

function getDetail(module: DashboardModule, phase: number): string {
  if (module.primaryMetric.state === 'live') {
    const freshnessLabel = module.primaryMetric.freshness === 'fresh' ? 'fresh' : 'stale'
    const alertLabel = module.alerts.length > 0 ? module.alerts[0].message : '无宿主告警'
    const liveDetails = [
      `主指标 ${module.primaryMetric.value} · ${freshnessLabel} · ${alertLabel}`,
      `更新时间 ${module.primaryMetric.updatedAt} · 主指标 ${module.primaryMetric.value}`,
      `来源 ${module.primaryMetric.source} · 主指标 ${module.primaryMetric.value}`,
      `扫描 ${module.name} 协同路径 · 主指标 ${module.primaryMetric.value}`,
    ] as const
    return liveDetails[phase % liveDetails.length]
  }

  if (module.primaryMetric.state === 'loading') {
    return module.primaryMetric.reason ?? '等待宿主遥测快照'
  }

  if (module.primaryMetric.state === 'error') {
    return module.primaryMetric.reason
  }

  return module.primaryMetric.reason
}

function getStatus(module: DashboardModule, phase: number): InspectionAgent['status'] {
  if (module.primaryMetric.state === 'loading') {
    return 'moving'
  }

  if (module.status === 'warning' || module.status === 'critical') {
    return phase % 3 === 1 ? 'moving' : 'working'
  }

  return phase % 5 === 2 || phase % 5 === 3 ? 'moving' : phase % 5 === 4 ? 'working' : 'idle'
}

export function createInspectionAgents(modules: ReadonlyArray<DashboardModule>, phase = 0): InspectionAgent[] {
  const patrolSteps = [
    { x: -0.75, y: 0.6 },
    { x: -0.15, y: 1.05 },
    { x: 0.45, y: 0.8 },
    { x: 0.1, y: 1.25 },
  ] as const

  return modules.map((module, index) => {
    const patrolStep = patrolSteps[(phase + index) % patrolSteps.length]
    const spreadX = ((index % 4) - 1.5) * 0.22
    const spreadY = Math.floor(index / 4) * 0.08

    return {
      id: `inspection-agent-${module.id}`,
      name: module.name,
      task: getTask(module, phase + index),
      detail: getDetail(module, phase + index),
      role: ROLE_SEQUENCE[index % ROLE_SEQUENCE.length],
      x: telemetryChamberLayout.anchorX + module.x * telemetryChamberLayout.spacing + patrolStep.x + spreadX,
      y: telemetryChamberLayout.anchorY + module.y * telemetryChamberLayout.spacing + patrolStep.y + spreadY,
      status: getStatus(module, phase),
    }
  })
}
