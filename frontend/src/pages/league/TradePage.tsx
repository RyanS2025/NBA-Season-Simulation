import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'
import Button from '../../components/common/Button'

interface TradePlayer {
  id: string
  name: string
  position: string
  overall: number
  salary: number
  contractYears: number
  teamId: string
}

interface TradePick {
  id: string
  label: string
  teamId: string
}

interface TradeHistoryEntry {
  id: string
  date: string
  team1: string
  team1Gets: string[]
  team2: string
  team2Gets: string[]
}

const SALARY_CAP = 141_000_000

const ALL_TEAMS = [
  { id: 'PHI', name: 'Philadelphia Ironworks' },
  { id: 'NYT', name: 'New York Titans' },
  { id: 'BOS', name: 'Boston Minutemen' },
  { id: 'MIA', name: 'Miami Tides' },
  { id: 'CHI', name: 'Chicago Forge' },
  { id: 'LAV', name: 'Los Angeles Vipers' },
  { id: 'PHX', name: 'Phoenix Scorchers' },
  { id: 'DEN', name: 'Denver Altitude' },
  { id: 'DAL', name: 'Dallas Mustangs' },
  { id: 'GSS', name: 'Golden State Samurai' },
  { id: 'CLE', name: 'Cleveland Ironclad' },
  { id: 'MIN', name: 'Minnesota Blizzard' },
  { id: 'TOR', name: 'Toronto Raptides' },
  { id: 'MIL', name: 'Milwaukee Stags' },
  { id: 'ATL', name: 'Atlanta Phoenixes' },
]

const ALL_PLAYERS: TradePlayer[] = [
  // PHI Roster
  { id: 'p1', name: 'Marcus Cole', position: 'PG', overall: 93, salary: 42500000, contractYears: 3, teamId: 'PHI' },
  { id: 'p2', name: 'DeAndre Washington', position: 'SG', overall: 87, salary: 32000000, contractYears: 4, teamId: 'PHI' },
  { id: 'p3', name: 'Jaylen Foster', position: 'SF', overall: 84, salary: 28000000, contractYears: 3, teamId: 'PHI' },
  { id: 'p4', name: 'Tobias Green', position: 'PF', overall: 82, salary: 25000000, contractYears: 2, teamId: 'PHI' },
  { id: 'p5', name: 'Andre Drummond Jr.', position: 'C', overall: 85, salary: 22000000, contractYears: 3, teamId: 'PHI' },
  { id: 'p21', name: 'Xavier Bell', position: 'SG', overall: 78, salary: 14000000, contractYears: 2, teamId: 'PHI' },
  { id: 'p22', name: 'Jerome Watson', position: 'PF', overall: 76, salary: 8000000, contractYears: 1, teamId: 'PHI' },
  { id: 'p24', name: 'Miles Porter', position: 'PG', overall: 75, salary: 6000000, contractYears: 1, teamId: 'PHI' },
  // NYT Roster
  { id: 'p6', name: 'Jordan Mitchell', position: 'PG', overall: 95, salary: 48000000, contractYears: 4, teamId: 'NYT' },
  { id: 'p7', name: 'Kevin Bridges', position: 'SF', overall: 89, salary: 36000000, contractYears: 3, teamId: 'NYT' },
  { id: 'p30', name: 'Darius Lang', position: 'C', overall: 83, salary: 20000000, contractYears: 2, teamId: 'NYT' },
  { id: 'p31', name: 'Evan Schroeder', position: 'SG', overall: 79, salary: 15000000, contractYears: 3, teamId: 'NYT' },
  { id: 'p32', name: 'Rashid Okafor', position: 'PF', overall: 77, salary: 10000000, contractYears: 1, teamId: 'NYT' },
  // BOS Roster
  { id: 'p8', name: 'Malik Thompson', position: 'SG', overall: 91, salary: 38000000, contractYears: 5, teamId: 'BOS' },
  { id: 'p9', name: 'Chris Patterson', position: 'PF', overall: 86, salary: 30000000, contractYears: 2, teamId: 'BOS' },
  { id: 'p33', name: 'Aaron Finch', position: 'PG', overall: 80, salary: 16000000, contractYears: 3, teamId: 'BOS' },
  { id: 'p34', name: 'Zion Calloway', position: 'C', overall: 81, salary: 18000000, contractYears: 2, teamId: 'BOS' },
  // MIA Roster
  { id: 'p10', name: 'Dante Williams', position: 'PG', overall: 88, salary: 12200000, contractYears: 2, teamId: 'MIA' },
  { id: 'p11', name: 'Tyler Brooks', position: 'C', overall: 84, salary: 20000000, contractYears: 3, teamId: 'MIA' },
  { id: 'p35', name: 'Marco Silva', position: 'SF', overall: 80, salary: 14500000, contractYears: 2, teamId: 'MIA' },
]

