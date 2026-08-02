import { v4 as uuid } from 'uuid'
import type {
  GeneralManager,
  GMSkills,
  GMPersonality,
  HeadCoach,
  CoachPersonality,
  AssistantCoach,
  CoachSpecialty,
  Scout,
  ScoutSkills,
  Trainer,
  TrainerSkills,
  StaffContract,
  StaffRoster,
  TeamPersonality,
  TeamArchetype,
  CoachingStaff,
  OffensiveScheme,
  DefensiveScheme,
  TeamInfo,
} from '../types'

// ── Seeded PRNG (mulberry32) ────────────────────────────────────

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type RNG = () => number

function randInt(rng: RNG, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

function randFloat(rng: RNG, min: number, max: number): number {
  return rng() * (max - min) + min
}

function pick<T>(rng: RNG, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

function gaussianish(rng: RNG, mean: number, spread: number): number {
  const u1 = rng() || 0.001
  const u2 = rng()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return Math.round(Math.max(1, Math.min(99, mean + z * spread)))
}

// ── Name Pools ──────────────────────────────────────────────────

const FIRST_NAMES = [
  'James', 'Michael', 'Robert', 'David', 'William', 'Richard', 'Thomas', 'Mark',
  'Charles', 'Steven', 'Daniel', 'Paul', 'Kevin', 'Brian', 'Greg', 'Jeff',
  'Anthony', 'Jason', 'Patrick', 'Scott', 'Tim', 'Ryan', 'Eric', 'Chris',
  'Larry', 'Dennis', 'Terry', 'Frank', 'Joe', 'Sam', 'Marcus', 'Andre',
  'Dwane', 'Kenny', 'Monty', 'Nate', 'Will', 'Darvin', 'Erik', 'Wes',
  'Chauncey', 'Ime', 'Jordi', 'Quin', 'Taylor', 'Brandon', 'Adrian', 'Darko',
  'Mike', 'Sean', 'Alvin', 'Maurice', 'Tyrone', 'Dwayne', 'Derek', 'Rasheed',
  'Vince', 'Allen', 'Tony', 'Doug', 'Rick', 'Gregg', 'Don', 'Jack',
  'Phil', 'Pat', 'Lenny', 'Flip', 'Stan', 'Hubie', 'John', 'Ray',
  'Leon', 'Clifford', 'Herb', 'Walt', 'Bob', 'Bill', 'Dan', 'Steve',
  'Nick', 'Alex', 'Tom', 'Ben', 'Leo', 'Max', 'Carl', 'Keith',
  'Reggie', 'Jerome', 'Kelvin', 'Floyd', 'Lawrence', 'Eddie', 'Avery', 'Byron',
] as const

const LAST_NAMES = [
  'Williams', 'Johnson', 'Brown', 'Davis', 'Miller', 'Wilson', 'Anderson', 'Thomas',
  'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Robinson', 'Clark', 'Lewis',
  'Walker', 'Hall', 'Young', 'Allen', 'King', 'Wright', 'Hill', 'Scott',
  'Green', 'Adams', 'Baker', 'Nelson', 'Mitchell', 'Roberts', 'Carter', 'Phillips',
  'Evans', 'Turner', 'Torres', 'Parker', 'Collins', 'Edwards', 'Stewart', 'Morris',
  'Morales', 'Murphy', 'Cook', 'Rogers', 'Morgan', 'Peterson', 'Cooper', 'Reed',
  'Bailey', 'Bell', 'Gomez', 'Kelly', 'Howard', 'Ward', 'Cox', 'Diaz',
  'Richardson', 'Wood', 'Watson', 'Brooks', 'Bennett', 'Gray', 'James', 'Reyes',
  'Cruz', 'Hughes', 'Price', 'Myers', 'Long', 'Foster', 'Sanders', 'Ross',
  'Powell', 'Sullivan', 'Russell', 'Ortiz', 'Jenkins', 'Gutierrez', 'Perry', 'Butler',
  'Barnes', 'Fisher', 'Henderson', 'Coleman', 'Simmons', 'Patterson', 'Jordan', 'Reynolds',
  'Hamilton', 'Graham', 'Kim', 'Gonzalez', 'Alexander', 'Ramos', 'Wallace', 'Griffin',
] as const

function genName(rng: RNG): string {
  return `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`
}

// ── Contract Generation ─────────────────────────────────────────

function genContract(rng: RNG, role: 'gm' | 'headCoach' | 'assistant' | 'scout' | 'trainer', quality: number): StaffContract {
  const salaryRanges: Record<string, [number, number]> = {
    gm: [2_000_000, 8_000_000],
    headCoach: [3_000_000, 12_000_000],
    assistant: [500_000, 2_500_000],
    scout: [100_000, 400_000],
    trainer: [200_000, 800_000],
  }
  const [min, max] = salaryRanges[role]
  const qualityFactor = 0.5 + (quality / 100) * 0.5
  const salary = Math.round((min + (max - min) * qualityFactor) / 10_000) * 10_000
  const totalYears = randInt(rng, 2, 5)
  const yearsRemaining = randInt(rng, 1, totalYears)
  return {
    annualSalary: salary,
    yearsRemaining,
    totalYears,
    signingYear: 2027 - (totalYears - yearsRemaining),
  }
}

// ── GM Generation ───────────────────────────────────────────────

function generateGM(rng: RNG, teamId: string, marketSize: number, isUser: boolean): GeneralManager {
  const marketBonus = Math.round((marketSize / 10) * 5)
  const skills: GMSkills = {
    playerEvaluation: gaussianish(rng, 55 + marketBonus, 12),
    tradeNegotiation: gaussianish(rng, 55 + marketBonus, 12),
    draftScouting: gaussianish(rng, 55 + marketBonus, 12),
    freeAgencyManagement: gaussianish(rng, 55 + marketBonus, 12),
    capManagement: gaussianish(rng, 55 + marketBonus, 12),
    playerDevelopmentFocus: gaussianish(rng, 55, 15),
    analyticsEmphasis: gaussianish(rng, 55, 18),
  }
  const personality: GMPersonality = {
    riskTolerance: gaussianish(rng, 50, 18),
    patience: gaussianish(rng, 50, 18),
    loyalty: gaussianish(rng, 50, 15),
    mediaPresence: gaussianish(rng, 50, 18),
  }
  const avgSkill = Object.values(skills).reduce((a, b) => a + b, 0) / 7
  return {
    id: uuid(),
    name: genName(rng),
    age: randInt(rng, 38, 62),
    skills,
    personality,
    contract: genContract(rng, 'gm', avgSkill),
    teamId,
    isUserControlled: isUser,
    yearsAsGM: randInt(rng, 1, 15),
  }
}

// ── Head Coach Generation ───────────────────────────────────────

function generateHeadCoach(rng: RNG, teamId: string, marketSize: number): HeadCoach {
  const marketBonus = Math.round((marketSize / 10) * 4)
  const offenseRating = gaussianish(rng, 55 + marketBonus, 12)
  const defenseRating = gaussianish(rng, 55 + marketBonus, 12)
  const playerDevelopment = gaussianish(rng, 55 + marketBonus, 12)
  const motivation = gaussianish(rng, 55, 14)
  const adaptability = gaussianish(rng, 55, 14)
  const experience = gaussianish(rng, 55, 16)

  const personality: CoachPersonality = {
    temperament: gaussianish(rng, 50, 20),
    egoLevel: gaussianish(rng, 45, 18),
    mediaHandling: gaussianish(rng, 50, 15),
    clutchCoaching: gaussianish(rng, 50, 16),
  }

  const yearsCoaching = randInt(rng, 2, 25)
  const winsPerSeason = Math.round(30 + ((offenseRating + defenseRating) / 200) * 24 + randFloat(rng, -5, 5))
  const totalWins = winsPerSeason * yearsCoaching
  const totalLosses = 82 * yearsCoaching - totalWins

  const avgRating = (offenseRating + defenseRating + playerDevelopment + motivation + adaptability + experience) / 6
  return {
    id: uuid(),
    name: genName(rng),
    age: randInt(rng, 35, 68),
    offenseRating,
    defenseRating,
    playerDevelopment,
    motivation,
    adaptability,
    experience,
    personality,
    contract: genContract(rng, 'headCoach', avgRating),
    teamId,
    careerRecord: { wins: Math.max(0, totalWins), losses: Math.max(0, totalLosses) },
    hotSeatLevel: randInt(rng, 0, 30),
  }
}

// ── Assistant Coach Generation ──────────────────────────────────

const SPECIALTIES: readonly CoachSpecialty[] = [
  'offense', 'defense', 'playerDevelopment', 'shooting', 'bigMen', 'guards',
] as const

function generateAssistant(rng: RNG, teamId: string, preferredSpecialty?: CoachSpecialty): AssistantCoach {
  const specialty = preferredSpecialty ?? pick(rng, SPECIALTIES)
  return {
    id: uuid(),
    name: genName(rng),
    age: randInt(rng, 30, 58),
    specialty,
    specialtyRating: gaussianish(rng, 60, 14),
    generalRating: gaussianish(rng, 50, 12),
    contract: genContract(rng, 'assistant', 55),
    teamId,
  }
}

// ── Scout Generation ────────────────────────────────────────────

function generateScout(rng: RNG, teamId: string): Scout {
  const skills: ScoutSkills = {
    domesticScouting: gaussianish(rng, 55, 15),
    internationalScouting: gaussianish(rng, 45, 18),
    characterEvaluation: gaussianish(rng, 55, 14),
    physicalEvaluation: gaussianish(rng, 55, 14),
    basketballIQEvaluation: gaussianish(rng, 55, 14),
  }
  return {
    id: uuid(),
    name: genName(rng),
    age: randInt(rng, 28, 65),
    skills,
    workEthic: gaussianish(rng, 60, 15),
    accuracy: gaussianish(rng, 55, 14),
    contract: genContract(rng, 'scout', 55),
    teamId,
    currentAssignment: null,
  }
}

// ── Trainer Generation ──────────────────────────────────────────

function generateTrainer(rng: RNG, teamId: string): Trainer {
  const skills: TrainerSkills = {
    injuryPrevention: gaussianish(rng, 55, 14),
    rehabilitation: gaussianish(rng, 55, 14),
    strengthConditioning: gaussianish(rng, 55, 14),
    loadManagement: gaussianish(rng, 55, 14),
  }
  return {
    id: uuid(),
    name: genName(rng),
    age: randInt(rng, 30, 55),
    skills,
    contract: genContract(rng, 'trainer', 55),
    teamId,
  }
}

// ── Team Personality Derivation ─────────────────────────────────

function deriveTeamPersonality(gm: GeneralManager, marketSize: number): TeamPersonality {
  const { skills, personality } = gm

  const aggressiveness = Math.round(
    personality.riskTolerance * 0.5 + (100 - personality.patience) * 0.3 + skills.tradeNegotiation * 0.2
  )
  const spendingWillingness = Math.round(
    (marketSize / 10) * 40 + personality.riskTolerance * 0.3 + (100 - skills.capManagement) * 0.1
  )
  const youthPreference = Math.round(
    personality.patience * 0.4 + skills.draftScouting * 0.3 + skills.playerDevelopmentFocus * 0.3
  )
  const analyticsLeaning = Math.round(
    skills.analyticsEmphasis * 0.7 + skills.playerEvaluation * 0.3
  )
  const developmentFocus = Math.round(
    skills.playerDevelopmentFocus * 0.5 + personality.patience * 0.3 + (100 - personality.riskTolerance) * 0.2
  )

  const ownerPatience = Math.round(
    marketSize <= 4 ? 65 + (10 - marketSize) * 3 : 40 + (10 - marketSize) * 2
  )
  const ownerSpending = Math.round(
    marketSize * 8 + Math.max(0, marketSize - 5) * 4
  )
  const ownerPrestige = Math.round(
    marketSize * 7 + 15
  )

  const composites = { aggressiveness, spendingWillingness, youthPreference, analyticsLeaning, developmentFocus }
  const primary = pickArchetype(composites, marketSize)
  const secondary = pickSecondaryArchetype(composites, marketSize, primary)

  return {
    primaryArchetype: primary,
    secondaryArchetype: secondary,
    aggressiveness: clamp(aggressiveness),
    spendingWillingness: clamp(spendingWillingness),
    youthPreference: clamp(youthPreference),
    analyticsLeaning: clamp(analyticsLeaning),
    developmentFocus: clamp(developmentFocus),
    ownerPatience: clamp(ownerPatience),
    ownerSpending: clamp(ownerSpending),
    ownerPrestige: clamp(ownerPrestige),
  }
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v))
}

