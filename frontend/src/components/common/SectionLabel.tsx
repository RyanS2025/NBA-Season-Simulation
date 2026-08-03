import type { ReactNode } from 'react'

interface SectionLabelProps {
  children: ReactNode
  className?: string
}

export default function SectionLabel({ children, className = '' }: SectionLabelProps) {
  return (
    <h3 className={`text-[10px] uppercase tracking-[2px] text-gray-600 mb-3 ${className}`}>
      {children}
    </h3>
  )
}