const ALL_PICKS: TradePick[] = [
  { id: 'pick-phi-26-1', label: '2026 1st (PHI)', teamId: 'PHI' },
  { id: 'pick-phi-26-2', label: '2026 2nd (PHI)', teamId: 'PHI' },
  { id: 'pick-phi-27-1', label: '2027 1st (PHI)', teamId: 'PHI' },
  { id: 'pick-phi-27-2', label: '2027 2nd (PHI)', teamId: 'PHI' },
  { id: 'pick-nyt-26-1', label: '2026 1st (NYT)', teamId: 'NYT' },
  { id: 'pick-nyt-26-2', label: '2026 2nd (NYT)', teamId: 'NYT' },
  { id: 'pick-nyt-27-1', label: '2027 1st (NYT)', teamId: 'NYT' },
  { id: 'pick-bos-26-1', label: '2026 1st (BOS)', teamId: 'BOS' },
  { id: 'pick-bos-26-2', label: '2026 2nd (BOS)', teamId: 'BOS' },
  { id: 'pick-mia-26-1', label: '2026 1st (MIA)', teamId: 'MIA' },
  { id: 'pick-mia-26-2', label: '2026 2nd (MIA)', teamId: 'MIA' },
]

const TRADE_HISTORY: TradeHistoryEntry[] = [
  {
    id: 'th1',
    date: 'Jan 15, 2026',
    team1: 'Los Angeles Vipers',
    team1Gets: ['Chris Patterson (PF, 86 OVR)', '2027 1st (BOS)'],
    team2: 'Boston Minutemen',
    team2Gets: ['Brandon Park (PF, 90 OVR)'],
  },
  {
    id: 'th2',
    date: 'Jan 8, 2026',
    team1: 'Chicago Forge',
    team1Gets: ['Evan Schroeder (SG, 79 OVR)'],
    team2: 'New York Titans',
    team2Gets: ['Jason Rivera (SF, 86 OVR)', '2026 2nd (CHI)'],
  },
  {
    id: 'th3',
    date: 'Dec 20, 2025',
    team1: 'Denver Altitude',
    team1Gets: ['Marco Silva (SF, 80 OVR)', '2027 2nd (MIA)'],
    team2: 'Miami Tides',
    team2Gets: ['2026 1st (DEN)'],
  },
]

function formatSalary(salary: number): string {
  return `$${(salary / 1_000_000).toFixed(1)}M`
}

