import PageTransition from '../../components/layout/PageTransition'

export default function LeagueDashboard() {
  return (
    <PageTransition>
      <div>
        <h1 className="font-display text-4xl tracking-wide text-white mb-6">
          GM Dashboard
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-6">
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Next Game</h2>
            <p className="text-gray-500 text-sm">No games scheduled</p>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-6">
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Record</h2>
            <p className="text-3xl font-semibold text-white">0 — 0</p>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-6">
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Recent Transactions</h2>
            <p className="text-gray-500 text-sm">No transactions yet</p>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
