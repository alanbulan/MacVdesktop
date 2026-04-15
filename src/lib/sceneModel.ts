import { getTelemetryModuleCenter } from '../domain/telemetry/layout'
import type { DashboardModule } from '../types'

export interface FactoryZone {
  id: 'compute-hub' | 'throughput-grid' | 'stability-basin'
  label: string
  moduleIds: readonly string[]
  bounds: {
    left: number
    top: number
    width: number
    height: number
  }
  accentClass: string
  glowClass: string
  laneClass: string
  status: 'healthy' | 'warning' | 'critical'
  moduleCountLabel: string
}

export interface FactoryConduit {
  id: string
  fromZoneId: FactoryZone['id']
  toZoneId: FactoryZone['id']
  label: string
  orientation: 'horizontal' | 'vertical'
  left: number
  top: number
  width: number
  height: number
  status: 'healthy' | 'warning' | 'critical'
}

export interface FactoryDock {
  id: string
  zoneId: FactoryZone['id']
  label: string
  left: number
  top: number
  width: number
  height: number
  status: 'healthy' | 'warning' | 'critical'
}

export interface FactoryPathPoint {
  x: number
  y: number
}

export interface FactoryPathRoute {
  id: string
  moduleId: string
  label: string
  points: FactoryPathPoint[]
}

const factoryZoneBlueprint = [
  {
    id: 'compute-hub',
    label: '计算中枢区',
    moduleIds: ['cpu-cluster', 'gpu-activity', 'memory-pressure'],
    accentClass: 'border-cyan-300/18',
    glowClass: 'bg-cyan-400/6 shadow-[0_0_36px_rgba(34,211,238,0.15)]',
    laneClass: 'from-cyan-400/35 via-cyan-300/15 to-transparent',
  },
  {
    id: 'throughput-grid',
    label: '交换物流区',
    moduleIds: ['disk-usage', 'network-throughput', 'top-process'],
    accentClass: 'border-sky-300/16',
    glowClass: 'bg-sky-400/5 shadow-[0_0_30px_rgba(56,189,248,0.12)]',
    laneClass: 'from-sky-400/35 via-cyan-300/10 to-transparent',
  },
  {
    id: 'stability-basin',
    label: '维持散热区',
    moduleIds: ['thermal-state', 'fan-speed', 'power-draw'],
    accentClass: 'border-violet-300/16',
    glowClass: 'bg-violet-400/5 shadow-[0_0_30px_rgba(168,85,247,0.12)]',
    laneClass: 'from-violet-400/35 via-cyan-300/10 to-transparent',
  },
] as const

function getZoneStatus(modules: DashboardModule[]): 'healthy' | 'warning' | 'critical' {
  if (modules.some((module) => module.status === 'critical')) {
    return 'critical'
  }

  if (modules.some((module) => module.status === 'warning' || module.status === 'unavailable')) {
    return 'warning'
  }

  return 'healthy'
}

function createZoneBounds(modules: DashboardModule[]) {
  const centers = modules.map((module) => getTelemetryModuleCenter(module))
  const paddingX = 130
  const paddingY = 105
  const left = Math.min(...centers.map((center) => center.x)) - paddingX
  const right = Math.max(...centers.map((center) => center.x)) + paddingX
  const top = Math.min(...centers.map((center) => center.y)) - paddingY
  const bottom = Math.max(...centers.map((center) => center.y)) + paddingY

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  }
}

export function createFactoryZones(modules: DashboardModule[]): FactoryZone[] {
  return factoryZoneBlueprint.flatMap((zone) => {
    const zoneModules = zone.moduleIds
      .map((moduleId) => modules.find((module) => module.id === moduleId))
      .filter((module): module is DashboardModule => module !== undefined)

    if (zoneModules.length === 0) {
      return []
    }

    return [
      {
        ...zone,
        bounds: createZoneBounds(zoneModules),
        status: getZoneStatus(zoneModules),
        moduleCountLabel: `${zoneModules.length} 个工位`,
      },
    ]
  })
}

export function createFactoryConduits(zones: FactoryZone[]): FactoryConduit[] {
  const computeZone = zones.find((zone) => zone.id === 'compute-hub')
  const throughputZone = zones.find((zone) => zone.id === 'throughput-grid')
  const stabilityZone = zones.find((zone) => zone.id === 'stability-basin')

  if (!computeZone || !throughputZone || !stabilityZone) {
    return []
  }

  const laneLeft = Math.min(computeZone.bounds.left, throughputZone.bounds.left, stabilityZone.bounds.left) + 16
  const laneWidth = Math.max(computeZone.bounds.width, throughputZone.bounds.width, stabilityZone.bounds.width) - 32
  const verticalLaneLeft = computeZone.bounds.left + computeZone.bounds.width / 2 - 14
  const computeBottom = computeZone.bounds.top + computeZone.bounds.height
  const throughputBottom = throughputZone.bounds.top + throughputZone.bounds.height

  return [
    {
      id: 'compute-throughput-lane',
      fromZoneId: 'compute-hub',
      toZoneId: 'throughput-grid',
      label: '主数据通路',
      orientation: 'horizontal',
      left: laneLeft,
      top: computeBottom + 22,
      width: laneWidth,
      height: 24,
      status: computeZone.status === 'critical' || throughputZone.status === 'critical' ? 'critical' : computeZone.status === 'warning' || throughputZone.status === 'warning' ? 'warning' : 'healthy',
    },
    {
      id: 'throughput-stability-lane',
      fromZoneId: 'throughput-grid',
      toZoneId: 'stability-basin',
      label: '能源回流通路',
      orientation: 'horizontal',
      left: laneLeft,
      top: throughputBottom + 22,
      width: laneWidth,
      height: 24,
      status: throughputZone.status === 'critical' || stabilityZone.status === 'critical' ? 'critical' : throughputZone.status === 'warning' || stabilityZone.status === 'warning' ? 'warning' : 'healthy',
    },
    {
      id: 'backbone-column',
      fromZoneId: 'compute-hub',
      toZoneId: 'stability-basin',
      label: '骨干升降井',
      orientation: 'vertical',
      left: verticalLaneLeft,
      top: computeBottom + 16,
      width: 28,
      height: stabilityZone.bounds.top - computeBottom - 32,
      status: zones.some((zone) => zone.status === 'critical') ? 'critical' : zones.some((zone) => zone.status === 'warning') ? 'warning' : 'healthy',
    },
  ]
}

export function createFactoryDocks(zones: FactoryZone[]): FactoryDock[] {
  return zones.map((zone, index) => ({
    id: `${zone.id}-dock`,
    zoneId: zone.id,
    label: `${zone.label} 装配坞`,
    left: zone.bounds.left + 36,
    top: zone.bounds.top + zone.bounds.height - 46,
    width: zone.bounds.width - 72,
    height: 26,
    status: zone.status,
  }))
}

export function createFactoryRoutes(modules: DashboardModule[]): FactoryPathRoute[] {
  return modules.map((module) => {
    const center = getTelemetryModuleCenter(module)

    return {
      id: `${module.id}-route`,
      moduleId: module.id,
      label: `${module.name} 巡检路径`,
      points: [
        { x: center.x - 112, y: center.y + 36 },
        { x: center.x - 40, y: center.y + 84 },
        { x: center.x + 52, y: center.y + 64 },
        { x: center.x + 100, y: center.y + 12 },
      ],
    }
  })
}
