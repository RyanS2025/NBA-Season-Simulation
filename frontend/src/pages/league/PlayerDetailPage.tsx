import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import PageTransition from '../../components/layout/PageTransition'
import PlayerAvatar from '../../components/common/PlayerAvatar'
import GlassCard from '../../components/common/GlassCard'
import SectionLabel from '../../components/common/SectionLabel'
import { useLeague } from '../../hooks/useLeague'
import type {
  SeasonStats,
  PlayerRatings,
  PlayerTendencies,
  CharacterTraits,
  ShotZone,
  PlayerContract,
} from '../../types/player'

/* ------------------------------------------------------------------ */
/*  Local types                                                        */
/* ------------------------------------------------------------------ */

interface Award {
  year: string
  name: string
  category: 'mvp' | 'allStar' | 'allNba' | 'allDefense' | 'allRookie' | 'champion' | 'other'
}

interface RatingCategory {
  label: string
  value: number
}

/** Enriched row for career stats table display with computed per-36 & totals */
/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const LEAGUE_AVG: Record<string, number> = {
  restricted_area: 0.63,
  paint_non_ra: 0.40,
  midrange_left_baseline: 0.42,
  midrange_left_wing: 0.41,
  midrange_center: 0.41,
  midrange_right_wing: 0.41,
  midrange_right_baseline: 0.42,
  three_left_corner: 0.39,
  three_left_wing: 0.36,
  three_center: 0.36,
  three_right_wing: 0.36,
  three_right_corner: 0.39,
  backcourt: 0.02,
  post_up: 0.44,
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

type PageSection = 'overview' | 'playoffs' | 'shooting' | 'ratings'

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

function ovrColor(ovr: number): string {
  if (ovr >= 95) return 'text-yellow-400'
  if (ovr >= 90) return 'text-[oklch(64.6%_0.222_41.116)]'
  if (ovr >= 80) return 'text-green-400'
  if (ovr >= 70) return 'text-blue-400'
  return 'text-gray-400'
}

function ratingBarColor(v: number): string {
  if (v >= 95) return 'oklch(85% 0.15 85)'       // gold
  if (v >= 90) return 'oklch(64.6% 0.222 41.116)' // accent orange
  if (v >= 80) return 'oklch(70% 0.18 145)'       // green
  if (v >= 70) return 'oklch(65% 0.15 250)'       // blue
  return 'oklch(55% 0.05 260)'                     // gray
}

function awardBadgeColor(cat: Award['category']): string {
  switch (cat) {
    case 'mvp':        return 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400'
    case 'champion':   return 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400'
    case 'allStar':    return 'border-[oklch(64.6%_0.222_41.116)]/40 bg-[oklch(64.6%_0.222_41.116)]/10 text-[oklch(64.6%_0.222_41.116)]'
    case 'allNba':     return 'border-gray-400/40 bg-gray-400/10 text-gray-300'
    case 'allDefense': return 'border-blue-400/40 bg-blue-400/10 text-blue-400'
    case 'allRookie':  return 'border-green-400/40 bg-green-400/10 text-green-400'
    default:           return 'border-white/10 bg-white/5 text-gray-400'
  }
}

/** Enrich a SeasonStats row with computed per-36 and totals */
function parseAwards(rawAwards: string[]): Award[] {
  return rawAwards.map(a => {
    const match = a.match(/^(\d{4}-\d{2})\s+(.+)$/)
    const year = match?.[1] ?? ''
    const name = match?.[2] ?? a
    let category: Award['category'] = 'other'
    if (name.includes('MVP')) category = 'mvp'
    else if (name.includes('All-Star')) category = 'allStar'
    else if ((name.includes('All-NBA') || name.includes('All-League'))) category = 'allNba'
    else if (name.includes('All-Defensive')) category = 'allDefense'
    else if (name.includes('All-Rookie')) category = 'allRookie'
    else if (name.includes('Champion')) category = 'champion'
    return { year, name, category }
  })
}

/** Shot chart zone heat color based on make rate vs league average */
function zoneHeatColor(makeRate: number, leagueAvg: number): string {
  const diff = (makeRate - leagueAvg) * 100
  if (diff > 5)  return 'oklch(60% 0.22 30)'   // hot red-orange
  if (diff > 2)  return 'oklch(64.6% 0.222 41.116)' // warm accent orange
  if (diff > -2) return 'oklch(75% 0.02 250)'  // neutral white-ish
  if (diff > -5) return 'oklch(70% 0.10 240)'  // light blue
  return 'oklch(55% 0.15 250)'                  // deep blue
}

/** Readable zone names */
const ZONE_LABELS: Record<string, string> = {
  restricted_area: 'Restricted Area',
  paint_non_ra: 'Paint (Non-RA)',
  midrange_left_baseline: 'Mid-Range Left Baseline',
  midrange_left_wing: 'Mid-Range Left Wing',
  midrange_center: 'Mid-Range Center',
  midrange_right_wing: 'Mid-Range Right Wing',
  midrange_right_baseline: 'Mid-Range Right Baseline',
  three_left_corner: '3PT Left Corner',
  three_left_wing: '3PT Left Wing',
  three_center: '3PT Center',
  three_right_wing: '3PT Right Wing',
  three_right_corner: '3PT Right Corner',
  backcourt: 'Backcourt',
  post_up: 'Post Up',
}

/* ------------------------------------------------------------------ */
/*  Subcomponents                                                      */
/* ------------------------------------------------------------------ */

function SectionNavButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 text-sm font-medium transition-all border-b-2 ${
        active
          ? 'text-[oklch(64.6%_0.222_41.116)] border-[oklch(64.6%_0.222_41.116)]'
          : 'text-gray-500 border-transparent hover:text-white hover:border-white/20'
      }`}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Career Stats Table                                                 */
/* ------------------------------------------------------------------ */

interface GroupedAward {
  name: string
  category: Award['category']
  years: Award['year'][]
}

function groupAwards(awards: Award[]): GroupedAward[] {
  const map = new Map<string, GroupedAward>()
  for (const a of awards) {
    const existing = map.get(a.name)
    if (existing) {
      existing.years.push(a.year)
    } else {
      map.set(a.name, { name: a.name, category: a.category, years: [a.year] })
    }
  }
  return Array.from(map.values())
}

function AwardBadge({ award }: { award: GroupedAward }) {
  const [showYears, setShowYears] = useState(false)
  const count = award.years.length

  return (
    <div
      className={`relative rounded-xl border px-4 py-3 cursor-pointer select-none transition-colors ${awardBadgeColor(award.category)}`}
      onMouseEnter={() => setShowYears(true)}
      onMouseLeave={() => setShowYears(false)}
      onClick={() => setShowYears(v => !v)}
    >
      {count > 1 && (
        <div className="text-[10px] uppercase tracking-[2px] opacity-70">{count}x</div>
      )}
      <div className="text-sm font-medium mt-0.5">{award.name}</div>

      {showYears && (
        <div className="absolute z-20 left-1/2 -translate-x-1/2 bottom-full mb-2 bg-slate-900 border border-white/[0.12] rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
          <div className="text-[10px] uppercase tracking-[2px] text-gray-500 mb-1">Seasons</div>
          {award.years.map(y => (
            <div key={y} className="text-xs text-gray-300">{y}</div>
          ))}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-slate-900 border-r border-b border-white/[0.12] rotate-45 -mt-1" />
        </div>
      )}
    </div>
  )
}

function AwardsSection({ awards }: { awards: Award[] }) {
  const grouped = groupAwards(awards)

  return (
    <div>
      <SectionLabel>Awards & Honors</SectionLabel>
      {grouped.length === 0 ? (
        <GlassCard className="p-6 text-center text-gray-600 text-sm">No awards yet</GlassCard>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {grouped.map(a => (
            <AwardBadge key={a.name} award={a} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Contract Section                                                   */
/* ------------------------------------------------------------------ */

function ContractSection({ contract }: { contract: PlayerContract }) {
  const totalValue = contract.annualSalary * contract.totalYears

  return (
    <div>
      <SectionLabel>Contract</SectionLabel>
      <GlassCard className="p-5">
        <div className="flex items-baseline gap-3 mb-4">
          <span className="font-display text-2xl text-white">{formatMoney(contract.annualSalary)}</span>
          <span className="text-gray-500 text-sm">/ year</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[2px] text-gray-600">Type</div>
            <div className="text-sm text-white mt-1">{contract.contractType}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[2px] text-gray-600">Total Value</div>
            <div className="text-sm text-white mt-1">{formatMoney(totalValue)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[2px] text-gray-600">Years Left</div>
            <div className="text-sm text-white mt-1">{contract.yearsRemaining} of {contract.totalYears}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[2px] text-gray-600">Options</div>
            <div className="text-sm text-white mt-1">
              {contract.playerOption && <span className="text-blue-400">Player Option</span>}
              {contract.teamOption && <span className="text-green-400">Team Option</span>}
              {!contract.playerOption && !contract.teamOption && <span className="text-gray-500">None</span>}
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Summary Ratings Section (Overview tab)                             */
/* ------------------------------------------------------------------ */

function SummaryRatingsSection({
  overall,
  ratings,
}: {
  overall: number
  ratings: RatingCategory[]
}) {
  return (
    <div>
      <SectionLabel>Player Ratings</SectionLabel>
      <GlassCard className="p-5">
        <div className="flex items-center gap-5 mb-5">
          <div
            className={`font-display text-5xl ${ovrColor(overall)}`}
          >
            {overall}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[2px] text-gray-600">Overall</div>
            <div className="text-sm text-gray-400 mt-0.5">
              {overall >= 95 ? 'Generational' : overall >= 90 ? 'Elite' : overall >= 80 ? 'All-Star' : 'Starter'}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {ratings.map(r => (
            <div key={r.label} className="flex items-center gap-3">
              <div className="w-28 text-[10px] uppercase tracking-[2px] text-gray-600">
                {r.label}
              </div>
              <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${r.value}%`,
                    background: ratingBarColor(r.value),
                  }}
                />
              </div>
              <div className="w-8 text-right text-sm font-medium text-white">{r.value}</div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Shot Chart SVG                                                     */