interface CompositeScores {
  aggressiveness: number
  spendingWillingness: number
  youthPreference: number
  analyticsLeaning: number
  developmentFocus: number
}

function pickArchetype(c: CompositeScores, marketSize: number): TeamArchetype {
  const scores: [TeamArchetype, number][] = [
    ['winNow', c.aggressiveness * 1.2 + c.spendingWillingness * 0.5],
    ['rebuilding', c.youthPreference * 0.8 + (100 - c.aggressiveness) * 0.6],
    ['developmental', c.developmentFocus * 1.0 + c.youthPreference * 0.5],
    ['analyticsDriven', c.analyticsLeaning * 1.3],
    ['oldSchool', (100 - c.analyticsLeaning) * 1.1],
  ]
  if (marketSize >= 7) scores.push(['bigMarketSpender', c.spendingWillingness * 1.1 + marketSize * 5])
  if (marketSize <= 5) scores.push(['smallMarketSaver', (100 - c.spendingWillingness) * 0.9 + (10 - marketSize) * 5])

  scores.sort((a, b) => b[1] - a[1])
  return scores[0][0]
}

function pickSecondaryArchetype(c: CompositeScores, marketSize: number, primary: TeamArchetype): TeamArchetype | null {
  const scores: [TeamArchetype, number][] = [
    ['winNow', c.aggressiveness * 1.2 + c.spendingWillingness * 0.5],
    ['rebuilding', c.youthPreference * 0.8 + (100 - c.aggressiveness) * 0.6],
    ['developmental', c.developmentFocus * 1.0 + c.youthPreference * 0.5],
    ['analyticsDriven', c.analyticsLeaning * 1.3],
    ['oldSchool', (100 - c.analyticsLeaning) * 1.1],
  ]
  if (marketSize >= 7) scores.push(['bigMarketSpender', c.spendingWillingness * 1.1 + marketSize * 5])
  if (marketSize <= 5) scores.push(['smallMarketSaver', (100 - c.spendingWillingness) * 0.9 + (10 - marketSize) * 5])

  scores.sort((a, b) => b[1] - a[1])
  const second = scores.find(s => s[0] !== primary)
  if (!second) return null
  const top = scores[0][1]
  if (second[1] < top * 0.5) return null
  return second[0]
}