export default function TradePage() {
  const { id: _leagueId } = useParams()
  const userTeamId = 'PHI'

  const [partnerTeamId, setPartnerTeamId] = useState<string>('')
  const [selectedUserPlayers, setSelectedUserPlayers] = useState<Set<string>>(new Set())
  const [selectedPartnerPlayers, setSelectedPartnerPlayers] = useState<Set<string>>(new Set())
  const [selectedUserPicks, setSelectedUserPicks] = useState<Set<string>>(new Set())
  const [selectedPartnerPicks, setSelectedPartnerPicks] = useState<Set<string>>(new Set())

  const userPlayers = ALL_PLAYERS.filter(p => p.teamId === userTeamId)
  const partnerPlayers = ALL_PLAYERS.filter(p => p.teamId === partnerTeamId)
  const userPicks = ALL_PICKS.filter(p => p.teamId === userTeamId)
  const partnerPicks = ALL_PICKS.filter(p => p.teamId === partnerTeamId)

  const togglePlayer = (set: Set<string>, setFn: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setFn(next)
  }

  const togglePick = (set: Set<string>, setFn: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setFn(next)
  }

  // Reset partner selections when changing teams
  const handlePartnerChange = (newTeamId: string) => {
    setPartnerTeamId(newTeamId)
    setSelectedPartnerPlayers(new Set())
    setSelectedPartnerPicks(new Set())
  }

  const outgoingSalary = useMemo(() =>
    userPlayers.filter(p => selectedUserPlayers.has(p.id)).reduce((s, p) => s + p.salary, 0),
    [userPlayers, selectedUserPlayers]
  )

  const incomingSalary = useMemo(() =>
    partnerPlayers.filter(p => selectedPartnerPlayers.has(p.id)).reduce((s, p) => s + p.salary, 0),
    [partnerPlayers, selectedPartnerPlayers]
  )

  const hasAssets = selectedUserPlayers.size > 0 || selectedPartnerPlayers.size > 0 ||
    selectedUserPicks.size > 0 || selectedPartnerPicks.size > 0

  // Simplified trade validation
  const validation = useMemo(() => {
    if (!hasAssets) return { valid: false, reason: 'Select players or picks to trade' }
    if (selectedUserPlayers.size === 0 && selectedUserPicks.size === 0)
      return { valid: false, reason: 'Your team must offer something' }
    if (selectedPartnerPlayers.size === 0 && selectedPartnerPicks.size === 0)
      return { valid: false, reason: 'Trade partner must offer something' }

    // Salary matching check (simplified 125% + $100K rule for over-cap teams)
    if (outgoingSalary > 0 && incomingSalary > 0) {
      const maxIncoming = outgoingSalary * 1.25 + 100000
      const maxOutgoing = incomingSalary * 1.25 + 100000
      if (incomingSalary > maxOutgoing && outgoingSalary < SALARY_CAP) {
        return { valid: false, reason: 'Incoming salary exceeds matching rules' }
      }
      if (outgoingSalary > maxIncoming && incomingSalary < SALARY_CAP) {
        // This case is less common but still checked
      }
    }

    return { valid: true, reason: '' }
  }, [hasAssets, selectedUserPlayers, selectedPartnerPlayers, selectedUserPicks, selectedPartnerPicks, outgoingSalary, incomingSalary])

  const partnerTeams = ALL_TEAMS.filter(t => t.id !== userTeamId)

  return (
    <PageTransition>
      <div>
        <h1 className="font-display text-4xl tracking-wide text-white mb-6">Trade Center</h1>

        {/* Trade Builder */}
        <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Trade Builder</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Your Team */}
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-[oklch(64.6%_0.222_41.116)]" />
              <h3 className="text-sm font-semibold text-white">Your Team</h3>
              <span className="text-xs text-gray-500 ml-auto">Philadelphia Ironworks</span>
            </div>

            {/* Player list */}
            <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-2">Players</div>
            <div className="space-y-1 max-h-64 overflow-y-auto mb-4">
              {userPlayers.map(p => (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    selectedUserPlayers.has(p.id)
                      ? 'bg-[oklch(64.6%_0.222_41.116)]/10 border border-[oklch(64.6%_0.222_41.116)]/20'
                      : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedUserPlayers.has(p.id)}
                    onChange={() => togglePlayer(selectedUserPlayers, setSelectedUserPlayers, p.id)}
                    className="accent-[oklch(64.6%_0.222_41.116)]"
                  />
                  <span className="text-white text-sm flex-1">{p.name}</span>
                  <span className="text-gray-500 text-xs">{p.position}</span>
                  <span className="text-gray-400 text-xs w-8 text-center">{p.overall}</span>
                  <span className="text-gray-400 text-xs w-16 text-right">{formatSalary(p.salary)}</span>
                  <span className="text-gray-600 text-xs w-6 text-center">{p.contractYears}y</span>
                </label>
              ))}
            </div>

            {/* Pick selector */}
            <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-2">Draft Picks</div>
            <div className="flex flex-wrap gap-2">
              {userPicks.map(pick => (
                <button
                  key={pick.id}
                  onClick={() => togglePick(selectedUserPicks, setSelectedUserPicks, pick.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    selectedUserPicks.has(pick.id)
                      ? 'bg-[oklch(64.6%_0.222_41.116)]/15 text-[oklch(64.6%_0.222_41.116)] border border-[oklch(64.6%_0.222_41.116)]/30'
                      : 'bg-white/[0.03] text-gray-400 border border-white/[0.06] hover:bg-white/[0.06]'
                  }`}
                >
                  {pick.label}
                </button>
              ))}
            </div>
          </GlassCard>

          {/* Trade Partner */}
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <h3 className="text-sm font-semibold text-white">Trade Partner</h3>
            </div>

            {/* Team selector */}
            <select
              value={partnerTeamId}
              onChange={(e) => handlePartnerChange(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/[0.15] transition-colors mb-4 appearance-none cursor-pointer"
            >
              <option value="" className="bg-slate-900">Select a team...</option>
              {partnerTeams.map(t => (
                <option key={t.id} value={t.id} className="bg-slate-900">{t.name}</option>
              ))}
            </select>

            {partnerTeamId ? (
              <>
                {/* Player list */}
                <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-2">Players</div>
                <div className="space-y-1 max-h-64 overflow-y-auto mb-4">
                  {partnerPlayers.length === 0 ? (
                    <p className="text-gray-600 text-sm py-2">No players loaded for this team</p>
                  ) : (
                    partnerPlayers.map(p => (
                      <label
                        key={p.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                          selectedPartnerPlayers.has(p.id)
                            ? 'bg-blue-400/10 border border-blue-400/20'
                            : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPartnerPlayers.has(p.id)}
                          onChange={() => togglePlayer(selectedPartnerPlayers, setSelectedPartnerPlayers, p.id)}
                          className="accent-blue-400"
                        />
                        <span className="text-white text-sm flex-1">{p.name}</span>
                        <span className="text-gray-500 text-xs">{p.position}</span>
                        <span className="text-gray-400 text-xs w-8 text-center">{p.overall}</span>
                        <span className="text-gray-400 text-xs w-16 text-right">{formatSalary(p.salary)}</span>
                        <span className="text-gray-600 text-xs w-6 text-center">{p.contractYears}y</span>
                      </label>
                    ))
                  )}
                </div>

                {/* Pick selector */}
                <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-2">Draft Picks</div>
                <div className="flex flex-wrap gap-2">
                  {partnerPicks.length === 0 ? (
                    <p className="text-gray-600 text-sm">No picks available</p>
                  ) : (
                    partnerPicks.map(pick => (
                      <button
                        key={pick.id}
                        onClick={() => togglePick(selectedPartnerPicks, setSelectedPartnerPicks, pick.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                          selectedPartnerPicks.has(pick.id)
                            ? 'bg-blue-400/15 text-blue-400 border border-blue-400/30'
                            : 'bg-white/[0.03] text-gray-400 border border-white/[0.06] hover:bg-white/[0.06]'
                        }`}
                      >
                        {pick.label}
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-600 text-sm">
                Select a team to begin building a trade
              </div>
            )}
          </GlassCard>
        </div>

        {/* Trade Summary */}
        <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Trade Summary</h2>
        <GlassCard className="p-5 mb-8">
          {!hasAssets ? (
            <p className="text-gray-600 text-sm text-center py-4">
              Select players and picks above to see the trade summary
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Your team sends */}
                <div>
                  <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-2">PHI Sends</div>
                  <div className="space-y-1">
                    {userPlayers.filter(p => selectedUserPlayers.has(p.id)).map(p => (
                      <div key={p.id} className="flex justify-between px-3 py-1.5 text-sm bg-white/[0.02] rounded-lg">
                        <span className="text-[oklch(64.6%_0.222_41.116)]">{p.name} <span className="text-gray-500">({p.position})</span></span>
                        <span className="text-gray-400">{formatSalary(p.salary)}</span>
                      </div>
                    ))}
                    {userPicks.filter(p => selectedUserPicks.has(p.id)).map(p => (
                      <div key={p.id} className="flex justify-between px-3 py-1.5 text-sm bg-white/[0.02] rounded-lg">
                        <span className="text-[oklch(64.6%_0.222_41.116)]">{p.label}</span>
                        <span className="text-gray-600">Pick</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Partner team sends */}
                <div>
                  <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-2">{partnerTeamId || '???'} Sends</div>
                  <div className="space-y-1">
                    {partnerPlayers.filter(p => selectedPartnerPlayers.has(p.id)).map(p => (
                      <div key={p.id} className="flex justify-between px-3 py-1.5 text-sm bg-white/[0.02] rounded-lg">
                        <span className="text-blue-400">{p.name} <span className="text-gray-500">({p.position})</span></span>
                        <span className="text-gray-400">{formatSalary(p.salary)}</span>
                      </div>
                    ))}
                    {partnerPicks.filter(p => selectedPartnerPicks.has(p.id)).map(p => (
                      <div key={p.id} className="flex justify-between px-3 py-1.5 text-sm bg-white/[0.02] rounded-lg">
                        <span className="text-blue-400">{p.label}</span>
                        <span className="text-gray-600">Pick</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Salary breakdown */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/[0.06]">
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className="text-gray-500">Outgoing: </span>
                    <span className="text-white font-medium">{formatSalary(outgoingSalary)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Incoming: </span>
                    <span className="text-white font-medium">{formatSalary(incomingSalary)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {validation.valid ? (
                    <span className="flex items-center gap-1.5 text-green-400 text-xs">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      Trade is valid
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-red-400 text-xs">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      {validation.reason}
                    </span>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!validation.valid}
                  >
                    Propose Trade
                  </Button>
                </div>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Trade History */}
        <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Recent League Trades</h2>
        <div className="space-y-3">
          {TRADE_HISTORY.map(trade => (
            <GlassCard key={trade.id} className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-500">{trade.date}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium text-white mb-1.5">{trade.team1} receives</div>
                  {trade.team1Gets.map((item, i) => (
                    <div key={i} className="text-sm text-gray-400 pl-3 border-l-2 border-[oklch(64.6%_0.222_41.116)]/30 mb-1">{item}</div>
                  ))}
                </div>
                <div>
                  <div className="text-xs font-medium text-white mb-1.5">{trade.team2} receives</div>
                  {trade.team2Gets.map((item, i) => (
                    <div key={i} className="text-sm text-gray-400 pl-3 border-l-2 border-blue-400/30 mb-1">{item}</div>
                  ))}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </PageTransition>
  )
}
