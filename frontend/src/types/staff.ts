export interface StaffContract {
  annualSalary: number
  yearsRemaining: number
  totalYears: number
  signingYear: number
}

// ── General Manager ──────────────────────────────────────────────

export interface GMSkills {
  playerEvaluation: number
  tradeNegotiation: number
  draftScouting: number
  freeAgencyManagement: number
  capManagement: number
  playerDevelopmentFocus: number
  analyticsEmphasis: number
}

export interface GMPersonality {
  riskTolerance: number
  patience: number
  loyalty: number
  mediaPresence: number
}

export interface GeneralManager {
  id: string
  name: string
  age: number
  skills: GMSkills
  personality: GMPersonality
  contract: StaffContract
  teamId: string
  isUserControlled: boolean
  yearsAsGM: number
}

// ── Scouts ───────────────────────────────────────────────────────

export type ScoutSpecialty =
  | 'domestic'
  | 'international'
  | 'character'
  | 'physical'
  | 'basketballIQ'

export interface ScoutSkills {
  domesticScouting: number
  internationalScouting: number
  characterEvaluation: number
  physicalEvaluation: number
  basketballIQEvaluation: number
}

export interface ScoutAssignment {
  type: 'prospect' | 'region' | 'draftClass'
  targetId: string
  weeksAssigned: number
}

export interface Scout {
  id: string
  name: string
  age: number
  skills: ScoutSkills
  workEthic: number
  accuracy: number
  contract: StaffContract
  teamId: string
  currentAssignment: ScoutAssignment | null
}

// ── Head Coach ───────────────────────────────────────────────────

export interface CoachPersonality {
  temperament: number
  egoLevel: number
  mediaHandling: number
  clutchCoaching: number
}

export interface HeadCoach {
  id: string
  name: string
  age: number
  offenseRating: number
  defenseRating: number
  playerDevelopment: number
  motivation: number
  adaptability: number
  experience: number
  personality: CoachPersonality
  contract: StaffContract
  teamId: string
  careerRecord: { wins: number; losses: number }
  hotSeatLevel: number
}

// ── Assistant Coach ──────────────────────────────────────────────

export type CoachSpecialty =
  | 'offense'
  | 'defense'
  | 'playerDevelopment'
  | 'shooting'
  | 'bigMen'
  | 'guards'

export interface AssistantCoach {
  id: string
  name: string
  age: number
  specialty: CoachSpecialty
  specialtyRating: number
  generalRating: number
  contract: StaffContract
  teamId: string
}

// ── Trainer ──────────────────────────────────────────────────────

export interface TrainerSkills {
  injuryPrevention: number
  rehabilitation: number
  strengthConditioning: number
  loadManagement: number
}

export interface Trainer {
  id: string
  name: string
  age: number
  skills: TrainerSkills
  contract: StaffContract
  teamId: string
}

// ── Staff Roster (composite on Team) ─────────────────────────────

export interface StaffRoster {
  generalManager: GeneralManager | null
  headCoach: HeadCoach
  assistantCoaches: AssistantCoach[]
  scouts: Scout[]
  trainers: Trainer[]
}

// ── Team Personality & Archetypes ────────────────────────────────

export type TeamArchetype =
  | 'winNow'
  | 'rebuilding'
  | 'developmental'
  | 'analyticsDriven'
  | 'oldSchool'
  | 'bigMarketSpender'
  | 'smallMarketSaver'

export interface TeamPersonality {
  primaryArchetype: TeamArchetype
  secondaryArchetype: TeamArchetype | null
  aggressiveness: number
  spendingWillingness: number
  youthPreference: number
  analyticsLeaning: number
  developmentFocus: number
  ownerPatience: number
  ownerSpending: number
  ownerPrestige: number
}

// ── Staff Marketplace ────────────────────────────────────────────

export type StaffType = 'gm' | 'headCoach' | 'assistantCoach' | 'scout' | 'trainer'

export type StaffMember = GeneralManager | HeadCoach | AssistantCoach | Scout | Trainer

export interface StaffMarketEntry {
  id: string
  staffType: StaffType
  data: StaffMember
  marketStatus: 'available' | 'interviewing' | 'hired'
  previousTeamId: string | null
  reasonAvailable: 'fired' | 'contract_expired' | 'resigned' | 'new_entry'
  askingSalary: number
}

// ── Stored staff record (for DB table) ───────────────────────────

export interface StoredStaffMember {
  id: string
  staffType: StaffType
  teamId: string
  data: StaffMember
}
