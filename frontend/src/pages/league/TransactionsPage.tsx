import { useState, useEffect, useCallback } from 'react'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'
import { useLeague } from '../../hooks/useLeague'

type TransactionType = 'Trade' | 'Signing' | 'Waiver' | 'Injury'
type FilterType = 'All' | TransactionType

interface Transaction {
  id: string
  type: TransactionType
  date: string
  headline: string
  details: string
  breaking?: boolean
  tradeSides?: { team: string; sends: string }[]
}

const TYPE_ACCENT: Record<TransactionType, string> = {
  Trade: 'bg-[oklch(64.6%_0.222_41.116)]',
  Signing: 'bg-green-400',
  Waiver: 'bg-red-400',
  Injury: 'bg-yellow-400',
}

const TYPE_BADGE: Record<TransactionType, string> = {
  Trade: 'bg-[oklch(64.6%_0.222_41.116)]/15 text-[oklch(64.6%_0.222_41.116)] border-[oklch(64.6%_0.222_41.116)]/30',
  Signing: 'bg-green-400/15 text-green-400 border-green-400/30',
  Waiver: 'bg-red-400/15 text-red-400 border-red-400/30',
  Injury: 'bg-yellow-400/15 text-yellow-400 border-yellow-400/30',
}

const FILTERS: FilterType[] = ['All', 'Trade', 'Signing', 'Waiver', 'Injury']

function formatDisplayDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function TransactionsPage() {
  const { db, state, loading } = useLeague()
  const [activeFilter, setActiveFilter] = useState<FilterType>('All')
  const [transactions, setTransactions] = useState<Transaction[]>([])

  const loadTransactions = useCallback(async () => {
    if (!db) return
    const txTable = db.table('transactions')
    try {
      const all = await txTable.toArray()
      setTransactions(
        all.map((t: Record<string, unknown>) => ({
          id: t.id as string,
          type: (t.type === 'trade' ? 'Trade' : t.type === 'signing' ? 'Signing' : t.type === 'waiver' ? 'Waiver' : t.type === 'injury' ? 'Injury' : t.type) as TransactionType,
          date: t.date as string,
          headline: (t.headline ?? t.description ?? '') as string,
          details: (typeof t.details === 'string' ? t.details : t.description ?? '') as string,
          breaking: t.breaking as boolean | undefined,
          tradeSides: t.tradeSides as { team: string; sends: string }[] | undefined,
        }))
      )
    } catch {
      setTransactions([])
    }
  }, [db])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  if (loading || !state) {
    return (
      <PageTransition>
        <div className="text-gray-400 text-center py-20">Loading transactions...</div>
      </PageTransition>
    )
  }

  const filtered = activeFilter === 'All'
    ? transactions
    : transactions.filter(t => t.type === activeFilter)

  const breakingTx = filtered.find(t => t.breaking)
  const feedTxs = filtered.filter(t => t !== breakingTx)

  return (
    <PageTransition>
      <div>
        <h1 className="font-display text-4xl tracking-wide text-white mb-6">Transactions</h1>

        <div className="flex gap-1 flex-wrap mb-6">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeFilter === f
                  ? 'text-[oklch(64.6%_0.222_41.116)] bg-[oklch(64.6%_0.222_41.116)]/10'
                  : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {f === 'All' ? 'All' : `${f}s`}
            </button>
          ))}
        </div>

        {breakingTx && (
          <GlassCard className="mb-6 overflow-hidden border-[oklch(64.6%_0.222_41.116)]/30" variant="medium">
            <div className="flex">
              <div className="w-1.5 bg-[oklch(64.6%_0.222_41.116)] shrink-0" />
              <div className="flex-1 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-2.5 py-1 rounded text-[10px] uppercase tracking-[2px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                    Breaking
                  </span>
                  <span className="text-xs text-gray-500">{formatDisplayDate(breakingTx.date)}</span>
                </div>
                <h3 className="text-lg font-display tracking-wide text-white mb-2">
                  {breakingTx.headline}
                </h3>
                <p className="text-sm text-gray-400 mb-3">{breakingTx.details}</p>
                {breakingTx.tradeSides && (
                  <div className="flex flex-col sm:flex-row gap-3 mt-3 pt-3 border-t border-white/[0.06]">
                    {breakingTx.tradeSides.map((side, i) => (
                      <div key={side.team} className="flex items-center gap-3 flex-1">
                        {i > 0 && (
                          <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full border border-white/[0.08] text-gray-600 text-xs shrink-0">
                            &#8644;
                          </div>
                        )}
                        <div className="flex-1 bg-white/[0.04] rounded-lg px-4 py-3 border border-white/[0.06]">
                          <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-1">{side.team} sends</div>
                          <div className="text-sm text-white">{side.sends}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </GlassCard>
        )}

        {feedTxs.length === 0 && !breakingTx ? (
          <GlassCard className="p-12">
            <div className="text-center">
              <p className="text-gray-500 text-sm mb-2">No transactions yet</p>
              <p className="text-gray-600 text-xs">Trades, signings, and other transactions will appear here as the season progresses.</p>
            </div>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {feedTxs.map(tx => (
              <GlassCard key={tx.id} className="overflow-hidden">
                <div className="flex">
                  <div className={`w-1 shrink-0 ${TYPE_ACCENT[tx.type]}`} />
                  <div className="flex-1 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-[1px] font-medium border ${TYPE_BADGE[tx.type]}`}>
                          {tx.type}
                        </span>
                      </div>
                      <span className="text-xs text-gray-600 shrink-0">{formatDisplayDate(tx.date)}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-1.5">{tx.headline}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">{tx.details}</p>
                    {tx.tradeSides && (
                      <div className="flex flex-col sm:flex-row gap-2 mt-3 pt-3 border-t border-white/[0.04]">
                        {tx.tradeSides.map((side, i) => (
                          <div key={side.team} className="flex items-center gap-2 flex-1">
                            {i > 0 && (
                              <div className="hidden sm:flex items-center justify-center w-6 h-6 rounded-full border border-white/[0.06] text-gray-600 text-[10px] shrink-0">
                                &#8644;
                              </div>
                            )}
                            <div className="flex-1 bg-white/[0.03] rounded-lg px-3 py-2 border border-white/[0.04]">
                              <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-0.5">{side.team} sends</div>
                              <div className="text-xs text-gray-300">{side.sends}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  )
}