/* ------------------------------------------------------------------ */

function ShotChartZone({
  d,
  zone,
  leagueAvg,
  label,
  labelX,
  labelY,
}: {
  d: string
  zone: ShotZone | undefined
  leagueAvg: number
  label: string
  labelX: number
  labelY: number
}) {
  const [hovered, setHovered] = useState(false)
  const makeRate = zone?.makeRate ?? 0
  const tendency = zone?.tendency ?? 0
  const fillColor = zone ? zoneHeatColor(makeRate, leagueAvg) : 'oklch(30% 0 0)'

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="cursor-pointer"
    >
      <path
        d={d}
        fill={fillColor}
        fillOpacity={hovered ? 0.95 : 0.75}
        stroke="white"
        strokeOpacity={0.15}
        strokeWidth={1}
      />
      {zone && (
        <>
          <text
            x={labelX}
            y={labelY - 6}
            textAnchor="middle"
            fill="white"
            fontSize={11}
            fontWeight={700}
          >
            {(makeRate * 100).toFixed(0)}%
          </text>
          <text
            x={labelX}
            y={labelY + 8}
            textAnchor="middle"
            fill="rgba(255,255,255,0.6)"
            fontSize={9}
          >
            {(tendency * 100).toFixed(0)}% freq
          </text>
        </>
      )}
      {hovered && zone && (
        <text
          x={labelX}
          y={labelY + 22}
          textAnchor="middle"
          fill="rgba(255,255,255,0.45)"
          fontSize={8}
        >
          {label}
        </text>
      )}
    </g>
  )
}

