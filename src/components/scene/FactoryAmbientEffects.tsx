import React from 'react'
import type { DashboardModule } from '../../types'

interface Props {
  modules: DashboardModule[]
}

function getStatusEffectClass(status: DashboardModule['status']) {
  if (status === 'critical') {
    return 'bg-pink-400/15 shadow-[0_0_32px_rgba(236,72,153,0.18)]'
  }

  if (status === 'warning' || status === 'unavailable') {
    return 'bg-amber-300/10 shadow-[0_0_28px_rgba(245,158,11,0.12)]'
  }

  return 'bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.12)]'
}

export const FactoryAmbientEffects: React.FC<Props> = ({ modules }) => {
  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
      {modules.map((module) => {
        const left = 610 + module.x * 256
        const top = 635 + module.y * 256

        return (
          <div
            key={module.id}
            aria-label={`${module.name} 数据波场`}
            className={`absolute h-28 w-28 rounded-full blur-2xl animate-[breathe_4.8s_ease-in-out_infinite] ${getStatusEffectClass(module.status)}`}
            style={{ left: `${left}px`, top: `${top}px` }}
          />
        )
      })}

      <div aria-label="数据星轨 1" className="absolute top-[30%] left-[33%] h-[6px] w-[240px] rounded-full bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent blur-[1px] animate-[scan_10s_linear_infinite]" />
      <div aria-label="数据星轨 2" className="absolute top-[58%] right-[30%] h-[6px] w-[260px] rounded-full bg-gradient-to-r from-transparent via-violet-300/22 to-transparent blur-[1px] animate-[scan_12s_linear_infinite]" />
      <div aria-label="数据星轨 3" className="absolute top-[44%] left-[46%] h-[180px] w-[4px] rounded-full bg-gradient-to-b from-transparent via-cyan-300/22 to-transparent blur-[1px]" />
    </div>
  )
}
