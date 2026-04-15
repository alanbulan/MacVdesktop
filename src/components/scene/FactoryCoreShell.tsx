import React from 'react'

export const FactoryCoreShell: React.FC = () => {
  return (
    <>
      <div className="absolute top-1/2 left-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-cyan-400/10" />
      <div className="absolute top-1/2 left-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/8" />
      <div className="absolute top-1/2 left-1/2 h-[680px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/6" />
      <div aria-label="舱室扫描网格 2" className="absolute top-1/2 left-1/2 h-[860px] w-[860px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/5" />
      <div aria-label="工厂主控环 1" className="absolute top-1/2 left-1/2 h-[610px] w-[610px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/8 border-dashed animate-[spin_40s_linear_infinite]" />
      <div aria-label="工厂主控环 2" className="absolute top-1/2 left-1/2 h-[740px] w-[740px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/6" />
    </>
  )
}