// ── CoachingStaff Derivation ────────────────────────────────────

const OFFENSIVE_SCHEMES: readonly OffensiveScheme[] = [
  'motion', 'iso_heavy', 'pick_and_roll', 'triangle', 'pace_and_space', 'princeton', 'drive_and_kick',
] as const

const DEFENSIVE_SCHEMES: readonly DefensiveScheme[] = [
  'man_to_man', 'switching', 'drop_coverage', 'blitz', 'zone_2_3', 'zone_3_2', 'pack_the_paint',
] as const

function deriveCoachingStaff(rng: RNG, coach: HeadCoach): CoachingStaff {
  const offenseSchemeWeights: Record<string, number> = {
    motion: coach.offenseRating * 0.3 + coach.adaptability * 0.2,
    iso_heavy: (100 - coach.adaptability) * 0.3 + coach.personality.egoLevel * 0.2,
    pick_and_roll: coach.offenseRating * 0.25 + 30,
    triangle: coach.experience * 0.3 + (100 - coach.adaptability) * 0.15,
    pace_and_space: coach.adaptability * 0.3 + coach.offenseRating * 0.2,
    princeton: coach.experience * 0.2 + coach.offenseRating * 0.25,
    drive_and_kick: coach.offenseRating * 0.2 + coach.adaptability * 0.2 + 10,
  }
  const bestOffense = Object.entries(offenseSchemeWeights).sort((a, b) => b[1] - a[1])[0][0] as OffensiveScheme

  const defenseSchemeWeights: Record<string, number> = {
    man_to_man: coach.defenseRating * 0.3 + coach.motivation * 0.2,
    switching: coach.adaptability * 0.35 + coach.defenseRating * 0.15,
    drop_coverage: coach.defenseRating * 0.2 + 20,
    blitz: coach.motivation * 0.3 + coach.personality.clutchCoaching * 0.2,
    zone_2_3: coach.defenseRating * 0.25 + coach.experience * 0.15,
    zone_3_2: coach.defenseRating * 0.2 + coach.experience * 0.15 + 5,
    pack_the_paint: (100 - coach.adaptability) * 0.2 + coach.defenseRating * 0.2,
  }
  const bestDefense = Object.entries(defenseSchemeWeights).sort((a, b) => b[1] - a[1])[0][0] as DefensiveScheme

  const pace = Math.round(85 + (coach.adaptability - 50) * 0.3 + randFloat(rng, -10, 10))
  const threePointEmphasis = Math.round(50 + (coach.offenseRating - 50) * 0.3 + (coach.adaptability - 50) * 0.2 + randFloat(rng, -10, 10))

  return {
    headCoach: {
      name: coach.name,
      offenseRating: coach.offenseRating,
      defenseRating: coach.defenseRating,
      playerDevelopment: coach.playerDevelopment,
      motivation: coach.motivation,
      adaptability: coach.adaptability,
      experience: coach.experience,
    },
    offensiveScheme: bestOffense,
    defensiveScheme: bestDefense,
    pacePreference: Math.max(70, Math.min(100, pace)),
    threePointEmphasis: Math.max(20, Math.min(90, threePointEmphasis)),
    starterMinutes: [36, 34, 34, 32, 30],
  }
}

