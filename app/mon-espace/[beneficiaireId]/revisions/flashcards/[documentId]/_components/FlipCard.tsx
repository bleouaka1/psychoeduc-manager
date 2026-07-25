'use client'

import { useState } from 'react'

export function FlipCard({ recto, verso }: { recto: string; verso: string }) {
  const [retournee, setRetournee] = useState(false)

  return (
    <div className="w-full h-[150px] [perspective:1200px] cursor-pointer" onClick={() => setRetournee((r) => !r)}>
      <div
        className="relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d]"
        style={{ transform: retournee ? 'rotateY(180deg)' : undefined }}
      >
        <div className="absolute inset-0 [backface-visibility:hidden] bg-bg-card border border-border-soft rounded-2xl p-4 flex flex-col">
          <p className="text-text-primary text-[13.5px] font-medium flex-1">{recto}</p>
          <span className="font-data text-[9px] text-text-muted text-right">Toucher pour retourner</span>
        </div>
        <div
          className="absolute inset-0 [backface-visibility:hidden] bg-bg-surface border border-border-soft rounded-2xl p-4 flex items-center justify-center text-center"
          style={{ transform: 'rotateY(180deg)' }}
        >
          <p className="text-accent-gold text-[13.5px] font-semibold">{verso}</p>
        </div>
      </div>
    </div>
  )
}
