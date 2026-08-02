interface StatCardProps {
  value: string | number
  label: string
  accent?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_MAP = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-3xl',
}

export default function StatCard({ value, label, accent = false, size = 'md', className = '' }: StatCardProps) {
  return (
    <div className={`bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 text-center ${className}`}>
      <div className={`${SIZE_MAP[size]} font-semibold ${accent ? 'text-accent' : 'text-white'}`}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mt-1">
        {label}
      </div>
    </div>
  )
}
