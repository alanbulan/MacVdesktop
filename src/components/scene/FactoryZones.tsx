import React from 'react'
import type { FactoryConduit, FactoryZone } from '../../lib/sceneModel'

interface Props {
  zones: FactoryZone[]
  conduits: FactoryConduit[]
}

function getZoneStatusClass(status: FactoryZone['status']) {
  if (status === 'critical') {
    return 'border-pink-400/28 shadow-[0_0_48px_rgba(236,72,153,0.16)]'
  }

  if (status === 'warning') {
    return 'border-amber-300/22 shadow-[0_0_36px_rgba(245,158,11,0.12)]'
  }

  return 'border-cyan-300/18 shadow-[0_0_36px_rgba(34,211,238,0.12)]'
}

function getConduitStatusClass(status: FactoryConduit['status']) {
  if (status === 'critical') {
    return 'from-pink-400/45 via-pink-300/22 to-transparent border-pink-300/25'
  }

  if (status === 'warning') {
    return 'from-amber-300/45 via-amber-200/22 to-transparent border-amber-200/25'
  }

  return 'from-cyan-400/45 via-cyan-300/18 to-transparent border-cyan-300/20'
}

export const FactoryZones: React.FC<Props> = ({ zones, conduits }) => {
  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
      {zones.map((zone) => (
        <div
          key={zone.id}
          aria-label={`${zone.label} 工厂区`}
          className={`absolute rounded-[42px] border bg-black/12 backdrop-blur-[2px] ${zone.accentClass} ${zone.glowClass} ${getZoneStatusClass(zone.status)}`}
          style={{
            left: `${zone.bounds.left}px`,
            top: `${zone.bounds.top}px`,
            width: `${zone.bounds.width}px`,
            height: `${zone.bounds.height}px`,
          }}
        >
          <div className="absolute inset-4 rounded-[30px] border border-white/6" />
          <div className="absolute inset-x-8 top-6 h-[2px] bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" />
          <div className="absolute top-5 left-7 text-[10px] uppercase tracking-[0.35em] font-tech text-cyan-200/80">
            {zone.label}
          </div>
          <div className="absolute top-10 right-7 text-[10px] uppercase tracking-[0.25em] font-tech text-cyan-300/55">
            {zone.moduleCountLabel}
          </div>
          <div className={`absolute left-10 right-10 bottom-7 h-5 rounded-full border bg-gradient-to-r ${zone.laneClass} border-white/8`} />
          <div className="absolute left-12 right-12 bottom-11 h-[1px] bg-gradient-to-r from-transparent via-cyan-200/25 to-transparent" />
        </div>
      ))}

      {conduits.map((conduit) => (
        <div
          key={conduit.id}
          aria-label={conduit.label}
          className={`absolute rounded-full border bg-gradient-to-r ${getConduitStatusClass(conduit.status)}`}
          style={{
            left: `${conduit.left}px`,
            top: `${conduit.top}px`,
            width: `${conduit.width}px`,
            height: `${conduit.height}px`,
          }}
        >
          <div className="absolute inset-[4px] rounded-full border border-white/8" />
        </div>
      ))}
    </div>
  )
}
