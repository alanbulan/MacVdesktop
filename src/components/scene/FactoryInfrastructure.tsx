import React from 'react'
import type { FactoryDock } from '../../lib/sceneModel'

interface Props {
  docks: FactoryDock[]
}

function getDockStatusClass(status: FactoryDock['status']) {
  if (status === 'critical') {
    return 'border-pink-400/35 bg-pink-500/10'
  }

  if (status === 'warning') {
    return 'border-amber-300/30 bg-amber-400/8'
  }

  return 'border-cyan-300/25 bg-cyan-400/8'
}

export const FactoryInfrastructure: React.FC<Props> = ({ docks }) => {
  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
      {docks.map((dock) => (
        <div
          key={dock.id}
          aria-label={dock.label}
          className={`absolute rounded-full border shadow-[0_0_18px_rgba(34,211,238,0.08)] ${getDockStatusClass(dock.status)}`}
          style={{
            left: `${dock.left}px`,
            top: `${dock.top}px`,
            width: `${dock.width}px`,
            height: `${dock.height}px`,
          }}
        >
          <div className="absolute inset-[5px] rounded-full border border-white/10" />
          <div className="absolute inset-y-[7px] left-6 right-6 rounded-full bg-gradient-to-r from-transparent via-cyan-300/18 to-transparent" />
        </div>
      ))}

      <div aria-label="冷却塔阵列" className="absolute top-[35%] left-[24%] h-[180px] w-[72px] rounded-[26px] border border-cyan-300/14 bg-[linear-gradient(180deg,rgba(34,211,238,0.18),rgba(8,15,28,0.82))] shadow-[0_0_26px_rgba(34,211,238,0.08)]" />
      <div aria-label="物流吊桥" className="absolute top-[48%] left-[30%] h-[18px] w-[260px] rounded-full border border-cyan-300/12 bg-gradient-to-r from-transparent via-cyan-400/14 to-transparent" />
      <div aria-label="能源泵列" className="absolute bottom-[24%] right-[24%] h-[150px] w-[84px] rounded-[28px] border border-violet-300/16 bg-[linear-gradient(180deg,rgba(168,85,247,0.18),rgba(8,15,28,0.84))] shadow-[0_0_24px_rgba(168,85,247,0.08)]" />
      <div aria-label="维护工位群" className="absolute bottom-[26%] left-[32%] h-[84px] w-[320px] rounded-[28px] border border-cyan-300/14 bg-[linear-gradient(180deg,rgba(34,211,238,0.1),rgba(8,15,28,0.78))]" />
      <div aria-label="数据集线底座" className="absolute top-[26%] right-[28%] h-[92px] w-[240px] rounded-[30px] border border-sky-300/14 bg-[linear-gradient(180deg,rgba(56,189,248,0.1),rgba(8,15,28,0.8))]" />
    </div>
  )
}
