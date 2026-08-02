import type { InputHTMLAttributes } from 'react'

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string
}

export default function SearchInput({ className = '', ...props }: SearchInputProps) {
  return (
    <input
      type="text"
      className={`bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-white/[0.15] transition-colors w-full ${className}`}
      {...props}
    />
  )
}
