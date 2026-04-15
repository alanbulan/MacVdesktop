import React from 'react'
import type { InspectionAgent } from '../../types'
import { Agent } from '../Agent'

interface Props {
  agents: InspectionAgent[]
}

export const FactoryAgentLayer: React.FC<Props> = ({ agents }) => {
  return (
    <>
      {agents.map((agent) => (
        <Agent key={agent.id} agent={agent} />
      ))}
    </>
  )
}
