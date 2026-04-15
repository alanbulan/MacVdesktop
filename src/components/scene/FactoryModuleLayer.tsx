import React from 'react'
import type { DashboardModule } from '../../types'
import { ServerRack } from '../ServerRack'

interface Props {
  modules: DashboardModule[]
  onSelectModule: (module: DashboardModule) => void
  selectedModuleId: string | null
}

export const FactoryModuleLayer: React.FC<Props> = ({ modules, onSelectModule, selectedModuleId }) => {
  return (
    <>
      {modules.map((module) => (
        <ServerRack
          key={module.id}
          module={module}
          onClick={onSelectModule}
          isSelected={module.id === selectedModuleId}
        />
      ))}
    </>
  )
}
