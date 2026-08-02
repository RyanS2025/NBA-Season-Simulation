// ── Reporter Types ───────────────────────────────────────────────

export type ReporterType =
  | 'national_writer'
  | 'beat_writer'
  | 'tv_analyst'
  | 'analytics_writer'

export interface ReporterPersonality {
  statsFocus: number
  efficiencyFocus: number
  narrativeWeight: number
  teamSuccessWeight: number
  teamBias: number
  bigMarketBias: number
  recencyBias: number
  nameRecognitionBias: number
  mediaPersonalityBonus: number
}

export interface Reporter {
  id: string
  firstName: string
  lastName: string
  type: ReporterType
  outlet: string
  beatTeamId: string | null
  personality: ReporterPersonality
  yearsExperience: number
  seed: number
}

// ── Narrative Tracking ───────────────────────────────────────────

export type NarrativeType =
  | 'comeback'
  | 'overdue'
  | 'breakout'
  | 'legacy'
  | 'voter_fatigue'
  | 'redemption'
  | 'rivalry'
  | 'hometown_hero'
  | 'underdog_team'

export interface ActiveNarrative {
  id: string
  playerId: string
  type: NarrativeType
  strength: number
  startWeek: number
  description: string
}

// ── Award Voting ─────────────────────────────────────────────────

export type AwardType =
  | 'mvp'
  | 'dpoy'
  | 'roy'
  | 'sixth_man'
  | 'mip'
  | 'clutch_poy'
  | 'coty'
  | 'eoty'
  | 'finals_mvp'

export interface BallotPick {
  candidateId: string
  rank: number
  points: number
  isHomerPick: boolean
  biasInflation: number
}

export interface AwardBallot {
  reporterId: string
  reporterName: string
  reporterOutlet: string
  reporterType: ReporterType
  beatTeamId: string | null
  picks: BallotPick[]
}

export interface ControversialVote {
  reporterId: string
  reporterName: string
  outlet: string
  candidateId: string
  candidateName: string
  rank: number
  objectiveRank: number
  reason: string
}

export interface AwardResult {
  awardType: AwardType
  winnerId: string
  voteTotals: Record<string, number>
  firstPlaceVotes: Record<string, number>
  maxPossiblePoints: number
  ballots: AwardBallot[]
  controversialVotes: ControversialVote[]
  marginOfVictory: number
  wasUnanimous: boolean
}

// ── Mid-Season Race Tracking ─────────────────────────────────────

export interface AwardRaceCandidate {
  playerId: string
  objectiveScore: number
  projectedPoints: number
  projectedFirstPlace: number
  trendDirection: 'rising' | 'steady' | 'falling'
  narrativeBoosts: string[]
}

export interface AwardRaceSnapshot {
  awardType: AwardType
  week: number
  candidates: AwardRaceCandidate[]
}

// ── Season-Level Awards State (persisted) ────────────────────────

export interface AwardsSeasonState {
  seasonYear: number
  reporters: Reporter[]
  activeNarratives: ActiveNarrative[]
  raceSnapshots: AwardRaceSnapshot[]
  finalResults: Record<string, AwardResult> | null
}
