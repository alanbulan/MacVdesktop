import React from 'react'
import { motion } from 'motion/react'
import { telemetryChamberLayout } from '../domain/telemetry/layout'
import type { InspectionAgent } from '../types'

interface Props {
  agent: InspectionAgent
}

function getRoleStyles(role: InspectionAgent['role']) {
  switch (role) {
    case 'engineer':
      return {
        head: 'bg-yellow-400',
        body: 'bg-yellow-600',
        limb: 'bg-yellow-700',
        eye: 'bg-black',
        aura: 'bg-yellow-300/20',
        pose: 'engineer-pose',
        tool: 'bg-amber-200',
      }
    case 'courier':
      return {
        head: 'bg-cyan-400',
        body: 'bg-cyan-600',
        limb: 'bg-cyan-700',
        eye: 'bg-white',
        aura: 'bg-cyan-300/20',
        pose: 'courier-pose',
        tool: 'bg-cyan-200',
      }
    case 'security':
      return {
        head: 'bg-red-500',
        body: 'bg-red-700',
        limb: 'bg-red-900',
        eye: 'bg-yellow-300',
        aura: 'bg-red-400/20',
        pose: 'security-pose',
        tool: 'bg-red-200',
      }
    case 'admin':
      return {
        head: 'bg-purple-400',
        body: 'bg-purple-600',
        limb: 'bg-purple-800',
        eye: 'bg-cyan-300',
        aura: 'bg-purple-300/20',
        pose: 'admin-pose',
        tool: 'bg-violet-200',
      }
    default:
      return {
        head: 'bg-gray-400',
        body: 'bg-gray-600',
        limb: 'bg-gray-700',
        eye: 'bg-black',
        aura: 'bg-gray-300/20',
        pose: '',
        tool: 'bg-gray-200',
      }
  }
}

export function getAgentPixelPosition(position: Pick<InspectionAgent, 'x' | 'y'>) {
  return {
    x: position.x * telemetryChamberLayout.pixelUnit,
    y: position.y * telemetryChamberLayout.pixelUnit,
  }
}

export const Agent: React.FC<Props> = ({ agent }) => {
  const styles = getRoleStyles(agent.role)
  const isWalking = agent.status === 'moving'
  const pixelPosition = getAgentPixelPosition(agent)

  return (
    <motion.div
      aria-label={`巡检角色 ${agent.name}`}
      className="absolute pointer-events-none flex flex-col items-center justify-end"
      initial={false}
      animate={{
        x: pixelPosition.x,
        y: pixelPosition.y,
        zIndex: Math.floor(pixelPosition.y + 30),
      }}
      transition={{ duration: 1, ease: 'linear' }}
      style={{ width: 54, height: 82, marginLeft: -27, marginTop: -41 }}
    >
      {(agent.status === 'working' || agent.status === 'idle') && (
        <div className={`absolute min-w-[168px] rounded border px-2 py-1 shadow-[0_0_10px_rgba(6,182,212,0.3)] backdrop-blur-md z-50 ${agent.status === 'working' ? '-top-12 border-cyan-500/50 bg-cyan-950/90 text-cyan-300' : '-top-9 border-cyan-500/30 bg-cyan-950/75 text-cyan-200/90'}`}>
          <div className="flex items-center justify-between gap-3 whitespace-nowrap font-tech text-[10px] tracking-wider">
            <span>{agent.task}</span>
            <span className="rounded-full border border-cyan-400/30 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.2em] text-cyan-200/70">
              {agent.status === 'working' ? '执行中' : '待命'}
            </span>
          </div>
          {agent.detail ? <div className="mt-1 whitespace-nowrap text-[9px] text-cyan-200/85">{agent.detail}</div> : null}
        </div>
      )}

      {isWalking ? (
        <>
          <div aria-label={`移动轨迹 ${agent.name}`} className="absolute bottom-2 h-10 w-16 rounded-full bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent blur-md animate-[trail-flicker_0.8s_ease-in-out_infinite]"></div>
          <div aria-label={`搬运火花 ${agent.name}`} className="absolute -bottom-1 h-5 w-12 rounded-full bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent blur-sm animate-pulse"></div>
        </>
      ) : null}

      <div className={`relative flex flex-col items-center ${isWalking ? 'is-walking' : 'is-idle'} ${styles.pose}`}>
        <div className={`w-5 h-5 rounded-md ${styles.head} z-20 flex items-center justify-center shadow-sm relative`}>
          <div className="flex space-x-1">
            <div className={`w-1 h-1.5 rounded-full ${styles.eye} animate-pulse`}></div>
            <div className={`w-1 h-1.5 rounded-full ${styles.eye} animate-pulse`}></div>
          </div>
          {agent.role === 'admin' ? <div className="absolute -top-2 w-1 h-2 bg-purple-300 rounded-t-full"></div> : null}
          {agent.role === 'engineer' ? <div className="absolute top-0 w-full h-1.5 bg-yellow-200 rounded-t-md opacity-50"></div> : null}
        </div>

        <div className={`torso w-4 h-6 ${styles.body} rounded-sm z-10 relative mt-0.5 shadow-sm`}>
          {agent.role === 'courier' ? <div className="absolute -right-1.5 top-1 w-2 h-4 bg-cyan-300 rounded-sm"></div> : null}
          {agent.role === 'security' ? <div className="absolute left-1 top-1 w-1.5 h-1.5 bg-yellow-400 rounded-full"></div> : null}
          {agent.role === 'engineer' ? <div className={`absolute -right-2 top-3 h-1.5 w-3 rounded-full ${styles.tool}`}></div> : null}
          {agent.role === 'admin' ? <div className={`absolute -left-2 top-2 h-3 w-3 rounded-sm border border-cyan-200/40 ${styles.tool}`}></div> : null}
          <div className={`arm-l absolute -left-1.5 top-0.5 w-1.5 h-5 ${styles.limb} rounded-full origin-top`}></div>
          <div className={`arm-r absolute -right-1.5 top-0.5 w-1.5 h-5 ${styles.limb} rounded-full origin-top`}></div>
        </div>

        <div className="flex space-x-1 mt-0.5 z-0">
          <div className={`leg-l w-1.5 h-5 ${styles.limb} rounded-full origin-top`}></div>
          <div className={`leg-r w-1.5 h-5 ${styles.limb} rounded-full origin-top`}></div>
        </div>
      </div>

      <div className={`absolute bottom-1 h-8 w-8 rounded-full ${styles.aura} blur-md`}></div>
      <div className="w-6 h-1.5 bg-black/40 rounded-full blur-[1px] mt-1"></div>
    </motion.div>
  )
}
