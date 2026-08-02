import PageTransition from '../components/layout/PageTransition'

export default function AboutPage() {
  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto">
        <h1 className="font-display text-5xl tracking-wide text-white mb-6">
          About
        </h1>
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-8 space-y-4">
          <p className="text-gray-300 leading-relaxed">
            BBAL Sim is a browser-based NBA General Manager simulator. Build your franchise from the ground up — draft prospects, negotiate trades, manage the salary cap, and compete for championships.
          </p>
          <p className="text-gray-400 leading-relaxed text-sm">
            Built with React, Python (via Pyodide), and powered entirely in your browser. No server required — your league data stays on your device.
          </p>
        </div>
      </div>
    </PageTransition>
  )
}
