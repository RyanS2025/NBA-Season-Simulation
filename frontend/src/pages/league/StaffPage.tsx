import { useState } from 'react'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'
import ProgressBar from '../../components/common/ProgressBar'
import SectionLabel from '../../components/common/SectionLabel'
import { useLeague } from '../../hooks/useLeague'
import type {
  GeneralManager,
  HeadCoach,
  AssistantCoach,
  Scout,
  Trainer,
  TeamPersonality,
  StaffRoster,
} from '../../types'

const TABS = ['Front Office', 'Coaching', 'Scouts', 'Training'] as const
type Tab = (typeof TABS)[number]

function formatSalary(salary: number): string {
  if (salary >= 1_000_000) return `$${(salary / 1_000_000).toFixed(1)}M`
  if (salary >= 1_000) return `$${(salary / 1_000).toFixed(0)}K`
  return `$${salary}`
}

function ratingColor(value: number): string {
  if (value >= 80) return '#22c55e'
  if (value >= 65) return '#3b82f6'
  if (value >= 50) return '#eab308'
  if (value >= 35) return '#f97316'
  return '#ef4444'
}

function RatingBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-32 shrink-0">{label}</span>
      <ProgressBar value={value} color={ratingColor(value)} height="h-1.5" className="flex-1" />
      <span className="text-xs font-medium text-white w-6 text-right">{value}</span>
    </div>
  )
}

