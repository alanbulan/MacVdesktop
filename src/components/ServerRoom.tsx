import React, { useEffect, useRef, useState } from 'react'
import { calculateTelemetryClusterScale } from '../domain/telemetry/layout'
import { createInspectionAgents } from '../lib/inspectionAgents'
import type { DashboardModule } from '../types'
import { Agent } from './Agent'
import { ServerRack } from './ServerRack'

interface Props {
  modules: DashboardModule[]
  onSelectModule: (module: DashboardModule) => void
  selectedModuleId: string | null
}

export const ServerRoom: React.FC<Props> = ({ modules, onSelectModule, selectedModuleId }) => {
  const [patrolPhase, setPatrolPhase] = useState(0)
  const [clusterScale, setClusterScale] = useState(1)
  const roomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPatrolPhase((currentPhase) => currentPhase + 1)
    }, 1100)

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const room = roomRef.current
    if (!room) {
      return
    }

    const updateClusterScale = () => {
      const { width, height } = room.getBoundingClientRect()
      setClusterScale(calculateTelemetryClusterScale(width, height))
    }

    updateClusterScale()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateClusterScale)

      return () => {
        window.removeEventListener('resize', updateClusterScale)
      }
    }

    const observer = new ResizeObserver(() => {
      updateClusterScale()
    })
    observer.observe(room)

    return () => {
      observer.disconnect()
    }
  }, [])

  const agents = createInspectionAgents(modules, patrolPhase)

  return (
    <div ref={roomRef} className="absolute inset-0 bg-[#030508] overflow-hidden">
      <div className="absolute top-1/2 left-1/2 w-[2000px] h-[2000px] -translate-x-1/2 -translate-y-1/2 bg-grid-tech">
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute top-1/2 left-1/2 w-[1000px] h-[1000px] bg-cyan-500/10 blur-[100px] -translate-x-1/2 -translate-y-1/2 rounded-full"></div>
          <div aria-label="纵深雾化层 1" className="absolute top-1/2 left-1/2 h-[980px] w-[980px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/7 blur-[140px] animate-[breathe_6s_ease-in-out_infinite]"></div>
          <div aria-label="纵深雾化层 2" className="absolute top-1/2 left-1/2 h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/6 blur-[90px] animate-[hover-drift_8s_ease-in-out_infinite]"></div>
          <div aria-label="中央反应核心" className="absolute top-1/2 left-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/40 bg-cyan-400/8 shadow-[0_0_120px_rgba(34,211,238,0.25)]">
            <div className="absolute inset-4 rounded-full border border-cyan-300/35"></div>
            <div className="absolute inset-10 rounded-full border border-dashed border-cyan-300/25 animate-[spin_18s_linear_infinite]"></div>
            <div className="absolute inset-16 rounded-full border border-cyan-200/15"></div>
            <div className="absolute inset-20 rounded-full bg-cyan-300/12 blur-xl"></div>
          </div>
          <div aria-label="核心支撑柱 1" className="absolute top-1/2 left-1/2 h-[360px] w-[4px] -translate-x-[182px] -translate-y-1/2 bg-gradient-to-b from-transparent via-cyan-300/25 to-transparent"></div>
          <div aria-label="核心支撑柱 2" className="absolute top-1/2 left-1/2 h-[360px] w-[4px] translate-x-[178px] -translate-y-1/2 bg-gradient-to-b from-transparent via-cyan-300/25 to-transparent"></div>
          <div aria-label="核心支撑柱 3" className="absolute top-1/2 left-1/2 h-[4px] w-[360px] -translate-x-1/2 -translate-y-[182px] bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent"></div>
          <div aria-label="核心支撑柱 4" className="absolute top-1/2 left-1/2 h-[4px] w-[360px] -translate-x-1/2 translate-y-[178px] bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent"></div>
          <div aria-label="舱室扫描网格 1" className="absolute top-1/2 left-1/2 h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-cyan-300/8 animate-[spin_90s_linear_infinite]"></div>
          <div aria-label="环形步道 1" className="absolute top-1/2 left-1/2 h-[430px] w-[430px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-cyan-300/18"></div>
          <div aria-label="环形步道 2" className="absolute top-1/2 left-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/10"></div>
          <div aria-label="环形步道 3" className="absolute top-1/2 left-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-cyan-300/7"></div>
          <div aria-label="扫描光束 1" className="absolute top-[34%] left-1/2 h-[320px] w-[3px] -translate-x-1/2 bg-gradient-to-b from-transparent via-cyan-300/35 to-transparent blur-[1px] animate-pulse"></div>
          <div aria-label="扫描光束 2" className="absolute top-1/2 left-[42%] h-[3px] w-[320px] -translate-y-1/2 bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent blur-[1px] animate-pulse"></div>
          <div aria-label="扫描光束 3" className="absolute top-[30%] left-[47%] h-[420px] w-[2px] rotate-[28deg] bg-gradient-to-b from-transparent via-cyan-300/18 to-transparent blur-[1px]"></div>
          <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] border border-cyan-500/30 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute top-1/2 left-1/2 w-[900px] h-[900px] border border-dashed border-cyan-500/20 rounded-full -translate-x-1/2 -translate-y-1/2 animate-[spin_60s_linear_infinite]"></div>
          <div aria-label="中央承载地台 1" className="absolute top-1/2 left-1/2 h-[860px] w-[860px] -translate-x-1/2 -translate-y-1/2 rounded-[32%] border border-cyan-300/10 bg-[radial-gradient(circle,rgba(34,211,238,0.08)_0%,rgba(6,182,212,0.03)_38%,rgba(3,5,8,0)_72%)] shadow-[inset_0_0_80px_rgba(34,211,238,0.08)]"></div>
          <div aria-label="中央承载地台 2" className="absolute top-1/2 left-1/2 h-[1040px] w-[1040px] -translate-x-1/2 -translate-y-1/2 rounded-[36%] border border-cyan-300/6 bg-cyan-400/4 blur-[1px]"></div>
          <div aria-label="轨道填充环 1" className="absolute top-1/2 left-1/2 h-[940px] w-[940px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[14px] border-cyan-400/4"></div>
          <div aria-label="轨道填充环 2" className="absolute top-1/2 left-1/2 h-[1120px] w-[1120px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[10px] border-cyan-300/3"></div>
          <div aria-label="对角导流翼 1" className="absolute top-1/2 left-1/2 h-[28px] w-[440px] -translate-x-[455px] -translate-y-[250px] rotate-[38deg] rounded-full border border-cyan-300/10 bg-gradient-to-r from-transparent via-cyan-400/12 to-transparent blur-[1px]"></div>
          <div aria-label="对角导流翼 2" className="absolute top-1/2 left-1/2 h-[28px] w-[440px] translate-x-[15px] -translate-y-[250px] -rotate-[38deg] rounded-full border border-cyan-300/10 bg-gradient-to-r from-transparent via-cyan-400/12 to-transparent blur-[1px]"></div>
          <div aria-label="对角导流翼 3" className="absolute top-1/2 left-1/2 h-[28px] w-[440px] -translate-x-[455px] translate-y-[222px] -rotate-[38deg] rounded-full border border-cyan-300/10 bg-gradient-to-r from-transparent via-cyan-400/12 to-transparent blur-[1px]"></div>
          <div aria-label="对角导流翼 4" className="absolute top-1/2 left-1/2 h-[28px] w-[440px] translate-x-[15px] translate-y-[222px] rotate-[38deg] rounded-full border border-cyan-300/10 bg-gradient-to-r from-transparent via-cyan-400/12 to-transparent blur-[1px]"></div>
          <div aria-label="外环基座 1" className="absolute top-1/2 left-1/2 h-[1360px] w-[1360px] -translate-x-1/2 -translate-y-1/2 rounded-[38%] border border-cyan-300/8 bg-cyan-500/3 shadow-[inset_0_0_120px_rgba(34,211,238,0.05)]"></div>
          <div aria-label="外环基座 2" className="absolute top-1/2 left-1/2 h-[1500px] w-[1500px] -translate-x-1/2 -translate-y-1/2 rounded-[40%] border border-cyan-300/5"></div>
          <div aria-label="弧形管廊 1" className="absolute top-1/2 left-1/2 h-[1180px] w-[1180px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[18px] border-cyan-400/4 border-t-cyan-300/12 border-b-cyan-300/12"></div>
          <div aria-label="弧形管廊 2" className="absolute top-1/2 left-1/2 h-[1280px] w-[1280px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[12px] border-cyan-400/3 border-l-cyan-300/10 border-r-cyan-300/10"></div>
          <div aria-label="边缘框架 1" className="absolute top-[18%] left-1/2 h-[20px] w-[1240px] -translate-x-1/2 rounded-full border border-cyan-300/10 bg-cyan-400/4"></div>
          <div aria-label="边缘框架 2" className="absolute bottom-[18%] left-1/2 h-[20px] w-[1240px] -translate-x-1/2 rounded-full border border-cyan-300/10 bg-cyan-400/4"></div>
          <div aria-label="边缘框架 3" className="absolute top-1/2 left-[18%] h-[1240px] w-[20px] -translate-y-1/2 rounded-full border border-cyan-300/10 bg-cyan-400/4"></div>
          <div aria-label="边缘框架 4" className="absolute top-1/2 right-[18%] h-[1240px] w-[20px] -translate-y-1/2 rounded-full border border-cyan-300/10 bg-cyan-400/4"></div>
          <div aria-label="支撑桥 1" className="absolute top-[24%] left-1/2 h-[26px] w-[980px] -translate-x-1/2 rounded-full border border-cyan-300/10 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent"></div>
          <div aria-label="支撑桥 2" className="absolute bottom-[24%] left-1/2 h-[26px] w-[980px] -translate-x-1/2 rounded-full border border-cyan-300/10 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent"></div>
          <div aria-label="分段平台 1" className="absolute top-[26%] left-[22%] h-[120px] w-[180px] rounded-3xl border border-cyan-300/10 bg-cyan-400/5"></div>
          <div aria-label="分段平台 2" className="absolute top-[26%] right-[22%] h-[120px] w-[180px] rounded-3xl border border-cyan-300/10 bg-cyan-400/5"></div>
          <div aria-label="分段平台 3" className="absolute bottom-[22%] left-[24%] h-[100px] w-[160px] rounded-3xl border border-cyan-300/10 bg-cyan-400/5"></div>
          <div aria-label="分段平台 4" className="absolute bottom-[22%] right-[24%] h-[100px] w-[160px] rounded-3xl border border-cyan-300/10 bg-cyan-400/5"></div>
          <div aria-label="角部锚点 1" className="absolute top-[14%] left-[14%] h-[88px] w-[88px] rounded-[28px] border border-cyan-300/12 bg-cyan-400/6 shadow-[0_0_24px_rgba(34,211,238,0.08)]"></div>
          <div aria-label="角部锚点 2" className="absolute top-[14%] right-[14%] h-[88px] w-[88px] rounded-[28px] border border-cyan-300/12 bg-cyan-400/6 shadow-[0_0_24px_rgba(34,211,238,0.08)]"></div>
          <div aria-label="角部锚点 3" className="absolute bottom-[14%] left-[14%] h-[88px] w-[88px] rounded-[28px] border border-cyan-300/12 bg-cyan-400/6 shadow-[0_0_24px_rgba(34,211,238,0.08)]"></div>
          <div aria-label="角部锚点 4" className="absolute bottom-[14%] right-[14%] h-[88px] w-[88px] rounded-[28px] border border-cyan-300/12 bg-cyan-400/6 shadow-[0_0_24px_rgba(34,211,238,0.08)]"></div>
          <div aria-label="外缘走廊 1" className="absolute top-[16%] left-1/2 h-[16px] w-[1480px] -translate-x-1/2 rounded-full border border-cyan-300/10 bg-cyan-400/4"></div>
          <div aria-label="外缘走廊 2" className="absolute bottom-[16%] left-1/2 h-[16px] w-[1480px] -translate-x-1/2 rounded-full border border-cyan-300/10 bg-cyan-400/4"></div>
          <div aria-label="外缘走廊 3" className="absolute top-1/2 left-[16%] h-[1480px] w-[16px] -translate-y-1/2 rounded-full border border-cyan-300/10 bg-cyan-400/4"></div>
          <div aria-label="外缘走廊 4" className="absolute top-1/2 right-[16%] h-[1480px] w-[16px] -translate-y-1/2 rounded-full border border-cyan-300/10 bg-cyan-400/4"></div>
          <div aria-label="外围支撑臂 1" className="absolute top-[20%] left-[20%] h-[18px] w-[260px] rotate-[35deg] rounded-full border border-cyan-300/10 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent"></div>
          <div aria-label="外围支撑臂 2" className="absolute top-[20%] right-[20%] h-[18px] w-[260px] -rotate-[35deg] rounded-full border border-cyan-300/10 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent"></div>
          <div aria-label="外围支撑臂 3" className="absolute bottom-[20%] left-[20%] h-[18px] w-[260px] -rotate-[35deg] rounded-full border border-cyan-300/10 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent"></div>
          <div aria-label="外围支撑臂 4" className="absolute bottom-[20%] right-[20%] h-[18px] w-[260px] rotate-[35deg] rounded-full border border-cyan-300/10 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent"></div>
          <div aria-label="上部墙体跨梁 1" className="absolute top-[9%] left-1/2 h-[110px] w-[1660px] -translate-x-1/2 rounded-[38px] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(34,211,238,0.12),rgba(8,15,28,0.72))] shadow-[0_0_40px_rgba(34,211,238,0.08),inset_0_0_40px_rgba(34,211,238,0.08)]"></div>
          <div aria-label="上部墙体跨梁 2" className="absolute top-[12.5%] left-1/2 h-[30px] w-[1460px] -translate-x-1/2 rounded-full border border-cyan-300/14 bg-cyan-400/8"></div>
          <div aria-label="侧壁基槽 1" className="absolute top-1/2 left-[7.5%] h-[1620px] w-[118px] -translate-y-1/2 rounded-[40px] border border-cyan-300/18 bg-[linear-gradient(90deg,rgba(8,15,28,0.82),rgba(34,211,238,0.1))] shadow-[0_0_30px_rgba(34,211,238,0.06),inset_0_0_36px_rgba(34,211,238,0.08)]"></div>
          <div aria-label="侧壁基槽 2" className="absolute top-1/2 right-[7.5%] h-[1620px] w-[118px] -translate-y-1/2 rounded-[40px] border border-cyan-300/18 bg-[linear-gradient(270deg,rgba(8,15,28,0.82),rgba(34,211,238,0.1))] shadow-[0_0_30px_rgba(34,211,238,0.06),inset_0_0_36px_rgba(34,211,238,0.08)]"></div>
          <div aria-label="底部总地基 1" className="absolute bottom-[4%] left-1/2 h-[220px] w-[1760px] -translate-x-1/2 rounded-[48px] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(8,15,28,0.88))] shadow-[0_0_40px_rgba(34,211,238,0.08),inset_0_0_40px_rgba(34,211,238,0.08)]"></div>
          <div aria-label="底部总地基 2" className="absolute bottom-[8.5%] left-1/2 h-[42px] w-[1540px] -translate-x-1/2 rounded-full border border-cyan-300/14 bg-cyan-400/8"></div>
          <div aria-label="内层顶棚块 1" className="absolute top-[18%] left-1/2 h-[96px] w-[1100px] -translate-x-1/2 rounded-[36px] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(34,211,238,0.18),rgba(8,15,28,0.88))] shadow-[0_0_32px_rgba(34,211,238,0.08),inset_0_0_32px_rgba(34,211,238,0.08)]"></div>
          <div aria-label="内层顶棚块 2" className="absolute top-[21.5%] left-1/2 h-[28px] w-[960px] -translate-x-1/2 rounded-full border border-cyan-300/14 bg-cyan-400/10"></div>
          <div aria-label="顶部屋盖 1" className="absolute top-[14%] left-1/2 h-[150px] w-[1320px] -translate-x-1/2 rounded-[42px] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(34,211,238,0.14),rgba(8,15,28,0.9))] shadow-[0_0_36px_rgba(34,211,238,0.08),inset_0_0_36px_rgba(34,211,238,0.08)]"></div>
          <div aria-label="顶部屋盖 2" className="absolute top-[17.5%] left-1/2 h-[36px] w-[1180px] -translate-x-1/2 rounded-full border border-cyan-300/14 bg-cyan-400/10"></div>
          <div aria-label="内层侧壁块 1" className="absolute top-1/2 left-[16%] h-[1080px] w-[108px] -translate-y-1/2 rounded-[36px] border border-cyan-300/18 bg-[linear-gradient(90deg,rgba(8,15,28,0.9),rgba(34,211,238,0.14))] shadow-[0_0_30px_rgba(34,211,238,0.08),inset_0_0_30px_rgba(34,211,238,0.08)]"></div>
          <div aria-label="内层侧壁块 2" className="absolute top-1/2 right-[16%] h-[1080px] w-[108px] -translate-y-1/2 rounded-[36px] border border-cyan-300/18 bg-[linear-gradient(270deg,rgba(8,15,28,0.9),rgba(34,211,238,0.14))] shadow-[0_0_30px_rgba(34,211,238,0.08),inset_0_0_30px_rgba(34,211,238,0.08)]"></div>
          <div aria-label="侧壁承重仓 1" className="absolute top-1/2 left-[11.5%] h-[1260px] w-[138px] -translate-y-1/2 rounded-[40px] border border-cyan-300/18 bg-[linear-gradient(90deg,rgba(8,15,28,0.92),rgba(34,211,238,0.14))] shadow-[0_0_34px_rgba(34,211,238,0.08),inset_0_0_34px_rgba(34,211,238,0.08)]"></div>
          <div aria-label="侧壁承重仓 2" className="absolute top-1/2 right-[11.5%] h-[1260px] w-[138px] -translate-y-1/2 rounded-[40px] border border-cyan-300/18 bg-[linear-gradient(270deg,rgba(8,15,28,0.92),rgba(34,211,238,0.14))] shadow-[0_0_34px_rgba(34,211,238,0.08),inset_0_0_34px_rgba(34,211,238,0.08)]"></div>
          <div aria-label="内层底座块 1" className="absolute bottom-[16%] left-1/2 h-[146px] w-[1220px] -translate-x-1/2 rounded-[42px] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(34,211,238,0.12),rgba(8,15,28,0.9))] shadow-[0_0_30px_rgba(34,211,238,0.08),inset_0_0_30px_rgba(34,211,238,0.08)]"></div>
          <div aria-label="内层底座块 2" className="absolute bottom-[19.5%] left-1/2 h-[30px] w-[1060px] -translate-x-1/2 rounded-full border border-cyan-300/14 bg-cyan-400/10"></div>
          <div aria-label="底部承重台 1" className="absolute bottom-[11.5%] left-1/2 h-[180px] w-[1420px] -translate-x-1/2 rounded-[46px] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(34,211,238,0.14),rgba(8,15,28,0.92))] shadow-[0_0_36px_rgba(34,211,238,0.08),inset_0_0_36px_rgba(34,211,238,0.08)]"></div>
          <div aria-label="底部承重台 2" className="absolute bottom-[15%] left-1/2 h-[36px] w-[1240px] -translate-x-1/2 rounded-full border border-cyan-300/14 bg-cyan-400/10"></div>
          <div aria-label="左侧结构塔 1" className="absolute top-[30%] left-[27%] h-[300px] w-[42px] rounded-2xl border border-cyan-400/12 bg-cyan-500/4 shadow-[0_0_20px_rgba(34,211,238,0.08)]"></div>
          <div aria-label="左侧结构塔 2" className="absolute top-[34%] left-[30%] h-[220px] w-[18px] rounded-full border border-cyan-300/10 bg-cyan-400/4"></div>
          <div aria-label="右侧结构塔 1" className="absolute top-[28%] right-[27%] h-[340px] w-[46px] rounded-2xl border border-cyan-400/12 bg-cyan-500/4 shadow-[0_0_20px_rgba(34,211,238,0.08)]"></div>
          <div aria-label="右侧结构塔 2" className="absolute top-[35%] right-[30%] h-[240px] w-[18px] rounded-full border border-cyan-300/10 bg-cyan-400/4"></div>
          <div aria-label="下方维护平台 1" className="absolute bottom-[26%] left-1/2 h-[90px] w-[360px] -translate-x-1/2 rounded-2xl border border-cyan-400/12 bg-cyan-500/4"></div>
          <div aria-label="下方维护平台 2" className="absolute bottom-[29%] left-1/2 h-[20px] w-[280px] -translate-x-1/2 rounded-full border border-cyan-300/10 bg-cyan-400/4"></div>
          <div aria-label="能量连线 1" className="absolute top-1/2 left-1/2 h-[2px] w-[340px] -translate-x-1/2 -translate-y-[120px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"></div>
          <div aria-label="能量连线 2" className="absolute top-1/2 left-1/2 h-[2px] w-[340px] -translate-x-1/2 translate-y-[118px] bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent"></div>
          <div aria-label="能量连线 3" className="absolute top-1/2 left-1/2 h-[280px] w-[2px] -translate-x-[118px] -translate-y-1/2 bg-gradient-to-b from-transparent via-cyan-400/40 to-transparent"></div>
          <div aria-label="能量连线 4" className="absolute top-1/2 left-1/2 h-[280px] w-[2px] translate-x-[118px] -translate-y-1/2 bg-gradient-to-b from-transparent via-cyan-400/28 to-transparent"></div>
          <div aria-label="舱室粒子 1" className="absolute top-[42%] left-[46%] h-2 w-2 rounded-full bg-cyan-300/70 shadow-[0_0_12px_rgba(103,232,249,0.9)] animate-pulse"></div>
          <div aria-label="舱室粒子 2" className="absolute top-[57%] left-[54%] h-1.5 w-1.5 rounded-full bg-cyan-200/70 shadow-[0_0_10px_rgba(165,243,252,0.8)] animate-pulse"></div>
          <div aria-label="舱室粒子 3" className="absolute top-[48%] left-[58%] h-1 w-1 rounded-full bg-cyan-100/70 shadow-[0_0_8px_rgba(207,250,254,0.8)] animate-pulse"></div>
          <div aria-label="舱室粒子 4" className="absolute top-[39%] left-[53%] h-1.5 w-1.5 rounded-full bg-cyan-300/65 shadow-[0_0_10px_rgba(103,232,249,0.8)] animate-pulse"></div>
          <div aria-label="舱室粒子 5" className="absolute top-[61%] left-[47%] h-1.5 w-1.5 rounded-full bg-cyan-200/60 shadow-[0_0_10px_rgba(165,243,252,0.7)] animate-pulse"></div>
        </div>

        <div
          aria-label="中心遥测集群"
          className="absolute top-0 left-0 w-full h-full"
          data-cluster-scale={clusterScale.toFixed(3)}
          style={{ transform: `scale(${clusterScale})`, transformOrigin: 'center center' }}
        >
          {modules.map((module) => (
            <ServerRack
              key={module.id}
              module={module}
              onClick={onSelectModule}
              isSelected={module.id === selectedModuleId}
            />
          ))}

          <div className="absolute top-1/2 left-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-cyan-400/10"></div>
          <div className="absolute top-1/2 left-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/8"></div>
          <div className="absolute top-1/2 left-1/2 h-[680px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/6"></div>
          <div aria-label="舱室扫描网格 2" className="absolute top-1/2 left-1/2 h-[860px] w-[860px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/5"></div>

          {agents.map((agent) => (
            <Agent key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  )
}
