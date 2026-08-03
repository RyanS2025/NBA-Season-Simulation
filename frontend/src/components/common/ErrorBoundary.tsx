import { Component, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] p-8 text-center">
          <div className="text-4xl mb-4">🏀</div>
          <h1 className="font-display text-2xl tracking-wide text-white mb-2">Something went wrong</h1>
          <p className="text-gray-500 text-sm mb-2">
            The game hit an unexpected error. Your league data is safe — try reloading.
          </p>
          {this.state.message && (
            <p className="text-[11px] text-gray-600 font-mono mb-6 break-all">{this.state.message}</p>
          )}
          <div className="flex justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 text-sm rounded-xl bg-accent text-white font-medium hover:brightness-110 transition-all"
            >
              Reload
            </button>
            <Link
              to="/"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="px-5 py-2.5 text-sm rounded-xl bg-white/[0.06] border border-white/[0.08] text-gray-200 font-medium hover:bg-white/[0.10] transition-all"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    )
  }
}
