import { Link, useParams } from 'react-router-dom'
import GlassCard from '../common/GlassCard'
import Button from '../common/Button'
import { useLeague } from '../../hooks/useLeague'

type StepStatus = 'done' | 'active' | 'locked'

interface OffseasonStep {
  key: string
  title: string
  description: string
  status: StepStatus
  actionLabel: string
  actionPath?: string
  onAction?: () => void
}

const OFFSEASON_PHASES = new Set(['playoffs', 'champion', 'draft', 'draft_lottery', 'free_agency', 'coaching_carousel', 'offseason'])

function StatusIcon({ status, index }: { status: StepStatus; index: number }) {
  if (status === 'done') {
    return (
      <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    )
  }
  if (status === 'active') {
    return (
      <div className="w-8 h-8 rounded-full bg-accent/15 border border-accent flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(255,100,30,0.35)]">
        <span className="text-accent text-xs font-bold">{index}</span>
      </div>
    )
  }
  return (
    <div className="w-8 h-8 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center justify-center shrink-0">
      <span className="text-gray-600 text-xs font-bold">{index}</span>
    </div>
  )
}

/**
 * End-of-season quest log: walks the GM through playoffs, awards,
 * draft, and free agency in order, then rolls the league into the next
 * season. Rendered on the dashboard whenever the league leaves the
 * regular season.
 */
export default function OffseasonHub() {
  const { id: leagueId } = useParams()
  const { state, playoffResults, advanceToNextSeason, simming, simProgress } = useLeague()

  if (!state || !OFFSEASON_PHASES.has(state.currentPhase)) return null

  const phase = state.currentPhase
  const champCrowned = !!playoffResults?.championId
  const pastPlayoffs = champCrowned || phase === 'draft' || phase === 'draft_lottery' || phase === 'free_agency' || phase === 'coaching_carousel' || phase === 'offseason'
  const pastDraft = phase === 'free_agency' || phase === 'coaching_carousel' || phase === 'offseason'

  const steps: OffseasonStep[] = [
    {
      key: 'playoffs',
      title: 'Playoffs',
      description: champCrowned
        ? 'A champion has been crowned'
        : 'Simulate the playoff bracket and crown a champion',
      status: pastPlayoffs ? 'done' : 'active',
      actionLabel: champCrowned ? 'View Bracket' : 'Go to Playoffs',
      actionPath: 'playoffs',
    },
    {
      key: 'awards',
      title: 'Awards Ceremony',
      description: 'See who took home the hardware and how the media voted',
      status: pastPlayoffs ? 'done' : 'locked',
      actionLabel: 'View Ceremony',
      actionPath: 'awards',
    },
    {
      key: 'draft',
      title: 'Draft',
      description: pastDraft
        ? 'Draft complete — rookies have joined their teams'
        : 'Run the lottery and select the next generation',
      status: pastDraft ? 'done' : phase === 'draft' || phase === 'draft_lottery' || (pastPlayoffs && phase === 'playoffs') ? 'active' : 'locked',
      actionLabel: pastDraft ? 'Review Draft' : 'Go to Draft',
      actionPath: 'draft',
    },
    {
      key: 'free-agency',
      title: 'Free Agency',
      description: 'Sign free agents and shape next season\'s roster',
      status: phase === 'free_agency' ? 'active' : pastDraft ? 'done' : 'locked',
      actionLabel: 'Go to Free Agency',
      actionPath: 'free-agency',
    },
    {
      key: 'next-season',
      title: 'Start Next Season',
      description: 'Player development, coaching carousel, and a fresh schedule',
      status: phase === 'free_agency' || phase === 'offseason' || phase === 'coaching_carousel' ? 'active' : 'locked',
      actionLabel: simming ? simProgress ?? 'Processing...' : 'Begin New Season',
      onAction: () => { void advanceToNextSeason() },
    },
  ]

  const doneCount = steps.filter(s => s.status === 'done').length

  return (
    <GlassCard className="p-6 mb-6 bg-gradient-to-br from-accent/[0.04] to-transparent border border-accent/10">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[9px] uppercase tracking-[2px] text-accent mb-1">Season {state.currentSeason} Complete</div>
          <h2 className="font-display text-2xl tracking-wide text-white">Offseason</h2>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold text-white">{doneCount}<span className="text-gray-600">/{steps.length}</span></div>
          <div className="text-[10px] uppercase tracking-[2px] text-gray-600">Steps Done</div>
        </div>
      </div>

      <div className="space-y-1">
        {steps.map((step, i) => (
          <div key={step.key} className="relative">
            {i < steps.length - 1 && (
              <div className={`absolute left-[15px] top-9 bottom-[-4px] w-px ${
                step.status === 'done' ? 'bg-emerald-500/30' : 'bg-white/[0.06]'
              }`} />
            )}
            <div className={`flex items-center gap-4 px-2 py-2.5 rounded-xl transition-colors ${
              step.status === 'active' ? 'bg-white/[0.03]' : ''
            }`}>
              <StatusIcon status={step.status} index={i + 1} />
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${
                  step.status === 'locked' ? 'text-gray-600' : step.status === 'done' ? 'text-gray-400' : 'text-white'
                }`}>
                  {step.title}
                </div>
                <div className={`text-xs truncate ${step.status === 'locked' ? 'text-gray-700' : 'text-gray-500'}`}>
                  {step.description}
                </div>
              </div>
              {step.status !== 'locked' && (
                step.onAction ? (
                  <Button
                    variant={step.status === 'active' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={step.onAction}
                    disabled={simming}
                  >
                    {step.actionLabel}
                  </Button>
                ) : (
                  <Link to={`/league/${leagueId}/${step.actionPath}`}>
                    <Button variant={step.status === 'active' ? 'primary' : 'secondary'} size="sm">
                      {step.actionLabel}
                    </Button>
                  </Link>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}