function ShotChartSVG({ zones }: { zones: ShotZone[] }) {
  const zoneMap = Object.fromEntries(zones.map(z => [z.zoneId, z]))

  // Court dimensions: viewBox 0 0 400 380
  // Basket at (200, 52). Court extends down.
  // The court is drawn top-down with the basket at the top.

  return (
    <svg viewBox="0 0 400 380" className="w-full max-w-[500px] mx-auto">
      {/* Court background */}
      <rect x={0} y={0} width={400} height={380} rx={8} fill="oklch(15% 0.01 260)" />

      {/* Court outline */}
      <rect x={20} y={10} width={360} height={360} fill="none" stroke="white" strokeOpacity={0.1} strokeWidth={1.5} rx={2} />

      {/* Half-court line */}
      <line x1={20} y1={370} x2={380} y2={370} stroke="white" strokeOpacity={0.08} strokeWidth={1} />

      {/* Three-point arc (approximate) */}
      <path
        d="M 50 10 L 50 130 Q 50 310 200 310 Q 350 310 350 130 L 350 10"
        fill="none"
        stroke="white"
        strokeOpacity={0.12}
        strokeWidth={1}
      />

      {/* Paint / lane */}
      <rect x={130} y={10} width={140} height={170} fill="none" stroke="white" strokeOpacity={0.1} strokeWidth={1} />

      {/* Free throw circle */}
      <circle cx={200} cy={180} r={50} fill="none" stroke="white" strokeOpacity={0.08} strokeWidth={1} />

      {/* Restricted area arc */}
      <path
        d="M 170 10 L 170 52 A 30 30 0 0 0 230 52 L 230 10"
        fill="none"
        stroke="white"
        strokeOpacity={0.12}
        strokeWidth={1}
      />

      {/* Basket */}
      <circle cx={200} cy={42} r={6} fill="none" stroke="white" strokeOpacity={0.3} strokeWidth={1.5} />
      <rect x={185} y={32} width={30} height={4} fill="white" fillOpacity={0.15} />

      {/* ---- Shot zones ---- */}

      {/* Restricted Area: small area right at the basket */}
      <ShotChartZone
        d="M 170 10 L 170 52 A 30 30 0 0 0 230 52 L 230 10 Z"
        zone={zoneMap['restricted_area']}
        leagueAvg={LEAGUE_AVG['restricted_area']}
        label="Restricted Area"
        labelX={200}
        labelY={36}
      />

      {/* Paint (non-RA): rectangle around RA but inside the lane */}
      <ShotChartZone
        d="M 130 10 L 130 170 L 270 170 L 270 10 L 230 10 L 230 52 A 30 30 0 0 1 170 52 L 170 10 Z"
        zone={zoneMap['paint_non_ra']}
        leagueAvg={LEAGUE_AVG['paint_non_ra']}
        label="Paint (Non-RA)"
        labelX={200}
        labelY={120}
      />

      {/* Post Up: low post areas (left and right of paint bottom) */}
      <ShotChartZone
        d="M 90 120 L 130 120 L 130 180 L 90 180 Z M 270 120 L 310 120 L 310 180 L 270 180 Z"
        zone={zoneMap['post_up']}
        leagueAvg={LEAGUE_AVG['post_up']}
        label="Post Up"
        labelX={310}
        labelY={150}
      />

      {/* Midrange Left Baseline */}
      <ShotChartZone
        d="M 50 10 L 50 130 L 90 130 L 90 10 Z"
        zone={zoneMap['midrange_left_baseline']}
        leagueAvg={LEAGUE_AVG['midrange_left_baseline']}
        label="MR Left Baseline"
        labelX={70}
        labelY={70}
      />

      {/* Midrange Left Wing */}
      <ShotChartZone
        d="M 50 130 Q 50 200 90 230 L 130 180 L 130 130 L 90 130 Z"
        zone={zoneMap['midrange_left_wing']}
        leagueAvg={LEAGUE_AVG['midrange_left_wing']}
        label="MR Left Wing"
        labelX={85}
        labelY={175}
      />

      {/* Midrange Center */}
      <ShotChartZone
        d="M 90 230 Q 130 270 200 280 Q 270 270 310 230 L 270 180 L 130 180 Z"
        zone={zoneMap['midrange_center']}
        leagueAvg={LEAGUE_AVG['midrange_center']}
        label="MR Center"
        labelX={200}
        labelY={230}
      />

      {/* Midrange Right Wing */}
      <ShotChartZone
        d="M 310 130 L 270 130 L 270 180 L 310 230 Q 350 200 350 130 Z"
        zone={zoneMap['midrange_right_wing']}
        leagueAvg={LEAGUE_AVG['midrange_right_wing']}
        label="MR Right Wing"
        labelX={315}
        labelY={175}
      />

      {/* Midrange Right Baseline */}
      <ShotChartZone
        d="M 310 10 L 310 130 L 350 130 L 350 10 Z"
        zone={zoneMap['midrange_right_baseline']}
        leagueAvg={LEAGUE_AVG['midrange_right_baseline']}
        label="MR Right Baseline"
        labelX={330}
        labelY={70}
      />

      {/* Three Left Corner */}
      <ShotChartZone
        d="M 20 10 L 20 130 L 50 130 L 50 10 Z"
        zone={zoneMap['three_left_corner']}
        leagueAvg={LEAGUE_AVG['three_left_corner']}
        label="3PT Left Corner"
        labelX={35}
        labelY={70}
      />

      {/* Three Left Wing */}
      <ShotChartZone
        d="M 20 130 L 50 130 Q 50 200 90 230 L 60 280 Q 20 230 20 130 Z"
        zone={zoneMap['three_left_wing']}
        leagueAvg={LEAGUE_AVG['three_left_wing']}
        label="3PT Left Wing"
        labelX={48}
        labelY={230}
      />

      {/* Three Center */}
      <ShotChartZone
        d="M 60 280 L 90 230 Q 130 270 200 280 Q 270 270 310 230 L 340 280 Q 280 340 200 340 Q 120 340 60 280 Z"
        zone={zoneMap['three_center']}
        leagueAvg={LEAGUE_AVG['three_center']}
        label="3PT Center"
        labelX={200}
        labelY={310}
      />

      {/* Three Right Wing */}
      <ShotChartZone
        d="M 380 130 L 350 130 Q 350 200 310 230 L 340 280 Q 380 230 380 130 Z"
        zone={zoneMap['three_right_wing']}
        leagueAvg={LEAGUE_AVG['three_right_wing']}
        label="3PT Right Wing"
        labelX={352}
        labelY={230}
      />

      {/* Three Right Corner */}
      <ShotChartZone
        d="M 350 10 L 350 130 L 380 130 L 380 10 Z"
        zone={zoneMap['three_right_corner']}
        leagueAvg={LEAGUE_AVG['three_right_corner']}
        label="3PT Right Corner"
        labelX={365}
        labelY={70}
      />

      {/* Backcourt */}
      <ShotChartZone
        d="M 20 340 L 380 340 L 380 370 L 20 370 Z"
        zone={zoneMap['backcourt']}
        leagueAvg={LEAGUE_AVG['backcourt']}
        label="Backcourt"
        labelX={200}
        labelY={358}
      />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Shooting Splits Table                                              */
/* ------------------------------------------------------------------ */

function ShootingSplitsTable({ zones }: { zones: ShotZone[] }) {
  return (
    <div>
      <SectionLabel>Shooting Splits by Zone</SectionLabel>
      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-4 py-3 text-left text-[10px] uppercase tracking-[2px] font-medium text-gray-600">Zone</th>
                <th className="px-3 py-3 text-center text-[10px] uppercase tracking-[2px] font-medium text-gray-600">FGA%</th>
                <th className="px-3 py-3 text-center text-[10px] uppercase tracking-[2px] font-medium text-gray-600">FG%</th>
                <th className="px-3 py-3 text-center text-[10px] uppercase tracking-[2px] font-medium text-gray-600">vs Lg Avg</th>
                <th className="px-3 py-3 text-center text-[10px] uppercase tracking-[2px] font-medium text-gray-600">Rating</th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-[2px] font-medium text-gray-600">Tendency</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((zone, idx) => {
                const leagueAvg = LEAGUE_AVG[zone.zoneId] ?? 0
                const diff = (zone.makeRate - leagueAvg) * 100
                const diffStr = diff >= 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`
                const diffColor = diff > 2 ? 'text-green-400' : diff < -2 ? 'text-red-400' : 'text-gray-400'
                const rating = diff > 5 ? 'Elite' : diff > 2 ? 'Above Avg' : diff > -2 ? 'Average' : diff > -5 ? 'Below Avg' : 'Poor'
                const ratingColor = diff > 5
                  ? 'text-yellow-400'
                  : diff > 2
                    ? 'text-green-400'
                    : diff > -2
                      ? 'text-gray-400'
                      : diff > -5
                        ? 'text-blue-400'
                        : 'text-red-400'

                return (
                  <tr
                    key={zone.zoneId}
                    className={`border-b border-white/[0.03] ${idx % 2 === 0 ? 'bg-white/[0.02]' : ''}`}
                  >
                    <td className="px-4 py-2.5 text-sm text-white font-medium">
                      {ZONE_LABELS[zone.zoneId] ?? zone.zoneId}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-center text-gray-300">
                      {(zone.tendency * 100).toFixed(0)}%
                    </td>
                    <td className="px-3 py-2.5 text-sm text-center text-white font-medium">
                      {(zone.makeRate * 100).toFixed(1)}%
                    </td>
                    <td className={`px-3 py-2.5 text-sm text-center font-medium ${diffColor}`}>
                      {diffStr}
                    </td>
                    <td className={`px-3 py-2.5 text-xs text-center font-medium ${ratingColor}`}>
                      {rating}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${zone.tendency * 100 * 3}%`, // scale so 33% fills bar
                            background: 'oklch(64.6% 0.222 41.116)',
                            maxWidth: '100%',
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Full Ratings Section (Ratings & Tendencies tab)                    */
/* ------------------------------------------------------------------ */

function RatingRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 text-[10px] uppercase tracking-[2px] text-gray-600 truncate">
        {label}
      </div>
      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${(value / 99) * 100}%`,
            background: ratingBarColor(value),
          }}
        />
      </div>
      <div className="w-8 text-right text-sm font-medium text-white">{value}</div>
    </div>
  )
}

function FullRatingsSection({ ratings }: { ratings: PlayerRatings }) {
  const offensiveSkills: { label: string; key: keyof PlayerRatings }[] = [
    { label: 'Finishing', key: 'finishing' },
    { label: 'Close Range', key: 'closeRange' },
    { label: 'Mid-Range', key: 'midRange' },
    { label: 'Three-Point', key: 'threePoint' },
    { label: 'Free Throw', key: 'freeThrow' },
    { label: 'Post Game', key: 'postGame' },
    { label: 'Draw Foul', key: 'drawFoul' },
    { label: 'Off-Ball Movement', key: 'offBallMovement' },
    { label: 'Ball Handling', key: 'ballHandling' },
    { label: 'Passing Vision', key: 'passingVision' },
    { label: 'Passing Accuracy', key: 'passingAccuracy' },
  ]

  const defensiveSkills: { label: string; key: keyof PlayerRatings }[] = [
    { label: 'Perimeter Defense', key: 'perimeterDefense' },
    { label: 'Interior Defense', key: 'interiorDefense' },
    { label: 'Shot Blocking', key: 'shotBlocking' },
    { label: 'Stealing', key: 'stealing' },
    { label: 'Defensive IQ', key: 'defensiveIq' },
    { label: 'Defensive Consistency', key: 'defensiveConsistency' },
  ]

  const physical: { label: string; key: keyof PlayerRatings }[] = [
    { label: 'Speed', key: 'speed' },
    { label: 'Acceleration', key: 'acceleration' },
    { label: 'Lateral Quickness', key: 'lateralQuickness' },
    { label: 'Vertical', key: 'vertical' },
    { label: 'Strength', key: 'strength' },
    { label: 'Stamina', key: 'stamina' },
  ]

  const mental: { label: string; key: keyof PlayerRatings }[] = [
    { label: 'Basketball IQ', key: 'basketballIq' },
    { label: 'Offensive IQ', key: 'offensiveIq' },
    { label: 'Rebounding', key: 'rebounding' },
    { label: 'Off. Rebounding', key: 'offensiveRebounding' },
    { label: 'Hustle', key: 'hustle' },
    { label: 'Intangibles', key: 'intangibles' },
  ]

  const renderGroup = (title: string, items: { label: string; key: keyof PlayerRatings }[]) => (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <GlassCard className="p-5">
        <div className="space-y-2.5">
          {items.map(item => (
            <RatingRow key={item.key} label={item.label} value={ratings[item.key] ?? 0} />
          ))}
        </div>
      </GlassCard>
    </div>
  )

  return (
    <div>
      {/* Overall / Potential / Peak header */}
      <GlassCard className="p-5 mb-6">
        <div className="flex items-center justify-center gap-10">
          <div className="text-center">
            <div className={`font-display text-5xl ${ovrColor(ratings.overall)}`}>{ratings.overall}</div>
            <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mt-1">Overall</div>
          </div>
          <div className="text-center">
            <div className={`font-display text-4xl ${ovrColor(ratings.potential)}`}>{ratings.potential}</div>
            <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mt-1">Potential</div>
          </div>
          <div className="text-center">
            <div className="font-display text-4xl text-gray-300">{ratings.peakAge}</div>
            <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mt-1">Peak Age</div>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderGroup('Offensive Skills', offensiveSkills)}
        {renderGroup('Defensive Skills', defensiveSkills)}
        {renderGroup('Physical', physical)}
        {renderGroup('Mental', mental)}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Tendencies Section                                                 */
/* ------------------------------------------------------------------ */

function TendencyBar({ label, value }: { label: string; value: number }) {
  const barColor = value > 70
    ? 'oklch(64.6% 0.222 41.116)'
    : value < 30
      ? 'oklch(65% 0.15 250)'
      : 'oklch(55% 0.05 260)'

  return (
    <div className="flex items-center gap-3">
      <div className="w-44 text-[10px] uppercase tracking-[2px] text-gray-600 truncate">
        {label}
      </div>
      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${value}%`,
            background: barColor,
          }}
        />
      </div>
      <div className="w-8 text-right text-xs font-medium text-gray-400">{value}</div>
    </div>
  )
}