// ── Main Generator ──────────────────────────────────────────────

export interface GeneratedStaff {
  staffRoster: StaffRoster
  teamPersonality: TeamPersonality
  coachingStaff: CoachingStaff
}

export function generateTeamStaff(
  teamId: string,
  teamInfo: TeamInfo,
  isUserTeam: boolean,
  seedPrefix: string = '',
): GeneratedStaff {
  const rng = mulberry32(hashString(`${seedPrefix}${teamId}staff`))
  const marketSize = teamInfo.marketSize

  const gm = generateGM(rng, teamId, marketSize, isUserTeam)
  const headCoach = generateHeadCoach(rng, teamId, marketSize)

  const assistantCount = randInt(rng, 2, 3)
  const mandatorySpecs: CoachSpecialty[] = ['offense', 'defense']
  const assistants: AssistantCoach[] = []
  for (let i = 0; i < assistantCount; i++) {
    assistants.push(generateAssistant(rng, teamId, i < mandatorySpecs.length ? mandatorySpecs[i] : undefined))
  }

  const scoutCount = randInt(rng, 2, 3)
  const scouts: Scout[] = []
  for (let i = 0; i < scoutCount; i++) {
    scouts.push(generateScout(rng, teamId))
  }

  const trainerCount = randInt(rng, 1, 2)
  const trainers: Trainer[] = []
  for (let i = 0; i < trainerCount; i++) {
    trainers.push(generateTrainer(rng, teamId))
  }

  const staffRoster: StaffRoster = {
    generalManager: gm,
    headCoach,
    assistantCoaches: assistants,
    scouts,
    trainers,
  }

  const teamPersonality = deriveTeamPersonality(gm, marketSize)
  const coachingStaff = deriveCoachingStaff(rng, headCoach)

  return { staffRoster, teamPersonality, coachingStaff }
}

export function generateAllTeamsStaff(
  teams: readonly TeamInfo[],
  userTeamId: string,
  leagueId: string,
): Map<string, GeneratedStaff> {
  const result = new Map<string, GeneratedStaff>()
  for (const team of teams) {
    result.set(
      team.abbreviation,
      generateTeamStaff(team.abbreviation, team, team.abbreviation === userTeamId, leagueId),
    )
  }
  return result
}
