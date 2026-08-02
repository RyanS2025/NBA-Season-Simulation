interface PlayerAvatarProps {
  firstName: string
  lastName: string
  teamColor?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_MAP = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-lg',
}

export default function PlayerAvatar({ firstName, lastName, teamColor, size = 'md', className = '' }: PlayerAvatarProps) {
  const initials = `${firstName[0] || ''}${lastName[0] || ''}`

  return (
    <div
      className={`${SIZE_MAP[size]} rounded-full flex items-center justify-center font-semibold text-white ${className}`}
      style={{
        background: teamColor ? `${teamColor}25` : 'rgba(255,255,255,0.06)',
        border: `2px solid ${teamColor || 'rgba(255,255,255,0.1)'}`,
      }}
    >
      {initials}
    </div>
  )
}
