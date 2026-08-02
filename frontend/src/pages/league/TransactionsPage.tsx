import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'

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

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 't1',
    type: 'Trade',
    date: '2025-02-06',
    headline: 'TRADE: Dallas sends Nikolai Petrovic to Chicago for Damian Rhodes + 2027 1st',
    details: 'Dallas receives Damian Rhodes (4yr/$172M), 2027 1st round pick (top-5 protected). Chicago receives Nikolai Petrovic (3yr/$118M). Salaries match within 125% threshold.',
    breaking: true,
    tradeSides: [
      { team: 'DAL', sends: 'Nikolai Petrovic' },
      { team: 'CHI', sends: 'Damian Rhodes + 2027 1st' },
    ],
  },
  {
    id: 't2',
    type: 'Signing',
    date: '2025-02-05',
    headline: 'SIGNING: Karl-Anthony Reed agrees to 5-year max extension with Milwaukee',
    details: 'Reed signs a 5-year, $245M supermax extension with the Bucks. The deal includes a player option in the final year and a 15% trade kicker.',
  },
  {
    id: 't3',
    type: 'Injury',
    date: '2025-02-05',
    headline: 'INJURY: Jayson Williams (BOS) out 4-6 weeks with Grade 2 ankle sprain',
    details: 'Williams suffered the injury in the 3rd quarter against Cleveland. MRI confirmed a Grade 2 lateral ankle sprain. Expected return mid-March.',
  },
  {
    id: 't4',
    type: 'Trade',
    date: '2025-02-04',
    headline: 'TRADE: Philly acquires Kentavious Pope from Phoenix for Garrison Mathews Jr. + 2nd',
    details: 'Philadelphia receives Kentavious Pope ($12M). Phoenix receives Garrison Mathews Jr. ($1.8M) and a 2026 2nd round pick.',
    tradeSides: [
      { team: 'PHI', sends: 'Garrison Mathews Jr. + 2026 2nd' },
      { team: 'PHX', sends: 'Kentavious Pope' },
    ],
  },
  {
    id: 't5',
    type: 'Waiver',
    date: '2025-02-04',
    headline: 'WAIVER: Denver waives Tony Snell Jr.',
    details: 'Snell clears waivers and becomes an unrestricted free agent. Denver saves $1.9M in luxury tax payments. Snell averaged 3.8 PPG in 42 games.',
  },
  {
    id: 't6',
    type: 'Signing',
    date: '2025-02-03',
    headline: 'SIGNING: Larry Nance IV signs 2-year deal with Golden State',
    details: 'Nance signs a 2-year, $18M deal with the Warriors. He will serve as a key rotation big behind Zion Palmer.',
  },
  {
    id: 't7',
    type: 'Injury',
    date: '2025-02-03',
    headline: 'INJURY: Jalen Crawford (MIN) day-to-day with hamstring tightness',
    details: 'Crawford left practice early with right hamstring tightness. Timberwolves will re-evaluate before tomorrow\'s game against Atlanta.',
  },
  {
    id: 't8',
    type: 'Trade',
    date: '2025-01-30',
    headline: 'TRADE: Toronto sends Pascal Okafor to Cleveland for Santiago Reyes + picks',
    details: 'Toronto receives Santiago Reyes ($14M), 2026 1st (lottery protected), 2027 2nd. Cleveland receives Pascal Okafor ($24M). Toronto absorbs additional salary via trade exception.',
    tradeSides: [
      { team: 'TOR', sends: 'Pascal Okafor' },
      { team: 'CLE', sends: 'Santiago Reyes + 2026 1st + 2027 2nd' },
    ],
  },
  {
    id: 't9',
    type: 'Waiver',
    date: '2025-01-28',
    headline: 'WAIVER: Atlanta waives Robin Lopez III',
    details: 'Lopez is waived with a partially guaranteed contract. The Hawks open a roster spot ahead of the trade deadline. Lopez had a $2.8M salary.',
  },
  {
    id: 't10',
    type: 'Signing',
    date: '2025-01-25',
    headline: 'SIGNING: Ish Smith III signs 10-day contract with Boston',
    details: 'Smith signs a 10-day hardship deal worth $130K with the Celtics. He provides veteran backcourt depth with Marcus Smart II in the concussion protocol.',
  },
  {
    id: 't11',
    type: 'Injury',
    date: '2025-01-23',
    headline: 'INJURY: Marcus Smart II (BOS) enters concussion protocol',
    details: 'Smart took an elbow to the head during the 4th quarter against Miami. He has been placed in the league\'s concussion protocol with no timetable for return.',
  },
  {
    id: 't12',
    type: 'Trade',
    date: '2025-01-20',
    headline: 'TRADE: Miami sends Tobias Adebayo to Denver for Andre Baptiste + Jaylen Watkins',
    details: 'Denver receives Tobias Adebayo ($34M). Miami receives Andre Baptiste ($18M) and Jaylen Watkins ($15M). Miami also gets a 2027 swap right.',
    breaking: true,
    tradeSides: [
      { team: 'MIA', sends: 'Tobias Adebayo' },
      { team: 'DEN', sends: 'Andre Baptiste + Jaylen Watkins' },
    ],
  },
  {
    id: 't13',
    type: 'Signing',
    date: '2025-01-18',
    headline: 'SIGNING: Dwight Powell Jr. signs rest-of-season deal with Sacramento',
    details: 'Powell signs for the veteran minimum ($2.1M prorated). The Kings add frontcourt depth after injuries to their rotation bigs.',
  },
  {
    id: 't14',
    type: 'Waiver',
    date: '2025-01-15',
    headline: 'WAIVER: Phoenix waives Cody Martin Jr.',
    details: 'Martin is waived to open a roster spot for an incoming trade acquisition. He appeared in 28 games, averaging 5.1 PPG.',
  },
  {
    id: 't15',
    type: 'Injury',
    date: '2025-01-12',
    headline: 'INJURY: Darnell Brooks (DAL) out 2-3 weeks with calf strain',
    details: 'Brooks will miss approximately 8-10 games with a right calf strain. Dallas has depth at the wing but his scoring off the bench will be missed.',
  },
  {
    id: 't16',
    type: 'Trade',
    date: '2025-01-10',
    headline: 'TRADE: Golden State sends Bobby Portis III to Milwaukee for 2026 2nd + cash',
    details: 'Milwaukee receives Bobby Portis III ($11M). Golden State receives a 2026 2nd round pick and $2M cash considerations.',
    tradeSides: [
      { team: 'GSW', sends: 'Bobby Portis III' },
      { team: 'MIL', sends: '2026 2nd + $2M cash' },
    ],
  },
  {
    id: 't17',
    type: 'Signing',
    date: '2025-01-08',
    headline: 'SIGNING: Delon Wright Jr. signs 2-year deal with Chicago',
    details: 'Wright signs a 2-year, $5.2M deal with the Bulls. He will serve as the third-string point guard behind Rhodes.',
  },
  {
    id: 't18',
    type: 'Waiver',
    date: '2025-01-05',
    headline: 'WAIVER: Cleveland releases Frank Mason IV',
    details: 'Mason clears waivers after averaging 5.5 PPG and 3.8 APG in limited minutes. The Cavaliers free up a roster spot for a two-way conversion.',
  },
  {
    id: 't19',
    type: 'Injury',
    date: '2024-12-28',
    headline: 'INJURY: Zion Palmer (GSW) misses game with knee soreness',
    details: 'Palmer sat out the Warriors\' loss to Dallas with left knee soreness. It is described as a maintenance day and he is expected to play Friday.',
  },
  {
    id: 't20',
    type: 'Signing',
    date: '2024-12-22',
    headline: 'SIGNING: Thanasis Giannis signs 10-day contract with Minnesota',
    details: 'Giannis signs a 10-day deal with the Timberwolves. He provides veteran wing depth during a stretch of 5 games in 7 days.',
  },
]

function formatDisplayDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function TransactionsPage() {
  const { id: _leagueId } = useParams()
  const [activeFilter, setActiveFilter] = useState<FilterType>('All')

  const filtered = useMemo(() => {
    if (activeFilter === 'All') return MOCK_TRANSACTIONS
    return MOCK_TRANSACTIONS.filter(t => t.type === activeFilter)
  }, [activeFilter])

  const breakingTx = filtered.find(t => t.breaking)
  const feedTxs = filtered.filter(t => t !== breakingTx)

  return (
    <PageTransition>
      <div>
        <h1 className="font-display text-4xl tracking-wide text-white mb-6">Transactions</h1>

        {/* Filter Pills */}
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

        {/* Breaking News Banner */}
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

        {/* Transaction Feed */}
        {feedTxs.length === 0 ? (
          <GlassCard className="p-8">
            <p className="text-center text-gray-600">No transactions match your filter</p>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {feedTxs.map(tx => (
              <GlassCard key={tx.id} className="overflow-hidden">
                <div className="flex">
                  {/* Colored accent bar */}
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

                    {/* Trade sides */}
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
