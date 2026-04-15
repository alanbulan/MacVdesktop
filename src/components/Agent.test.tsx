import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { telemetryChamberLayout } from '../domain/telemetry/layout'
import { Agent, getAgentPixelPosition } from './Agent'

describe('Agent positioning', () => {
  it('uses shared chamber layout pixel scaling for restored inspection agents', () => {
    const position = getAgentPixelPosition({ x: 10, y: 10 })

    expect(position).toEqual({ x: 10 * telemetryChamberLayout.pixelUnit, y: 10 * telemetryChamberLayout.pixelUnit })
  })

  it('shows richer working-state action copy for live telemetry modules', () => {
    render(
      <Agent
        agent={{
          id: 'inspection-agent-cpu',
          name: 'CPU Cluster',
          task: '巡检 CPU Cluster',
          role: 'engineer',
          x: 10,
          y: 10,
          status: 'working',
          detail: '主指标 42% · 实时 · 无宿主告警',
        }}
      />,
    )

    expect(screen.getByText('巡检 CPU Cluster')).toBeTruthy()
    expect(screen.getByText('主指标 42% · 实时 · 无宿主告警')).toBeTruthy()
  })

  it('keeps richer role staging without extra attached add-on props', () => {
    render(
      <>
        <Agent
          agent={{
            id: 'inspection-agent-security',
            name: 'GPU Activity',
            task: '同步 GPU Activity',
            role: 'security',
            x: 10,
            y: 10,
            status: 'working',
            detail: '扫描 GPU Activity 协同路径 · 主指标 42%',
          }}
        />
        <Agent
          agent={{
            id: 'inspection-agent-admin',
            name: 'CPU Cluster',
            task: '复核 CPU Cluster',
            role: 'admin',
            x: 11,
            y: 10,
            status: 'idle',
            detail: '来源 tauri-host · 主指标 42%',
          }}
        />
      </>,
    )

    expect(screen.getByText('同步 GPU Activity')).toBeTruthy()
    expect(screen.getByText('复核 CPU Cluster')).toBeTruthy()
    expect(screen.queryByLabelText(/安全扫描束/i)).toBeNull()
    expect(screen.queryByLabelText(/管理全息板/i)).toBeNull()
  })

  it('shows a visible moving-state animation marker for patrol agents', () => {
    render(
      <Agent
        agent={{
          id: 'inspection-agent-cpu',
          name: 'CPU Cluster',
          task: '巡检 CPU Cluster',
          role: 'engineer',
          x: 10,
          y: 10,
          status: 'moving',
        }}
      />,
    )

    expect(screen.getByLabelText(/移动轨迹/i)).toBeTruthy()
  })
})
