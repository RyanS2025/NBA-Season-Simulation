import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <div className="font-display text-7xl text-accent mb-2">404</div>
        <h1 className="font-display text-2xl tracking-wide text-white mb-3">Out of Bounds</h1>
        <p className="text-gray-500 text-sm mb-8">This page doesn't exist — the play is dead.</p>
        <Link
          to="/"
          className="px-6 py-3 text-sm rounded-xl bg-accent text-white font-medium hover:brightness-110 transition-all"
        >
          Back to Home Court
        </Link>
      </div>
    </div>
  )
}
