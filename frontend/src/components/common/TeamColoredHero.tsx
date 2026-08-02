import type { ReactNode } from 'react'

interface TeamColoredHeroProps {
  children: ReactNode
  teamColor: string
  className?: string
}

export default function TeamColoredHero({ children, teamColor, className = '' }: TeamColoredHeroProps) {
  return (
    <div
      className={`rounded-xl p-7 backdrop-blur-md relative overflow-hidden ${className}`}
      style={{
        background: `${teamColor}15`,
        border: `0.5px solid ${teamColor}30`,
      }}
    >
      <div
        className="absolute -top-10 -right-10 w-44 h-44 rounded-full blur-[60px] opacity-25"
        style={{ background: teamColor }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
