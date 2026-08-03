import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'
import SectionLabel from '../../components/common/SectionLabel'
import { useLeague } from '../../hooks/useLeague'
import { playerComposite } from '../../utils/quick-sim'
import type { CoachingStaff, OffensiveScheme, DefensiveScheme } from '../../types/team'
import type { Player } from '../../types'

const OFFENSIVE_SCHEMES: { id: OffensiveScheme; label: string; desc: string }[] = [
  { id: 'motion', label: 'Motion', desc: 'Constant ball movement — more assists, better team shooting' },
  { id: 'iso_heavy', label: 'ISO Heavy', desc: 'Stars carry the load — top scorers shoot more, fewer assists' },
  { id: 'pick_and_roll', label: 'Pick & Roll', desc: 'PG/C two-man game — boosts guard playmaking and big finishing' },
  { id: 'triangle', label: 'Triangle', desc: 'Structured reads — efficient halfcourt offense at a slower pace' },
  { id: 'pace_and_space', label: 'Pace & Space', desc: 'Run and gun — more threes and more possessions' },
  { id: 'princeton', label: 'Princeton', desc: 'Patient backdoor cuts — high assist, methodical tempo' },
  { id: 'drive_and_kick', label: 'Drive & Kick', desc: 'Rim pressure — guards attack, wings spot up, more free throws' },
]

const DEFENSIVE_SCHEMES: { id: DefensiveScheme; label: string; desc: string }[] = [
  { id: 'man_to_man', label: 'Man-to-Man', desc: 'Straight-up individual matchups, no built-in tradeoffs' },
  { id: 'switching', label: 'Switching', desc: 'Kill isolation and post mismatches with seamless switches' },
  { id: 'drop_coverage', label: 'Drop Coverage', desc: 'Protect the rim, concede some outside looks' },
  { id: 'blitz', label: 'Blitz', desc: 'Trap ball handlers — forces turnovers but gives up rotations' },
  { id: 'zone_2_3', label: 'Zone 2-3', desc: 'Clog the paint, invite threes over the top' },
  { id: 'zone_3_2', label: 'Zone 3-2', desc: 'Chase shooters off the arc, softer interior' },
  { id: 'pack_the_paint', label: 'Pack the Paint', desc: 'Wall off the rim entirely — opponents live outside' },
]

const DEFAULT_COACHING: CoachingStaff = {
  headCoach: {
    name: 'Interim Coach',
    offenseRating: 50, defenseRating: 50, playerDevelopment: 50,
    motivation: 50, adaptability: 50, experience: 50,
  },
  offensiveScheme: 'motion',
  defensiveScheme: 'man_to_man',
  pacePreference: 50,
  threePointEmphasis: 50,
  starterMinutes: [34, 32, 31, 30, 28],
}

/** Default minutes ladder mirrored from the sim's auto-rotation. */
function autoMinutes(players: Player[]): Record<string, number> {
  const targets = [34, 32, 31, 30, 28, 20, 16, 12, 8, 4, 2, 1, 1, 0, 0]
  const sorted = [...players].sort((a, b) => playerComposite(b) - playerComposite(a))
  const map: Record<string, number> = {}
  sorted.forEach((p, rank) => {
    map[p.id] = targets[Math.min(rank, targets.length - 1)]
  })
  return map
}

