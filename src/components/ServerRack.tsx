import React from 'react'
import type { DashboardModule } from '../types'
import { telemetryChamberLayout } from '../domain/telemetry/layout'
import { CircleAlert, Cpu, HardDrive } from 'lucide-react'

interface Props {
  module: DashboardModule
  onClick: (module: DashboardModule) => void
  isSelected: boolean
}

function getStatusStyles(status: DashboardModule['status']) {
  if (status === 'critical') {
    return {
      border: 'border-pink-500/50 shadow-[0_0_20px_rgba(236,72,153,0.35)]',
      icon: 'text-pink-400',
      header: 'bg-pink-950/50',
      indicator: 'bg-pink-500',
      pulse: 'animate-pulse',
    }
  }

  if (status === 'warning') {
    return {
      border: 'border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.35)]',
      icon: 'text-amber-300',
      header: 'bg-amber-950/40',
      indicator: 'bg-amber-400',
      pulse: 'animate-pulse',
    }
  }

  if (status === 'unavailable') {
    return {
      border: 'border-gray-700/60',
      icon: 'text-gray-500',
      header: 'bg-gray-900/60',
      indicator: 'bg-gray-600',
      pulse: '',
    }
  }

  return {
    border: 'border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]',
    icon: 'text-cyan-400',
    header: 'bg-cyan-950/50',
    indicator: 'bg-cyan-400',
    pulse: 'animate-pulse',
  }
}

function getModuleIcon(module: DashboardModule) {
  if (module.id.toLowerCase().includes('thermal')) {
    return CircleAlert
  }

  if (module.id.toLowerCase().includes('memory') || module.name.toLowerCase().includes('memory')) {
    return HardDrive
  }

  return Cpu
}

function getTelemetryAccent(module: DashboardModule) {
  if (module.primaryMetric.state === 'live') {
    return {
      label: module.primaryMetric.value,
      glowClass: module.status === 'critical' ? 'shadow-[0_0_20px_rgba(236,72,153,0.45)]' : module.status === 'warning' ? 'shadow-[0_0_20px_rgba(245,158,11,0.35)]' : 'shadow-[0_0_20px_rgba(34,211,238,0.3)]',
      borderClass: module.status === 'critical' ? 'border-pink-500/40' : module.status === 'warning' ? 'border-amber-400/40' : 'border-cyan-400/40',
    }
  }

  if (module.primaryMetric.state === 'loading') {
    return {
      label: 'Loading',
      glowClass: 'shadow-[0_0_18px_rgba(245,158,11,0.22)]',
      borderClass: 'border-amber-400/40',
    }
  }

  return {
    label: 'Unavailable',
    glowClass: 'shadow-none',
    borderClass: 'border-gray-700/60',
  }
}

export const ServerRack: React.FC<Props> = ({ module, onClick, isSelected }) => {
  const styles = getStatusStyles(module.status)
  const Icon = getModuleIcon(module)
  const telemetryAccent = getTelemetryAccent(module)

  return (
    <button
      type="button"
      className="absolute cursor-pointer transition-all duration-300 hover:scale-105 hover:-translate-y-2 text-left"
      style={{
        left: `${(telemetryChamberLayout.anchorX + module.x * telemetryChamberLayout.spacing) * telemetryChamberLayout.pixelUnit}px`,
        top: `${(telemetryChamberLayout.anchorY + module.y * telemetryChamberLayout.spacing) * telemetryChamberLayout.pixelUnit}px`,
        width: '124px',
        height: '176px',
        marginLeft: '-62px',
        marginTop: '-88px',
        zIndex: isSelected
          ? 10000
          : Math.floor((telemetryChamberLayout.anchorY + module.y * telemetryChamberLayout.spacing) * telemetryChamberLayout.pixelUnit + 68),
      }}
      onClick={() => onClick(module)}
      aria-label={`Select telemetry module ${module.name}`}
    >
      <div className={`w-full h-full glass-panel rounded-lg flex flex-col overflow-hidden border ${styles.border} ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent' : ''}`}>
        <div className={`w-full ${styles.header} text-center py-1 border-b border-white/10`}>
          <span className="text-[9px] font-tech text-white/90 tracking-wider block truncate px-1">{module.name}</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center relative px-2">
          <div className={`absolute top-1 right-1 h-1.5 w-1.5 rounded-full ${styles.indicator} ${styles.pulse}`}></div>

          <div className={`${styles.icon} ${module.status === 'healthy' ? 'drop-shadow-[0_0_5px_currentColor]' : ''}`}>
            <Icon size={28} strokeWidth={1.5} />
          </div>

          <div className="mt-2 text-[8px] font-tech tracking-[0.2em] text-center text-white/70 uppercase">
            {module.primaryMetric.state === 'loading'
              ? '加载中'
              : module.status === 'unavailable'
                ? '不可用'
                : '遥测'}
          </div>
        </div>

        <div className="h-6 w-full bg-black/40 px-2 py-1 border-t border-white/5">
          <div className={`h-full rounded-md border ${telemetryAccent.borderClass} bg-black/60 flex items-center justify-center ${telemetryAccent.glowClass}`}>
            <span className="text-[8px] font-mono tracking-[0.2em] text-white/75 uppercase">{telemetryAccent.label}</span>
          </div>
        </div>
      </div>
    </button>
  )
}
