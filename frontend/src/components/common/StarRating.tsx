interface StarRatingProps {
  stars: number
  maxStars?: number
  size?: number
  className?: string
}

function StarIcon({ fill, size }: { fill: 'full' | 'half' | 'empty'; size: number }) {
  const color = fill === 'empty' ? 'rgba(255,255,255,0.1)' : 'oklch(64.6% 0.222 41.116)'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <clipPath id={`half-${size}`}>
          <rect x="0" y="0" width="12" height="24" />
        </clipPath>
      </defs>
      {fill === 'half' ? (
        <>
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill="rgba(255,255,255,0.1)"
          />
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={color}
            clipPath={`url(#half-${size})`}
          />
        </>
      ) : (
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          fill={color}
        />
      )}
    </svg>
  )
}

export default function StarRating({ stars, maxStars = 5, size = 14, className = '' }: StarRatingProps) {
  const elements: ('full' | 'half' | 'empty')[] = []

  for (let i = 1; i <= maxStars; i++) {
    if (stars >= i) elements.push('full')
    else if (stars >= i - 0.5) elements.push('half')
    else elements.push('empty')
  }

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {elements.map((fill, i) => (
        <StarIcon key={i} fill={fill} size={size} />
      ))}
    </div>
  )
}
