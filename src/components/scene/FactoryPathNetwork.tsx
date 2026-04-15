import React from 'react'
import type { FactoryPathRoute } from '../../lib/sceneModel'

interface Props {
  routes: FactoryPathRoute[]
}

function toPolylinePoints(points: FactoryPathRoute['points']) {
  return points.map((point) => `${point.x},${point.y}`).join(' ')
}

export const FactoryPathNetwork: React.FC<Props> = ({ routes }) => {
  return (
    <svg className="absolute inset-0 h-full w-full pointer-events-none overflow-visible" aria-label="工厂路径网络" viewBox="0 0 2000 2000">
      {routes.map((route) => (
        <g key={route.id} aria-label={route.label}>
          <polyline
            fill="none"
            points={toPolylinePoints(route.points)}
            stroke="rgba(34,211,238,0.12)"
            strokeWidth="20"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            fill="none"
            points={toPolylinePoints(route.points)}
            stroke="rgba(103,232,249,0.55)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="18 16"
          />
          {route.points.map((point, index) => (
            <circle
              key={`${route.id}-${index}`}
              cx={point.x}
              cy={point.y}
              r={index === route.points.length - 1 ? 8 : 5}
              fill={index === route.points.length - 1 ? 'rgba(103,232,249,0.9)' : 'rgba(34,211,238,0.42)'}
            />
          ))}
        </g>
      ))}
    </svg>
  )
}
