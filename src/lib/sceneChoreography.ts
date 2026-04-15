import { getTelemetryModuleCenter, getTelemetryModuleLogicalCenter } from '../domain/telemetry/layout'
import type { DashboardModule, InspectionAgent } from '../types'

export interface FactoryAgentIntent {
  id: string
  name: string
  role: InspectionAgent['role']
  x: number
  y: number
  status: InspectionAgent['status']
  task: string
  detail: string
}

interface PatrolLaneOffset {
  x: number
  y: number
}

const roleSequence: ReadonlyArray<InspectionAgent['role']> = ['admin', 'engineer', 'security', 'courier']
const patrolLaneOffsets: ReadonlyArray<PatrolLaneOffset> = [
  { x: -0.92, y: 0.4 },
  { x: -0.4, y: 0.92 },
  { x: 0.48, y: 0.78 },
  { x: 0.82, y: 0.18 },
  { x: 0.28, y: -0.3 },
  { x: -0.36, y: -0.18 },
]

function formatFreshnessLabel(freshness: 'fresh' | 'stale') {
  return freshness === 'fresh' ? '实时' : '缓存'
}

function formatUpdatedAt(updatedAt: string): string {
  const asNumber = Number(updatedAt)

  if (!Number.isNaN(asNumber) && updatedAt.trim() !== '') {
    return new Date(asNumber * 1000).toLocaleString('zh-CN', { hour12: false })
  }

  const parsed = new Date(updatedAt)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString('zh-CN', { hour12: false })
  }

  return updatedAt
}

function getTask(module: DashboardModule, phase: number, role: InspectionAgent['role']) {
  if (module.status === 'critical') {
    return role === 'courier' ? `紧急转运 ${module.name}` : `压制 ${module.name}`
  }

  if (module.status === 'warning') {
    return role === 'admin' ? `复核 ${module.name}` : `检修 ${module.name}`
  }

  if (module.primaryMetric.state === 'loading') {
    return `等待 ${module.name}`
  }

  if (module.primaryMetric.state === 'unavailable') {
    return `排查 ${module.name}`
  }

  const liveTasks = role === 'courier'
    ? [`转运 ${module.name}`, `巡送 ${module.name}`]
    : role === 'security'
      ? [`守望 ${module.name}`, `压测 ${module.name}`]
      : role === 'admin'
        ? [`调度 ${module.name}`, `统筹 ${module.name}`]
        : [`巡检 ${module.name}`, `校准 ${module.name}`, `复核 ${module.name}`, `同步 ${module.name}`]

  return liveTasks[phase % liveTasks.length]
}

function getDetail(module: DashboardModule, phase: number) {
  if (module.primaryMetric.state === 'live') {
    const alertLabel = module.alerts.length > 0 ? module.alerts[0].message : '无宿主告警'
    const freshnessLabel = formatFreshnessLabel(module.primaryMetric.freshness)

    if (module.status === 'critical') {
      return `主指标 ${module.primaryMetric.value} · ${alertLabel}`
    }

    const liveDetails = [
      `主指标 ${module.primaryMetric.value} · ${freshnessLabel} · ${alertLabel}`,
      `更新时间 ${formatUpdatedAt(module.primaryMetric.updatedAt)} · 主指标 ${module.primaryMetric.value}`,
      `来源 ${module.primaryMetric.source} · 主指标 ${module.primaryMetric.value}`,
      `工位 ${module.name} 已接入主数据流 · 主指标 ${module.primaryMetric.value}`,
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
  if (module.status === 'critical') {
    return phase % 2 === 0 ? 'working' : 'moving'
  }

  if (module.status === 'warning') {
    return phase % 3 === 0 ? 'working' : 'moving'
  }

  if (module.primaryMetric.state === 'loading') {
    return 'moving'
  }

  return phase % 6 === 4 ? 'working' : phase % 6 === 5 ? 'moving' : 'idle'
}

function getRoutePoint(module: DashboardModule, phase: number, index: number) {
  const center = getTelemetryModuleCenter(module)
  const logicalCenter = getTelemetryModuleLogicalCenter(module)
  const route = [
    { x: center.x - 110, y: center.y + 36, logicalX: logicalCenter.x - 1.32, logicalY: logicalCenter.y + 0.43 },
    { x: center.x - 42, y: center.y + 88, logicalX: logicalCenter.x - 0.5, logicalY: logicalCenter.y + 1.05 },
    { x: center.x + 54, y: center.y + 62, logicalX: logicalCenter.x + 0.64, logicalY: logicalCenter.y + 0.74 },
    { x: center.x + 102, y: center.y + 10, logicalX: logicalCenter.x + 1.22, logicalY: logicalCenter.y + 0.12 },
  ] as const
  const laneOffset = patrolLaneOffsets[(phase + index) % patrolLaneOffsets.length]
  const beltShift = (phase % 3) * 0.05 - 0.05
  const selected = route[(phase + index) % route.length]

  return {
    x: selected.logicalX + laneOffset.x * 0.06 + beltShift,
    y: selected.logicalY + laneOffset.y * 0.04,
  }
}

export function createFactoryAgentIntents(modules: ReadonlyArray<DashboardModule>, phase = 0): FactoryAgentIntent[] {
  return modules.map((module, index) => {
    const role = roleSequence[index % roleSequence.length]
    const position = getRoutePoint(module, phase, index)

    return {
      id: `inspection-agent-${module.id}`,
      name: module.name,
      role,
      x: position.x,
      y: position.y,
      status: getStatus(module, phase),
      task: getTask(module, phase + index, role),
      detail: getDetail(module, phase + index),
    }
  })
}