export default function CoachingPage() {
  const { db, state, teams, players, loading, refreshTeams } = useLeague()
  const [coaching, setCoaching] = useState<CoachingStaff | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadedTeamId = useRef<string | null>(null)

  const userTeam = teams.find(t => t.id === state?.userTeamId)
  const roster = useMemo(
    () => players
      .filter(p => p.teamId === state?.userTeamId)
      .sort((a, b) => playerComposite(b) - playerComposite(a)),
    [players, state?.userTeamId],
  )

  useEffect(() => {
    if (!userTeam || loadedTeamId.current === userTeam.id) return
    loadedTeamId.current = userTeam.id
    setCoaching(userTeam.coaching ?? { ...DEFAULT_COACHING })
  }, [userTeam])

  const persist = useCallback((next: CoachingStaff) => {
    setCoaching(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!db || !userTeam) return
      const updated = { ...userTeam, coaching: next }
      await db.teams.put(updated)
      await refreshTeams()
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    }, 500)
  }, [db, userTeam, refreshTeams])

  if (loading || !state || !coaching) {
    return (
      <PageTransition>
        <div className="text-gray-400 text-center py-20">Loading coaching...</div>
      </PageTransition>
    )
  }

  const manual = coaching.manualRotation ?? false
  const rotation = coaching.rotationMinutes ?? {}
  const displayMinutes = manual ? rotation : autoMinutes(roster)
  const totalMinutes = roster.reduce((s, p) => s + (displayMinutes[p.id] ?? 0), 0)

  const toggleManual = () => {
    if (manual) {
      persist({ ...coaching, manualRotation: false })
    } else {
      persist({ ...coaching, manualRotation: true, rotationMinutes: autoMinutes(roster) })
    }
  }

  const setPlayerMinutes = (playerId: string, minutes: number) => {
    persist({
      ...coaching,
      rotationMinutes: { ...(coaching.rotationMinutes ?? autoMinutes(roster)), [playerId]: minutes },
    })
  }

  const starterIds = new Set(
    [...roster]
      .sort((a, b) => (displayMinutes[b.id] ?? 0) - (displayMinutes[a.id] ?? 0))
      .slice(0, 5)
      .map(p => p.id),
  )

  return (
    <PageTransition>
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-4xl tracking-wide text-white">Coaching</h1>
          <span className={`text-xs text-emerald-400 transition-opacity duration-300 ${savedFlash ? 'opacity-100' : 'opacity-0'}`}>
            Saved
          </span>
        </div>

        {/* Rotation & Minutes */}
        <GlassCard className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <SectionLabel className="mb-0">Rotation &amp; Minutes</SectionLabel>
            <div className="flex items-center gap-3">
              <span className={`text-xs ${totalMinutes === 240 ? 'text-gray-500' : 'text-amber-400'}`}>
                {totalMinutes}/240 min
              </span>
              <button
                onClick={toggleManual}
                aria-label="Toggle manual rotation"
                className={`relative w-11 h-6 rounded-full transition-colors ${manual ? 'bg-white/[0.1]' : 'bg-accent'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${manual ? 'translate-x-0.5' : 'translate-x-[22px]'}`} />
              </button>
              <span className="text-xs text-gray-400 w-28 text-left">
                {manual ? 'Manual rotation' : 'Let coach decide'}
              </span>
            </div>
          </div>

          {totalMinutes !== 240 && manual && (
            <p className="text-[11px] text-amber-400/80 mb-3">
              Minutes will be scaled to 240 at game time.
            </p>
          )}

          <div className="space-y-1.5">
            {roster.map(p => {
              const mins = displayMinutes[p.id] ?? 0
              const isStarter = starterIds.has(p.id)
              return (
                <div key={p.id} className={`flex items-center gap-4 px-3 py-2 rounded-lg ${isStarter ? 'bg-accent/5 border border-accent/10' : 'bg-white/[0.02]'}`}>
                  <span className="text-gray-500 text-[10px] w-6">{p.bio.position}</span>
                  <span className={`text-sm w-44 truncate ${isStarter ? 'text-white font-medium' : 'text-gray-300'}`}>
                    {p.bio.firstName} {p.bio.lastName}
                    {isStarter && <span className="ml-2 text-[9px] uppercase tracking-wider text-accent">Starter</span>}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    value={mins}
                    disabled={!manual}
                    onChange={e => setPlayerMinutes(p.id, Number(e.target.value))}
                    aria-label={`Minutes for ${p.bio.firstName} ${p.bio.lastName}`}
                    className="flex-1 accent-[oklch(64.6%_0.222_41.116)] disabled:opacity-40"
                  />
                  <span className="text-sm text-gray-300 w-10 text-right tabular-nums">{mins}</span>
                </div>
              )
            })}
          </div>
        </GlassCard>

        {/* Schemes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <GlassCard className="p-6">
            <SectionLabel>Offensive Scheme</SectionLabel>
            <div className="space-y-2">
              {OFFENSIVE_SCHEMES.map(s => (
                <button
                  key={s.id}
                  onClick={() => persist({ ...coaching, offensiveScheme: s.id })}
                  className={`w-full text-left px-4 py-2.5 rounded-lg border transition-colors ${
                    coaching.offensiveScheme === s.id
                      ? 'border-accent/40 bg-accent/10'
                      : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]'
                  }`}
                >
                  <div className={`text-sm font-medium ${coaching.offensiveScheme === s.id ? 'text-accent' : 'text-white'}`}>
                    {s.label}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{s.desc}</div>
                </button>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <SectionLabel>Defensive Scheme</SectionLabel>
            <div className="space-y-2">
              {DEFENSIVE_SCHEMES.map(s => (
                <button
                  key={s.id}
                  onClick={() => persist({ ...coaching, defensiveScheme: s.id })}
                  className={`w-full text-left px-4 py-2.5 rounded-lg border transition-colors ${
                    coaching.defensiveScheme === s.id
                      ? 'border-accent/40 bg-accent/10'
                      : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]'
                  }`}
                >
                  <div className={`text-sm font-medium ${coaching.defensiveScheme === s.id ? 'text-accent' : 'text-white'}`}>
                    {s.label}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{s.desc}</div>
                </button>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Play Style */}
        <GlassCard className="p-6 mb-8">
          <SectionLabel>Play Style</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white">Pace</span>
                <span className="text-xs text-gray-500">
                  {coaching.pacePreference < 35 ? 'Slow' : coaching.pacePreference > 65 ? 'Fast' : 'Balanced'} ({coaching.pacePreference})
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={coaching.pacePreference}
                onChange={e => persist({ ...coaching, pacePreference: Number(e.target.value) })}
                aria-label="Pace preference"
                className="w-full accent-[oklch(64.6%_0.222_41.116)]"
              />
              <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                <span>Slow it down</span>
                <span>Run &amp; gun</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white">3PT Emphasis</span>
                <span className="text-xs text-gray-500">
                  {coaching.threePointEmphasis < 35 ? 'Traditional' : coaching.threePointEmphasis > 65 ? '3PT Heavy' : 'Balanced'} ({coaching.threePointEmphasis})
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={coaching.threePointEmphasis}
                onChange={e => persist({ ...coaching, threePointEmphasis: Number(e.target.value) })}
                aria-label="Three point emphasis"
                className="w-full accent-[oklch(64.6%_0.222_41.116)]"
              />
              <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                <span>Inside game</span>
                <span>Let it fly</span>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </PageTransition>
  )
}
