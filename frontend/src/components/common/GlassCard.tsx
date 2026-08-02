import type { ReactNode } from 'react'

type GlassVariant = 'subtle' | 'medium' | 'section' | 'heavy'

interface GlassCardProps {
  children: ReactNode
  variant?: GlassVariant
  className?: string
  onClick?: () => void
  hover?: boolean
}

const VARIANT_STYLES: Record<GlassVariant, string> = {
  subtle: 'bg-white/[0.04] border border-white/[0.08]',
  medium: 'backdrop-blur-md bg-slate-950/60 border border-white/[0.06]',
  section: 'bg-slate-950/50 border border-white/[0.06]',
  heavy: 'backdrop-blur-md bg-slate-950/30 border border-white/[0.06]',
}

export default function GlassCard({ children, variant = 'subtle', className = '', onClick, hover = false }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl ${VARIANT_STYLES[variant]} ${hover ? 'hover:scale-[1.02] transition-all duration-200 cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
