import { useLeague } from '../../hooks/useLeague'
import { CBA_2026_27 } from '../../utils/cba-engine'
import BackgroundMusic from '../common/BackgroundMusic'

const PHASE_LABELS: Record<string, string> = {
  preseason: 'Preseason',
  regular_season: 'Regular Season',
  playoffs: 'Playoffs',
  champion: 'Champion Crowned',
  draft_lottery: 'Draft Lottery',
  draft: 'Draft',
  free_agency: 'Free Agency',
  coaching_carousel: 'Coaching Carousel',
  offseason: 'Offseason',
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
}

export default function LeagueTopBar({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { state, teams, players, simDay, simming, simProgress } = useLeague()

  const userTeam = teams.find(t => t.id === state?.userTeamId)
  const record = userTeam?.seasonRecord
  const payroll = players
    .filter(p => p.teamId === state?.userTeamId)
    .reduce((s, p) => s + (p.contract?.annualSalary ?? 0), 0)
  const capSpace = CBA_2026_27.salaryCap - payroll
  const inSeason = state?.currentPhase === 'regular_season' || state?.currentPhase === 'preseason'

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-52 z-30 h-16 flex items-center gap-4 px-4 md:px-6 bg-gradient-to-b from-[#0d1526]/95 to-[#0b1220]/90 backdrop-blur-md border-b border-white/[0.07]">
      <button
        onClick={onMenuToggle}
        className="lg:hidden text-slate-400 hover:text-white"
        aria-label="Toggle menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <div className="min-w-0">
        <div className="font-display text-lg md:text-xl tracking-wider text-gradient leading-none truncate">
          {state ? fmtDate(state.currentDate) : '—'}
          <span className="hidden sm:inline text-slate-500"> — {PHASE_LABELS[state?.currentPhase ?? ''] ?? state?.currentPhase}</span>
        </div>
      </div>

      <div className="flex-1" />

      <div className="hidden md:flex items-stretch gap-px rounded-lg overflow-hidden border border-white/[0.08]">
        <div className="px-4 py-1.5 bg-white/[0.03] text-center">
          <div className="text-[8px] uppercase tracking-[1.5px] text-slate-500 leading-none mb-1">Team Record (W-L)</div>
          <div className="font-display text-base tracking-wide text-white leading-none">
            {record ? `${record.wins}-${record.losses}` : '—'}
          </div>
        </div>
        <div className="px-4 py-1.5 bg-white/[0.03] text-center">
          <div className="text-[8px] uppercase tracking-[1.5px] text-slate-500 leading-none mb-1">Current Cap Space</div>
          <div className={`font-display text-base tracking-wide leading-none ${capSpace < 0 ? 'text-red-400' : 'text-gradient'}`}>
            {capSpace < 0 ? '-' : ''}${Math.abs(capSpace / 1e6).toFixed(1)}M
          </div>
        </div>
      </div>

      <BackgroundMusic />

      {inSeason && (
        <button
          onClick={simDay}
          disabled={simming}
          className="btn-hud font-display tracking-widest text-sm md:text-base px-4 md:px-6 py-2 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {simming ? (simProgress ?? 'SIMMING...') : 'ADVANCE DAY'}
        </button>
      )}
    </header>
  )
}