function PersonalityTag({ label, value }: { label: string; value: number }) {
  const bg =
    value >= 70 ? 'bg-accent/15 text-accent border-accent/25' :
    value >= 40 ? 'bg-blue-500/15 text-blue-400 border-blue-500/25' :
    'bg-gray-500/15 text-gray-400 border-gray-500/25'
  return (
    <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider rounded border ${bg}`}>
      {label}: {value}
    </span>
  )
}

function ContractBadge({ salary, years }: { salary: number; years: number }) {
  return (
    <div className="text-xs text-gray-500">
      {formatSalary(salary)}/yr · {years}yr{years !== 1 ? 's' : ''} left
    </div>
  )
}

// ── GM Card ─────────────────────────────────────────────────────

function GMCard({ gm }: { gm: GeneralManager }) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <SectionLabel>General Manager</SectionLabel>
          <div className="text-xl font-semibold text-white">{gm.name}</div>
          <div className="text-xs text-gray-500 mt-0.5">Age {gm.age} · {gm.yearsAsGM} years as GM</div>
        </div>
        <ContractBadge salary={gm.contract.annualSalary} years={gm.contract.yearsRemaining} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5 mb-4">
        <RatingBar label="Player Evaluation" value={gm.skills.playerEvaluation} />
        <RatingBar label="Trade Negotiation" value={gm.skills.tradeNegotiation} />
        <RatingBar label="Draft Scouting" value={gm.skills.draftScouting} />
        <RatingBar label="Free Agency" value={gm.skills.freeAgencyManagement} />
        <RatingBar label="Cap Management" value={gm.skills.capManagement} />
        <RatingBar label="Player Development" value={gm.skills.playerDevelopmentFocus} />
        <RatingBar label="Analytics Emphasis" value={gm.skills.analyticsEmphasis} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <PersonalityTag label="Risk" value={gm.personality.riskTolerance} />
        <PersonalityTag label="Patience" value={gm.personality.patience} />
        <PersonalityTag label="Loyalty" value={gm.personality.loyalty} />
        <PersonalityTag label="Media" value={gm.personality.mediaPresence} />
      </div>
    </GlassCard>
  )
}

// ── Head Coach Card ─────────────────────────────────────────────

function HeadCoachCard({ coach }: { coach: HeadCoach }) {
  const { wins, losses } = coach.careerRecord
  const winPct = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0.0'
  return (
    <GlassCard className="p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <SectionLabel>Head Coach</SectionLabel>
          <div className="text-xl font-semibold text-white">{coach.name}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Age {coach.age} · Career {wins}-{losses} ({winPct}%)
          </div>
        </div>
        <div className="text-right">
          <ContractBadge salary={coach.contract.annualSalary} years={coach.contract.yearsRemaining} />
          {coach.hotSeatLevel > 40 && (
            <div className="text-[10px] text-red-400 mt-1 uppercase tracking-wider">
              Hot Seat: {coach.hotSeatLevel}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5 mb-4">
        <RatingBar label="Offense" value={coach.offenseRating} />
        <RatingBar label="Defense" value={coach.defenseRating} />
        <RatingBar label="Player Development" value={coach.playerDevelopment} />
        <RatingBar label="Motivation" value={coach.motivation} />
        <RatingBar label="Adaptability" value={coach.adaptability} />
        <RatingBar label="Experience" value={coach.experience} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <PersonalityTag label="Temperament" value={coach.personality.temperament} />
        <PersonalityTag label="Ego" value={coach.personality.egoLevel} />
        <PersonalityTag label="Media" value={coach.personality.mediaHandling} />
        <PersonalityTag label="Clutch" value={coach.personality.clutchCoaching} />
      </div>
    </GlassCard>
  )
}

// ── Assistant Coach Row ─────────────────────────────────────────

const SPECIALTY_LABELS: Record<string, string> = {
  offense: 'Offense',
  defense: 'Defense',
  playerDevelopment: 'Player Dev',
  shooting: 'Shooting',
  bigMen: 'Big Men',
  guards: 'Guards',
}

function AssistantCoachRow({ ac }: { ac: AssistantCoach }) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-medium text-white">{ac.name}</div>
          <div className="text-xs text-gray-500">
            Age {ac.age} · {SPECIALTY_LABELS[ac.specialty] ?? ac.specialty} Specialist
          </div>
        </div>
        <ContractBadge salary={ac.contract.annualSalary} years={ac.contract.yearsRemaining} />
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        <RatingBar label="Specialty" value={ac.specialtyRating} />
        <RatingBar label="General" value={ac.generalRating} />
      </div>
    </GlassCard>
  )
}

// ── Scout Row ───────────────────────────────────────────────────

function ScoutRow({ scout }: { scout: Scout }) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-medium text-white">{scout.name}</div>
          <div className="text-xs text-gray-500">
            Age {scout.age}
            {scout.currentAssignment
              ? ` · Assigned: ${scout.currentAssignment.type}`
              : ' · Unassigned'}
          </div>
        </div>
        <ContractBadge salary={scout.contract.annualSalary} years={scout.contract.yearsRemaining} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1">
        <RatingBar label="Domestic" value={scout.skills.domesticScouting} />
        <RatingBar label="International" value={scout.skills.internationalScouting} />
        <RatingBar label="Character" value={scout.skills.characterEvaluation} />
        <RatingBar label="Physical" value={scout.skills.physicalEvaluation} />
        <RatingBar label="Basketball IQ" value={scout.skills.basketballIQEvaluation} />
        <RatingBar label="Work Ethic" value={scout.workEthic} />
      </div>
      <div className="mt-2">
        <RatingBar label="Accuracy" value={scout.accuracy} />
      </div>
    </GlassCard>
  )
}

// ── Trainer Row ─────────────────────────────────────────────────

function TrainerRow({ trainer }: { trainer: Trainer }) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-medium text-white">{trainer.name}</div>
          <div className="text-xs text-gray-500">Age {trainer.age}</div>
        </div>
        <ContractBadge salary={trainer.contract.annualSalary} years={trainer.contract.yearsRemaining} />
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        <RatingBar label="Injury Prevention" value={trainer.skills.injuryPrevention} />
        <RatingBar label="Rehabilitation" value={trainer.skills.rehabilitation} />
        <RatingBar label="Strength" value={trainer.skills.strengthConditioning} />
        <RatingBar label="Load Management" value={trainer.skills.loadManagement} />
      </div>
    </GlassCard>
  )
}

// ── Team Personality Panel ──────────────────────────────────────

const ARCHETYPE_LABELS: Record<string, string> = {
  winNow: 'Win Now',
  rebuilding: 'Rebuilding',
  developmental: 'Developmental',
  analyticsDriven: 'Analytics-Driven',
  oldSchool: 'Old School',
  bigMarketSpender: 'Big Market Spender',
  smallMarketSaver: 'Small Market Saver',
}

function TeamPersonalityPanel({ personality }: { personality: TeamPersonality }) {
  return (
    <GlassCard className="p-5">
      <SectionLabel>Team Identity</SectionLabel>
      <div className="flex items-center gap-2 mb-4">
        <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-accent/15 text-accent border border-accent/25">
          {ARCHETYPE_LABELS[personality.primaryArchetype] ?? personality.primaryArchetype}
        </span>
        {personality.secondaryArchetype && (
          <span className="px-3 py-1 rounded-lg text-xs font-medium bg-white/[0.06] text-gray-400 border border-white/[0.08]">
            {ARCHETYPE_LABELS[personality.secondaryArchetype] ?? personality.secondaryArchetype}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5">
        <RatingBar label="Aggressiveness" value={personality.aggressiveness} />
        <RatingBar label="Spending" value={personality.spendingWillingness} />
        <RatingBar label="Youth Preference" value={personality.youthPreference} />
        <RatingBar label="Analytics" value={personality.analyticsLeaning} />
        <RatingBar label="Development Focus" value={personality.developmentFocus} />
        <RatingBar label="Owner Patience" value={personality.ownerPatience} />
        <RatingBar label="Owner Spending" value={personality.ownerSpending} />
        <RatingBar label="Owner Prestige" value={personality.ownerPrestige} />
      </div>
    </GlassCard>
  )
}

// ── Tab Panels ──────────────────────────────────────────────────

function FrontOfficeTab({ staff, personality }: { staff: StaffRoster; personality: TeamPersonality | null }) {
  return (
    <div className="space-y-4">
      {staff.generalManager && <GMCard gm={staff.generalManager} />}
      {personality && <TeamPersonalityPanel personality={personality} />}
    </div>
  )
}

function CoachingTab({ staff }: { staff: StaffRoster }) {
  return (
    <div className="space-y-4">
      <HeadCoachCard coach={staff.headCoach} />
      {staff.assistantCoaches.length > 0 && (
        <div>
          <SectionLabel>Assistant Coaches</SectionLabel>
          <div className="space-y-3">
            {staff.assistantCoaches.map(ac => (
              <AssistantCoachRow key={ac.id} ac={ac} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ScoutsTab({ staff }: { staff: StaffRoster }) {
  return (
    <div>
      <SectionLabel>Scouting Department</SectionLabel>
      <div className="space-y-3">
        {staff.scouts.map(sc => (
          <ScoutRow key={sc.id} scout={sc} />
        ))}
      </div>
    </div>
  )
}

function TrainingTab({ staff }: { staff: StaffRoster }) {
  return (
    <div>
      <SectionLabel>Training Staff</SectionLabel>
      <div className="space-y-3">
        {staff.trainers.map(tr => (
          <TrainerRow key={tr.id} trainer={tr} />
        ))}
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────

export default function StaffPage() {
  const { teams, state, loading } = useLeague()
  const [activeTab, setActiveTab] = useState<Tab>('Front Office')

  if (loading || !state) {
    return (
      <PageTransition>
        <div className="text-gray-500 text-center py-20">Loading staff...</div>
      </PageTransition>
    )
  }

  const userTeam = teams.find(t => t.id === state.userTeamId)
  const staff = userTeam?.staff
  const personality = userTeam?.teamPersonality

  if (!staff) {
    return (
      <PageTransition>
        <div className="text-gray-500 text-center py-20">
          No staff data available. Try creating a new league.
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-4xl tracking-wide text-white">Staff</h1>
            <p className="text-sm text-gray-500 mt-1">
              {userTeam?.info.city} {userTeam?.info.name} — Front Office & Coaching
            </p>
          </div>
        </div>

        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.08] w-fit">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-accent/15 text-accent'
                  : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'Front Office' && <FrontOfficeTab staff={staff} personality={personality ?? null} />}
        {activeTab === 'Coaching' && <CoachingTab staff={staff} />}
        {activeTab === 'Scouts' && <ScoutsTab staff={staff} />}
        {activeTab === 'Training' && <TrainingTab staff={staff} />}
      </div>
    </PageTransition>
  )
}
