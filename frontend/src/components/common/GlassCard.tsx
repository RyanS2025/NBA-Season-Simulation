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
  subtle: 'panel',
  medium: 'panel backdrop-blur-md',
  section: 'panel',
  heavy: 'panel-glow backdrop-blur-md',
}

export default function GlassCard({ children, variant = 'subtle', className = '', onClick, hover = false }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={`${VARIANT_STYLES[variant]} ${hover ? 'hover:scale-[1.02] transition-all duration-200 cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
