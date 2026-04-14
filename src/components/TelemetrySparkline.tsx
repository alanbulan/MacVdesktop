import React from 'react'
import type { TelemetryHistorySample } from '../types'

interface Props {
  samples: TelemetryHistorySample[]
  label: string
}

export const TelemetrySparkline: React.FC<Props> = ({ samples, label }) => {
  if (samples.length < 2) {
    return null
  }

  const minValue = Math.min(...samples.map((sample) => sample.numericValue))
  const maxValue = Math.max(...samples.map((sample) => sample.numericValue))
  const valueRange = maxValue - minValue || 1
  const stepX = samples.length === 1 ? 0 : 100 / (samples.length - 1)
  const points = samples
    .map((sample, index) => {
      const x = index * stepX
      const y = 100 - ((sample.numericValue - minValue) / valueRange) * 100
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="mt-4 rounded-xl border border-cyan-900/50 bg-black/30 p-3">
      <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-cyan-400/70 font-tech">最近 {samples.length} 次真实采样</div>
      <svg aria-label={label} viewBox="0 0 100 100" className="h-16 w-full overflow-visible">
        <polyline
          fill="none"
          points={points}
          stroke="rgba(34,211,238,0.9)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