function TendenciesSection({ tendencies }: { tendencies: PlayerTendencies }) {
  const shotSelection: { label: string; key: keyof PlayerTendencies }[] = [
    { label: 'Pull-Up Frequency', key: 'pullUpFrequency' },
    { label: 'Catch & Shoot Freq', key: 'catchAndShootFrequency' },
    { label: 'Drive Frequency', key: 'driveFrequency' },
    { label: 'Post-Up Frequency', key: 'postUpFrequency' },
    { label: 'ISO Frequency', key: 'isoFrequency' },
    { label: 'PnR Ball Handler', key: 'pickAndRollBallHandler' },
    { label: 'PnR Screener', key: 'pickAndRollScreener' },
    { label: 'Spot-Up Frequency', key: 'spotUpFrequency' },
    { label: 'Transition Freq', key: 'transitionFrequency' },
    { label: 'Cut Frequency', key: 'cutFrequency' },
  ]

  const passing: { label: string; key: keyof PlayerTendencies }[] = [
    { label: 'Pass Out of Drive', key: 'passOutOfDriveRate' },
    { label: 'Skip Pass Rate', key: 'skipPassRate' },
    { label: 'Alley-Oop Rate', key: 'alleyOopPassRate' },
  ]

  const defensive: { label: string; key: keyof PlayerTendencies }[] = [
    { label: 'Gamble for Steals', key: 'gambleForSteals' },
    { label: 'Help Defense Rate', key: 'helpDefenseRate' },
    { label: 'Closeout Aggression', key: 'closeoutAggression' },
    { label: 'Box Out Rate', key: 'boxOutRate' },
  ]

  const playStyle: { label: string; key: keyof PlayerTendencies }[] = [
    { label: 'Usage Desire', key: 'usageDesire' },
    { label: 'Pace Preference', key: 'pacePreference' },
    { label: 'Foul Proneness', key: 'foulProneness' },
    { label: 'Shot Clock Tendency', key: 'shotClockTendency' },
    { label: 'Contested Shot Will', key: 'contestedShotWillingness' },
  ]

  const renderGroup = (title: string, items: { label: string; key: keyof PlayerTendencies }[]) => (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <GlassCard className="p-5">
        <div className="space-y-2.5">
          {items.map(item => (
            <TendencyBar key={item.key} label={item.label} value={tendencies[item.key]} />
          ))}
        </div>
      </GlassCard>
    </div>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {renderGroup('Shot Selection Tendencies', shotSelection)}
      <div className="space-y-6">
        {renderGroup('Passing Tendencies', passing)}
        {renderGroup('Defensive Tendencies', defensive)}
      </div>
      <div className="lg:col-span-2">
        {renderGroup('Play Style', playStyle)}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Character Traits Section                                           */
/* ------------------------------------------------------------------ */

function CharacterTraitsSection({ traits }: { traits: CharacterTraits }) {
  const traitList: { label: string; key: keyof CharacterTraits }[] = [
    { label: 'Leadership', key: 'leadership' },
    { label: 'Work Ethic', key: 'workEthic' },
    { label: 'Clutch', key: 'clutch' },
    { label: 'Ego', key: 'ego' },
    { label: 'Coachability', key: 'coachability' },
    { label: 'Temperament', key: 'temperament' },
    { label: 'Fan Favorite', key: 'fanFavorite' },
    { label: 'Media Personality', key: 'mediaPersonality' },
    { label: 'Loyalty', key: 'loyalty' },
    { label: 'Competitiveness', key: 'competitiveness' },
  ]

  return (
    <div>
      <SectionLabel>Character Traits</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {traitList.map(t => {
          const val = traits[t.key]
          const color = val >= 90
            ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
            : val >= 80
              ? 'border-green-500/30 bg-green-500/10 text-green-400'
              : val >= 70
                ? 'border-blue-400/30 bg-blue-400/10 text-blue-400'
                : val >= 50
                  ? 'border-gray-400/30 bg-gray-400/10 text-gray-400'
                  : 'border-red-400/30 bg-red-400/10 text-red-400'

          return (
            <div key={t.key} className={`rounded-xl border px-4 py-3 text-center ${color}`}>
              <div className="font-display text-2xl">{val}</div>
              <div className="text-[9px] uppercase tracking-[2px] mt-1 opacity-80">{t.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Shot Chart Legend                                                   */
/* ------------------------------------------------------------------ */

function ShotChartLegend() {
  const items = [
    { label: 'Well Above Avg (+5%)', color: 'oklch(60% 0.22 30)' },
    { label: 'Above Avg (+2-5%)', color: 'oklch(64.6% 0.222 41.116)' },
    { label: 'Average', color: 'oklch(75% 0.02 250)' },
    { label: 'Below Avg (-2-5%)', color: 'oklch(70% 0.10 240)' },
    { label: 'Well Below Avg (-5%)', color: 'oklch(55% 0.15 250)' },
  ]

  return (
    <div className="flex flex-wrap justify-center gap-4 mt-4">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ background: item.color, opacity: 0.8 }}
          />
          <span className="text-[10px] text-gray-500">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */


/* ── Reference-style (BBGM) components ─────────────────────────── */

function ratingTextColor(v: number): string {
  if (v >= 80) return 'text-emerald-400'
  if (v >= 65) return 'text-slate-200'
  if (v >= 50) return 'text-slate-400'
  return 'text-slate-500'
}

function RatingColumn({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div className="min-w-[150px]">
      <div className="text-sm font-semibold text-white border-b border-white/[0.15] pb-1 mb-1.5">{title}</div>
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-3 text-[13px] leading-6">
          <span className="text-slate-400">{label}:</span>
          <span className={`tabular-nums font-medium ${ratingTextColor(value)}`}>{value}</span>
        </div>
      ))}
    </div>
  )
}

interface StatLine {
  year: string
  team: string
  age: number | null
  gp: number; gs: number; mpg: number
  fgm: number; fga: number; fgPct: number
  tpm: number; tpa: number; tpPct: number
  twoM: number; twoA: number; twoPct: number
  efgPct: number
  ftm: number; fta: number; ftPct: number
  orb: number; drb: number; trb: number
  ast: number; tov: number; stl: number; blk: number; pf: number; pts: number
}

function toStatLine(s: SeasonStats, currentAge: number, currentSeasonYear: number): StatLine {
  const yearNum = parseInt(s.season, 10)
  const age = isNaN(yearNum) ? null : currentAge - (currentSeasonYear - yearNum)
  const twoM = Math.max(0, s.fgm - s.three_pm)
  const twoA = Math.max(0, s.fga - s.three_pa)
  // Imported real seasons store percentages as 46.7; sim seasons as 0.467
  const pct = (v: number) => (v > 1.5 ? v : v * 100)
  return {
    year: s.season.replace(' Playoffs', ''),
    team: s.team,
    age,
    gp: s.gp, gs: s.gs, mpg: s.mpg,
    fgm: s.fgm, fga: s.fga, fgPct: pct(s.fg_pct),
    tpm: s.three_pm, tpa: s.three_pa, tpPct: pct(s.three_pct),
    twoM, twoA, twoPct: twoA > 0 ? (twoM / twoA) * 100 : 0,
    efgPct: s.fga > 0 ? ((s.fgm + 0.5 * s.three_pm) / s.fga) * 100 : 0,
    ftm: s.ftm, fta: s.fta, ftPct: pct(s.ft_pct),
    orb: s.orpg, drb: s.drpg, trb: s.rpg,
    ast: s.apg, tov: s.topg, stl: s.spg, blk: s.bpg, pf: s.pfpg, pts: s.ppg,
  }
}

function careerLine(lines: StatLine[]): StatLine | null {
  const totalGp = lines.reduce((s, l) => s + l.gp, 0)
  if (totalGp === 0) return null
  const w = (get: (l: StatLine) => number) =>
    lines.reduce((s, l) => s + get(l) * l.gp, 0) / totalGp
  const sumFgm = w(l => l.fgm), sumFga = w(l => l.fga)
  const sumTpm = w(l => l.tpm), sumTpa = w(l => l.tpa)
  const sumFtm = w(l => l.ftm), sumFta = w(l => l.fta)
  const twoM = sumFgm - sumTpm, twoA = sumFga - sumTpa
  return {
    year: 'Career', team: '', age: null,
    gp: totalGp, gs: lines.reduce((s, l) => s + l.gs, 0), mpg: w(l => l.mpg),
    fgm: sumFgm, fga: sumFga, fgPct: sumFga > 0 ? (sumFgm / sumFga) * 100 : 0,
    tpm: sumTpm, tpa: sumTpa, tpPct: sumTpa > 0 ? (sumTpm / sumTpa) * 100 : 0,
    twoM, twoA, twoPct: twoA > 0 ? (twoM / twoA) * 100 : 0,
    efgPct: sumFga > 0 ? ((sumFgm + 0.5 * sumTpm) / sumFga) * 100 : 0,
    ftm: sumFtm, fta: sumFta, ftPct: sumFta > 0 ? (sumFtm / sumFta) * 100 : 0,
    orb: w(l => l.orb), drb: w(l => l.drb), trb: w(l => l.trb),
    ast: w(l => l.ast), tov: w(l => l.tov), stl: w(l => l.stl),
    blk: w(l => l.blk), pf: w(l => l.pf), pts: w(l => l.pts),
  }
}

const STAT_COLS: { key: keyof StatLine; label: string; fmt: (v: number) => string }[] = [
  { key: 'gp', label: 'G', fmt: v => String(Math.round(v)) },
  { key: 'gs', label: 'GS', fmt: v => String(Math.round(v)) },
  { key: 'mpg', label: 'MP', fmt: v => v.toFixed(1) },
  { key: 'fgm', label: 'FG', fmt: v => v.toFixed(1) },
  { key: 'fga', label: 'FGA', fmt: v => v.toFixed(1) },
  { key: 'fgPct', label: 'FG%', fmt: v => v.toFixed(1) },
  { key: 'tpm', label: '3P', fmt: v => v.toFixed(1) },
  { key: 'tpa', label: '3PA', fmt: v => v.toFixed(1) },
  { key: 'tpPct', label: '3P%', fmt: v => v.toFixed(1) },
  { key: 'twoM', label: '2P', fmt: v => v.toFixed(1) },
  { key: 'twoA', label: '2PA', fmt: v => v.toFixed(1) },
  { key: 'twoPct', label: '2P%', fmt: v => v.toFixed(1) },
  { key: 'efgPct', label: 'eFG%', fmt: v => v.toFixed(1) },
  { key: 'ftm', label: 'FT', fmt: v => v.toFixed(1) },
  { key: 'fta', label: 'FTA', fmt: v => v.toFixed(1) },
  { key: 'ftPct', label: 'FT%', fmt: v => v.toFixed(1) },
  { key: 'orb', label: 'ORB', fmt: v => v.toFixed(1) },
  { key: 'drb', label: 'DRB', fmt: v => v.toFixed(1) },
  { key: 'trb', label: 'TRB', fmt: v => v.toFixed(1) },
  { key: 'ast', label: 'AST', fmt: v => v.toFixed(1) },
  { key: 'tov', label: 'TOV', fmt: v => v.toFixed(1) },
  { key: 'stl', label: 'STL', fmt: v => v.toFixed(1) },
  { key: 'blk', label: 'BLK', fmt: v => v.toFixed(1) },
  { key: 'pf', label: 'PF', fmt: v => v.toFixed(1) },
  { key: 'pts', label: 'PTS', fmt: v => v.toFixed(1) },
]

function BBGMStatsTable({
  stats, currentAge, currentSeasonYear, title, playerAwards = [],
}: {
  stats: SeasonStats[]
  currentAge: number
  currentSeasonYear: number
  title: string
  playerAwards?: string[]
}) {
  const seasonMarkers = (year: string) => {
    const allStar = playerAwards.some(a => a.startsWith(year + ' ') && a.includes('All-Star'))
    const champ = playerAwards.some(a => a.startsWith(year + ' ') && a.includes('Champion'))
    return (
      <>
        {allStar && <span title="All-Star" className="ml-1 text-yellow-400">★</span>}
        {champ && <span title="Champion" className="ml-1">🏆</span>}
      </>
    )
  }
  const [mode, setMode] = useState<'regular' | 'playoffs'>('regular')

  const regular = stats.filter(s => !s.season.includes('Playoffs'))
  const playoffs = stats.filter(s => s.season.includes('Playoffs'))
  const active = mode === 'regular' ? regular : playoffs
  const lines = active.map(s => toStatLine(s, currentAge, currentSeasonYear))
  const career = careerLine(lines)

  return (
    <div>
      <div className="flex items-center gap-4 mb-2">
        <h2 className="font-display text-2xl tracking-wide text-white">{title}</h2>
      </div>
      <div className="panel overflow-hidden">
        <div className="flex border-b border-white/[0.08]">
          {(['regular', 'playoffs'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-5 py-2.5 text-[13px] font-medium transition-colors ${
                mode === m
                  ? 'text-white bg-white/[0.05] border-b-2 border-orange-500'
                  : 'text-orange-400/80 hover:text-orange-300'
              }`}
            >
              {m === 'regular' ? 'Regular Season' : 'Playoffs'}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto [scrollbar-width:thin]">
          {lines.length === 0 ? (
            <div className="px-5 py-8 text-center text-slate-600 text-sm">
              {mode === 'playoffs' ? 'No playoff appearances yet' : 'No stats recorded yet'}
            </div>
          ) : (
            <table className="w-full text-[12.5px] whitespace-nowrap">
              <thead>
                <tr className="border-b border-white/[0.1] text-slate-400">
                  <th className="text-left font-semibold py-2 pl-4 pr-3 sticky left-0 bg-[#101a2e]">Year</th>
                  <th className="text-left font-semibold py-2 px-2.5">Team</th>
                  <th className="text-right font-semibold py-2 px-2.5">Age</th>
                  {STAT_COLS.map(c => (
                    <th key={c.label} className="text-right font-semibold py-2 px-2.5">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={`${l.year}-${i}`} className="border-b border-white/[0.04] hover:bg-white/[0.03]">
                    <td className="py-1.5 pl-4 pr-3 font-medium text-orange-400 sticky left-0 bg-[#0d1526] whitespace-nowrap">{l.year}{seasonMarkers(l.year)}</td>
                    <td className="py-1.5 px-2.5 text-orange-400/90">{l.team}</td>
                    <td className="py-1.5 px-2.5 text-right text-slate-300 tabular-nums">{l.age ?? ''}</td>
                    {STAT_COLS.map(c => (
                      <td key={c.label} className="py-1.5 px-2.5 text-right text-slate-300 tabular-nums">
                        {c.fmt(l[c.key] as number)}
                      </td>
                    ))}
                  </tr>
                ))}
                {career && (
                  <tr className="border-t border-white/[0.12] font-semibold">
                    <td className="py-2 pl-4 pr-3 text-white sticky left-0 bg-[#101a2e]">Career</td>
                    <td className="py-2 px-2.5" />
                    <td className="py-2 px-2.5" />
                    {STAT_COLS.map(c => (
                      <td key={c.label} className="py-2 px-2.5 text-right text-white tabular-nums">
                        {c.fmt(career[c.key] as number)}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryMiniTable({ stats }: { stats: SeasonStats[] }) {
  const regular = stats.filter(s => !s.season.includes('Playoffs'))
  const latest = regular[regular.length - 1] ?? null
  const lines = regular.map(s => toStatLine(s, 0, 0))
  const career = careerLine(lines)
  if (!latest && !career) return null

  const ts = (l: { pts: number; fga: number; fta: number } | null) =>
    l && (l.fga + 0.44 * l.fta) > 0 ? ((l.pts / (2 * (l.fga + 0.44 * l.fta))) * 100).toFixed(1) : '—'

  const latestLine = latest ? toStatLine(latest, 0, 0) : null

  const row = (label: string, l: StatLine | null) => l && (
    <tr className="text-slate-200">
      <td className="py-1 pr-5 font-semibold text-white">{label}</td>
      <td className="py-1 px-2.5 text-right tabular-nums">{Math.round(l.gp)}</td>
      <td className="py-1 px-2.5 text-right tabular-nums">{l.mpg.toFixed(1)}</td>
      <td className="py-1 px-2.5 text-right tabular-nums">{l.pts.toFixed(1)}</td>
      <td className="py-1 px-2.5 text-right tabular-nums">{l.trb.toFixed(1)}</td>
      <td className="py-1 px-2.5 text-right tabular-nums border-r border-white/[0.1]">{l.ast.toFixed(1)}</td>
      <td className="py-1 px-2.5 text-right tabular-nums">{l.fgPct.toFixed(1)}</td>
      <td className="py-1 px-2.5 text-right tabular-nums">{l.tpPct.toFixed(1)}</td>
      <td className="py-1 px-2.5 text-right tabular-nums">{l.ftPct.toFixed(1)}</td>
      <td className="py-1 px-2.5 text-right tabular-nums">{ts(l)}</td>
    </tr>
  )

  return (
    <div className="overflow-x-auto">
      <table className="text-[13px]">
        <thead>
          <tr className="text-slate-500 font-semibold">
            <td className="py-1 pr-5">Summary</td>
            <td className="py-1 px-2.5 text-right">G</td>
            <td className="py-1 px-2.5 text-right">MP</td>
            <td className="py-1 px-2.5 text-right">PTS</td>
            <td className="py-1 px-2.5 text-right">TRB</td>
            <td className="py-1 px-2.5 text-right border-r border-white/[0.1]">AST</td>
            <td className="py-1 px-2.5 text-right">FG%</td>
            <td className="py-1 px-2.5 text-right">3P%</td>
            <td className="py-1 px-2.5 text-right">FT%</td>
            <td className="py-1 px-2.5 text-right">TS%</td>
          </tr>
        </thead>
        <tbody>
          {latestLine && row(latest!.season, latestLine)}
          {row('Career', career)}
        </tbody>
      </table>
    </div>
  )
}

export default function PlayerDetailPage() {
  const { id: leagueId, playerId } = useParams()
  const { players, teams, state, loading } = useLeague()
  const [activeSection, setActiveSection] = useState<PageSection>('overview')

  const player = useMemo(
    () => players.find(p => p.id === playerId) ?? null,
    [players, playerId],
  )

  const teamInfo = useMemo(
    () => {
      if (!player) return null
      const team = teams.find(t => t.id === player.teamId)
      return team?.info ?? null
    },
    [player, teams],
  )

  if (loading) {
    return (
      <PageTransition>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-gray-500 text-sm">Loading player data...</div>
        </div>
      </PageTransition>
    )
  }

  if (!player) {
    return (
      <PageTransition>
        <div className="space-y-8">
          <Link
            to={`/league/${leagueId}/players`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Player Database
          </Link>
          <GlassCard className="p-8 text-center">
            <div className="text-gray-500 text-sm">Player not found</div>
          </GlassCard>
        </div>
      </PageTransition>
    )
  }

  // Derived display values
  const teamFullName = teamInfo ? `${teamInfo.city} ${teamInfo.name}` : ''
  const heightIn = player.bio.height
  const heightDisplay = `${Math.floor(heightIn / 12)}'${heightIn % 12}"`

  // Compute summary rating categories from individual ratings
  const r = player.ratings
  const summaryRatings: RatingCategory[] = [
    { label: 'Scoring', value: Math.round((r.finishing + r.closeRange + r.midRange + r.threePoint + r.freeThrow) / 5) },
    { label: 'Playmaking', value: Math.round((r.ballHandling + r.passingVision + r.passingAccuracy + r.offBallMovement) / 4) },
    { label: 'Defense', value: Math.round((r.perimeterDefense + r.interiorDefense + r.shotBlocking + r.stealing + r.defensiveIq) / 5) },
    { label: 'Athleticism', value: Math.round((r.speed + r.acceleration + r.vertical + r.strength) / 4) },
    { label: 'Basketball IQ', value: Math.round((r.basketballIq + r.offensiveIq + r.hustle) / 3) },
  ]

  // Parse awards from string[] to Award[]
  const awards = parseAwards(player.awards)

  const sections: { key: PageSection; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'playoffs', label: 'Playoffs' },
    { key: 'shooting', label: 'Shooting' },
    { key: 'ratings', label: 'Ratings & Tendencies' },
  ]

  return (
    <PageTransition>
      <div className="space-y-8">
        {/* Back link */}
        <Link
          to={`/league/${leagueId}/players`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Player Database
        </Link>

        {/* ---- Player Header (reference style) ---- */}
        <GlassCard variant="medium" className="p-6">
          <div className="flex flex-col xl:flex-row gap-8">
            {/* Avatar + bio stack */}
            <div className="flex gap-5">
              <PlayerAvatar
                firstName={player.bio.firstName}
                lastName={player.bio.lastName}
                size="lg"
                className="!w-24 !h-24 sm:!w-28 sm:!h-28 !text-3xl"
              />
              <div className="text-[13px] leading-6 text-slate-300">
                <div className="font-semibold">
                  <span className="text-white">{player.bio.position}, </span>
                  <span className="text-orange-400">{teamFullName || 'Free Agent'}</span>
                  <span className="text-white">, #{player.bio.jerseyNumber}</span>
                </div>
                <h1 className="font-display text-3xl tracking-wide text-white leading-tight my-0.5">
                  {player.bio.firstName} {player.bio.lastName}
                </h1>
                <div>{heightDisplay}, {player.bio.weight} lbs</div>
                <div>Age: {player.bio.age} — <span className="text-orange-400">{player.bio.country}</span></div>
                <div>
                  Draft: <span className="text-orange-400">{player.bio.draftYear}</span>
                  {' '}- Round {player.bio.draftRound} (Pick {player.bio.draftPick})
                </div>
                {player.bio.college && <div>College: <span className="text-orange-400">{player.bio.college}</span></div>}
                <div>Experience: {player.bio.yearsInLeague} {player.bio.yearsInLeague === 1 ? 'year' : 'years'}</div>
                {player.contract && state && (
                  <div>
                    Contract: {formatMoney(player.contract.annualSalary)}/yr thru {state.currentSeason + player.contract.yearsRemaining}
                  </div>
                )}
                {player.status.currentInjury && (
                  <div className="mt-1 inline-block px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30">
                    {player.status.currentInjury.playingThrough ? 'Playing hurt' : `Out ~${player.status.currentInjury.gamesRemaining} gm`} ({player.status.currentInjury.bodyPart})
                  </div>
                )}
              </div>
            </div>

            {/* Overall + rating columns */}
            <div className="flex-1">
              <div className="flex flex-wrap gap-x-12 gap-y-4">
                <div>
                  <div className="text-xl font-bold text-white mb-3">
                    Overall: <span className={ovrColor(player.ratings.overall)}>{player.ratings.overall}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-10 gap-y-4">
                    <RatingColumn title="Physical" rows={[
                      ['Speed', player.ratings.speed],
                      ['Strength', player.ratings.strength],
                      ['Jumping', player.ratings.vertical],
                      ['Lateral', player.ratings.lateralQuickness],
                      ['Endurance', player.ratings.stamina],
                    ]} />
                    <RatingColumn title="Shooting" rows={[
                      ['Inside', player.ratings.closeRange],
                      ['Layups/Dunks', player.ratings.finishing],
                      ['Free Throws', player.ratings.freeThrow],
                      ['Mid Range', player.ratings.midRange],
                      ['Three Pointers', player.ratings.threePoint],
                    ]} />
                    <RatingColumn title="Skill" rows={[
                      ['Offensive IQ', player.ratings.offensiveIq],
                      ['Defensive IQ', player.ratings.defensiveIq],
                      ['Dribbling', player.ratings.ballHandling],
                      ['Passing', player.ratings.passingVision],
                      ['Rebounding', player.ratings.rebounding],
                    ]} />
                  </div>
                </div>
                <div className="text-xl font-bold text-white">
                  Potential: <span className={ovrColor(player.ratings.potential)}>{player.ratings.potential}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Summary mini-table + award chips */}
          <div className="mt-6 pt-5 border-t border-white/[0.08]">
            <SummaryMiniTable stats={player.careerStats} />
            {awards.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {[...new Set(awards.map(a => a.name.replace(/^\d+ /, '')))].slice(0, 8).map(name => (
                  <span key={name} className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/[0.07] border border-white/[0.12] text-slate-200">
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </GlassCard>


        {/* ---- Section Navigation ---- */}
        <div className="flex border-b border-white/[0.06]">
          {sections.map(s => (
            <SectionNavButton
              key={s.key}
              active={activeSection === s.key}
              onClick={() => setActiveSection(s.key)}
            >
              {s.label}
            </SectionNavButton>
          ))}
        </div>

        {/* ---- OVERVIEW ---- */}
        {activeSection === 'overview' && (
          <div className="space-y-8">
            <BBGMStatsTable stats={player.careerStats} currentAge={player.bio.age} currentSeasonYear={state?.currentSeason ?? new Date().getFullYear()} title="Per Game" playerAwards={player.awards} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-8">
                <AwardsSection awards={awards} />
                {player.contract ? (
                  <ContractSection contract={player.contract} />
                ) : (
                  <div>
                    <SectionLabel>Contract</SectionLabel>
                    <GlassCard className="p-6 text-center text-gray-600 text-sm">No contract</GlassCard>
                  </div>
                )}
              </div>
              <div>
                <SummaryRatingsSection overall={player.ratings.overall} ratings={summaryRatings} />
              </div>
            </div>
          </div>
        )}

        {/* ---- PLAYOFFS ---- */}
        {activeSection === 'playoffs' && (
          <div className="space-y-8">
            <BBGMStatsTable
              stats={player.careerStats.filter(cs => cs.season.includes('Playoffs'))}
              currentAge={player.bio.age}
              currentSeasonYear={state?.currentSeason ?? new Date().getFullYear()}
              title="Playoff Career"
              playerAwards={player.awards}
            />
          </div>
        )}

        {/* ---- SHOOTING ---- */}
        {activeSection === 'shooting' && (
          <div className="space-y-8">
            <div>
              <SectionLabel>Shot Chart</SectionLabel>
              <GlassCard className="p-6">
                <ShotChartSVG zones={player.shotChart.zones} />
                <ShotChartLegend />
              </GlassCard>
            </div>

            <ShootingSplitsTable zones={player.shotChart.zones} />
          </div>
        )}

        {/* ---- RATINGS & TENDENCIES ---- */}
        {activeSection === 'ratings' && (
          <div className="space-y-8">
            <FullRatingsSection ratings={player.ratings} />

            <TendenciesSection tendencies={player.tendencies} />

            <CharacterTraitsSection traits={player.character} />
          </div>
        )}
      </div>
    </PageTransition>
  )
}
