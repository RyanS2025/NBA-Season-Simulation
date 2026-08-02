interface FilterPillProps {
  label: string
  active: boolean
  onClick: () => void
}

export default function FilterPill({ label, active, onClick }: FilterPillProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
        active
          ? 'border-accent/40 text-accent bg-accent/10'
          : 'border-white/[0.08] text-gray-600 bg-white/[0.03] hover:text-gray-400'
      }`}
    >
      {label}
    </button>
  )
}
