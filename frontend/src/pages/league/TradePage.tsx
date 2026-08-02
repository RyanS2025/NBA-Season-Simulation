import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'
import Button from '../../components/common/Button'
import { useLeague } from '../../hooks/useLeague'
import type { Player } from '../../types'

function formatSalary(salary: number): string {
  if (salary >= 1_000_000) return `$${(salary / 1_000_000).toFixed(1)}M`
  if (salary >= 1_000) return `$${(salary / 1_000).toFixed(0)}K`
  return `$${salary}`
}

function playerLabel(p: Player): string {
  return `${p.bio.firstName} ${p.bio.lastName}`
}

export default function TradePage() {
  const { id: leagueId } = useParams()
  const { teams, players, state, loading, executeTrade } = useLeague()

  const [partnerTeamId, setPartnerTeamId] = useState<string>('')
  const [selectedUserPlayers, setSelectedUserPlayers] = useState<Set<string>>(new Set())
  const [selectedPartnerPlayers, setSelectedPartnerPlayers] = useState<Set<string>>(new Set())
  const [tradeStatus, setTradeStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [executing, setExecuting] = useState(false)

  const userTeamId = state?.userTeamId ?? ''

  const userPlayers = useMemo(() =>
    players
      .filter(p => p.teamId === userTeamId)
      .sort((a, b) => b.ratings.overall - a.ratings.overall),
    [players, userTeamId]
  )

  const partnerPlayers = useMemo(() =>
    players
      .filter(p => p.teamId === partnerTeamId)
      .sort((a, b) => b.ratings.overall - a.ratings.overall),
    [players, partnerTeamId]
  )

  const outgoingSalary = useMemo(() =>
    userPlayers.filter(p => selectedUserPlayers.has(p.id)).reduce((s, p) => s + (p.contract?.annualSalary ?? 0), 0),
    [userPlayers, selectedUserPlayers]
  )

  const incomingSalary = useMemo(() =>
    partnerPlayers.filter(p => selectedPartnerPlayers.has(p.id)).reduce((s, p) => s + (p.contract?.annualSalary ?? 0), 0),
    [partnerPlayers, selectedPartnerPlayers]
  )

  const hasAssets = selectedUserPlayers.size > 0 || selectedPartnerPlayers.size > 0

  const validation = useMemo(() => {
    if (!hasAssets) return { valid: false, reason: 'Select players to trade' }
    if (selectedUserPlayers.size === 0)
      return { valid: false, reason: 'Your team must offer something' }
    if (selectedPartnerPlayers.size === 0)
      return { valid: false, reason: 'Trade partner must offer something' }

    if (outgoingSalary > 0 && incomingSalary > 0) {
      const maxIncoming = outgoingSalary * 1.25 + 100000
      if (incomingSalary > maxIncoming) {
        return { valid: false, reason: 'Incoming salary exceeds matching rules' }
      }
    }

    return { valid: true, reason: '' }
  }, [hasAssets, selectedUserPlayers, selectedPartnerPlayers, outgoingSalary, incomingSalary])

  if (loading || !state) {
    return (
      <PageTransition>
        <div className="text-gray-400 text-center py-20">Loading trade center...</div>
      </PageTransition>
    )
  }

  const userTeam = teams.find(t => t.id === userTeamId)
  const partnerTeams = teams.filter(t => t.id !== userTeamId)

  const togglePlayer = (set: Set<string>, setFn: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setFn(next)
  }

  const handlePartnerChange = (newTeamId: string) => {
    setPartnerTeamId(newTeamId)
    setSelectedPartnerPlayers(new Set())
    setTradeStatus(null)
  }

  const handleProposeTrade = async () => {
    if (!validation.valid || executing) return
    setExecuting(true)
    setTradeStatus(null)
    try {
      const result = await executeTrade(
        Array.from(selectedUserPlayers),
        Array.from(selectedPartnerPlayers),
        partnerTeamId,
      )
      if (result.executed) {
        setTradeStatus({ type: 'success', message: 'Trade completed successfully!' })
        setSelectedUserPlayers(new Set())
        setSelectedPartnerPlayers(new Set())
        setPartnerTeamId('')
      } else {
        setTradeStatus({ type: 'error', message: result.errors.join('. ') })
      }
    } catch {
      setTradeStatus({ type: 'error', message: 'Trade failed unexpectedly' })
    } finally {
      setExecuting(false)
    }
  }

  return (
    <PageTransition>
      <div>
        <h1 className="font-display text-4xl tracking-wide text-white mb-6">Trade Center</h1>

        <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Trade Builder</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-[oklch(64.6%_0.222_41.116)]" />
              <h3 className="text-sm font-semibold text-white">Your Team</h3>
              <span className="text-xs text-gray-500 ml-auto">
                {userTeam ? `${userTeam.info.city} ${userTeam.info.name}` : userTeamId}
              </span>
            </div>

            <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-2">Players</div>
            <div className="space-y-1 max-h-80 overflow-y-auto mb-4">
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
                  <Link
                    to={`/league/${leagueId}/players/${p.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-white text-sm flex-1 font-medium hover:text-[oklch(64.6%_0.222_41.116)] transition-colors truncate"
                  >
                    {playerLabel(p)}
                  </Link>
                  <span className="text-gray-500 text-xs">{p.bio.position}</span>
                  <span className="text-gray-400 text-xs w-8 text-center">{p.ratings.overall}</span>
                  <span className="text-gray-400 text-xs w-16 text-right">{formatSalary(p.contract?.annualSalary ?? 0)}</span>
                </label>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <h3 className="text-sm font-semibold text-white">Trade Partner</h3>
            </div>

            <select
              value={partnerTeamId}
              onChange={(e) => handlePartnerChange(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/[0.15] transition-colors mb-4 appearance-none cursor-pointer"
            >
              <option value="" className="bg-slate-900">Select a team...</option>
              {partnerTeams.map(t => (
                <option key={t.id} value={t.id} className="bg-slate-900">
                  {t.info.city} {t.info.name} ({t.seasonRecord.wins}-{t.seasonRecord.losses})
                </option>
              ))}
            </select>

            {partnerTeamId ? (
              <>
                <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-2">Players</div>
                <div className="space-y-1 max-h-80 overflow-y-auto mb-4">
                  {partnerPlayers.map(p => (
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
                      <Link
                        to={`/league/${leagueId}/players/${p.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-white text-sm flex-1 font-medium hover:text-[oklch(64.6%_0.222_41.116)] transition-colors truncate"
                      >
                        {playerLabel(p)}
                      </Link>
                      <span className="text-gray-500 text-xs">{p.bio.position}</span>
                      <span className="text-gray-400 text-xs w-8 text-center">{p.ratings.overall}</span>
                      <span className="text-gray-400 text-xs w-16 text-right">{formatSalary(p.contract?.annualSalary ?? 0)}</span>
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-600 text-sm">
                Select a team to begin building a trade
              </div>
            )}
          </GlassCard>
        </div>

        {tradeStatus && (
          <div className={`px-4 py-3 rounded-xl mb-4 text-sm font-medium ${
            tradeStatus.type === 'success'
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            {tradeStatus.message}
          </div>
        )}

        <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Trade Summary</h2>
        <GlassCard className="p-5 mb-8">
          {!hasAssets ? (
            <p className="text-gray-600 text-sm text-center py-4">
              Select players above to see the trade summary
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-2">{userTeamId} Sends</div>
                  <div className="space-y-1">
                    {userPlayers.filter(p => selectedUserPlayers.has(p.id)).map(p => (
                      <div key={p.id} className="flex justify-between px-3 py-1.5 text-sm bg-white/[0.02] rounded-lg">
                        <span>
                          <Link to={`/league/${leagueId}/players/${p.id}`} className="text-[oklch(64.6%_0.222_41.116)] font-medium hover:brightness-125 transition-colors">
                            {playerLabel(p)}
                          </Link>
                          <span className="text-gray-500"> ({p.bio.position})</span>
                        </span>
                        <span className="text-gray-400">{formatSalary(p.contract?.annualSalary ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-2">{partnerTeamId || '???'} Sends</div>
                  <div className="space-y-1">
                    {partnerPlayers.filter(p => selectedPartnerPlayers.has(p.id)).map(p => (
                      <div key={p.id} className="flex justify-between px-3 py-1.5 text-sm bg-white/[0.02] rounded-lg">
                        <span>
                          <Link to={`/league/${leagueId}/players/${p.id}`} className="text-blue-400 font-medium hover:text-[oklch(64.6%_0.222_41.116)] transition-colors">
                            {playerLabel(p)}
                          </Link>
                          <span className="text-gray-500"> ({p.bio.position})</span>
                        </span>
                        <span className="text-gray-400">{formatSalary(p.contract?.annualSalary ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

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
                  <Button variant="primary" size="sm" disabled={!validation.valid || executing} onClick={handleProposeTrade}>
                    {executing ? 'Processing...' : 'Propose Trade'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </PageTransition>
  )
}
