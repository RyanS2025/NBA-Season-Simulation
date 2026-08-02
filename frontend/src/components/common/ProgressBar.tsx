interface ProgressBarProps {
  value: number
  max?: number
  color?: string
  height?: string
  showLabel?: boolean
  className?: string
}

export default function ProgressBar({ value, max = 100, color, height = 'h-1.5', showLabel = false, className = '' }: ProgressBarProps) {
  const pct = Math.min((value / max) * 100, 100)

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between text-[10px] uppercase tracking-[2px] text-gray-600 mb-1">
          <span>{value}</span>
          <span>{max}</span>
        </div>
      )}
      <div className={`w-full ${height} bg-white/[0.06] rounded-full overflow-hidden`}>
        <div
          className={`${height} rounded-full transition-all duration-500`}
          style={{
            width: `${pct}%`,
            background: color || 'oklch(64.6% 0.222 41.116)',
          }}
        />
      </div>
    </div>
  )
}
