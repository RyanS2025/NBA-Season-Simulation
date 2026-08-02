import type { Team, Player, Position } from '../types'
import type {
  PlayerRatings,
  PlayerTendencies,
  CharacterTraits,
  DurabilityProfile,
  ShotChartProfile,
  PlayerBio,
  PlayerStatus,
  PlayerContract,
} from '../types/player'
import { v4 as uuid } from 'uuid'

export interface DraftProspect {
  id: string
  firstName: string
  lastName: string
  position: Position
  secondaryPosition: Position | null
  age: number
  school: string
  country: string
  height: number
  weight: number
  hand: 'L' | 'R'
  projectedOverall: number
  ceiling: number
  floor: number
  trueOverall: number
  scoutingRevealed: number
  storyline: string | null
  ratings: PlayerRatings
  tendencies: PlayerTendencies
  character: CharacterTraits
  durability: DurabilityProfile
  shotChart: ShotChartProfile
}

export interface DraftPick {
  pickNumber: number
  round: number
  teamId: string
  prospectId: string | null
  prospectName: string | null
}

export interface DraftLotteryResult {
  teamId: string
  originalSeed: number
  pickNumber: number
  moved: boolean
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function convertKeys<T>(obj: unknown): T {
  if (Array.isArray(obj)) return obj.map(item => convertKeys(item)) as T
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[snakeToCamel(key)] = convertKeys(value)
    }
    return result as T
  }
  return obj as T
}

interface RawJsonProspect {
  id: string
  name: string
  true_overall: number
  bio: Record<string, unknown>
  ratings: Record<string, unknown>
  tendencies: Record<string, unknown>
  character: Record<string, unknown>
  durability: Record<string, unknown>
  shot_chart: Record<string, unknown>
  position: string
  potential: number
  peak_age: number
  college: string
  country: string
  age: number
  storyline: string | null
}

export async function loadDraftClassFromJSON(seasonYear: number): Promise<DraftProspect[]> {
  try {
    const resp = await fetch(`/data/draft_class_${seasonYear}.json`)
    if (!resp.ok) return []
    const raw: RawJsonProspect[] = await resp.json()

    return raw.map((p, i) => {
      const bio = convertKeys<PlayerBio>(p.bio)
      const ratings = convertKeys<PlayerRatings>(p.ratings)
      const tendencies = convertKeys<PlayerTendencies>(p.tendencies)
      const character = convertKeys<CharacterTraits>(p.character)
      const durability = convertKeys<DurabilityProfile>(p.durability)
      const shotChart = convertKeys<ShotChartProfile>(p.shot_chart)

      if (ratings.potential === undefined || ratings.potential === 0) {
        ratings.potential = p.potential ?? Math.min(99, p.true_overall + 10)
      }
      if (!ratings.peakAge) {
        ratings.peakAge = p.peak_age ?? 28
      }
      if (!ratings.intangibles) {
        ratings.intangibles = Math.round(50 + Math.random() * 30)
      }

      const uncertainty = Math.max(2, 8 - i * 0.1)
      const projected = p.true_overall + Math.round((Math.random() - 0.5) * uncertainty)

      return {
        id: p.id,
        firstName: bio.firstName,
        lastName: bio.lastName,
        position: bio.position,
        secondaryPosition: bio.secondaryPosition ?? null,
        age: p.age,
        school: p.college ?? bio.college ?? 'Unknown',
        country: p.country ?? bio.country ?? 'USA',
        height: bio.height,
        weight: bio.weight,
        hand: (bio.hand?.toUpperCase() ?? 'R') as 'L' | 'R',
        projectedOverall: Math.min(99, Math.max(55, projected)),
        ceiling: Math.min(99, ratings.potential),
        floor: Math.max(55, p.true_overall - 5),
        trueOverall: p.true_overall,
        scoutingRevealed: i < 15 ? 3 : i < 30 ? 2 : 1,
        storyline: p.storyline ?? null,
        ratings,
        tendencies,
        character,
        durability,
        shotChart,
      }
    })
  } catch {
    return []
  }
}

export function convertProspectToPlayer(
  prospect: DraftProspect,
  teamId: string,
  pickNumber: number,
  round: number,
  seasonYear: number,
): Player {
  const bio: PlayerBio = {
    firstName: prospect.firstName,
    lastName: prospect.lastName,
    position: prospect.position,
    secondaryPosition: prospect.secondaryPosition,
    height: prospect.height ?? 78,
    weight: prospect.weight ?? 210,
    age: prospect.age,
    yearsInLeague: 0,
    college: prospect.school,
    country: prospect.country,
    draftYear: seasonYear,
    draftRound: round,
    draftPick: pickNumber,
    jerseyNumber: Math.floor(Math.random() * 55) + 1,
    hand: prospect.hand ?? 'R',
  }

  const rookieSalary = round === 1
    ? Math.round(4_000_000 + (60 - pickNumber) * 200_000)
    : Math.round(1_100_000 + Math.random() * 500_000)

  const contract: PlayerContract = {
    annualSalary: rookieSalary,
    yearsRemaining: round === 1 ? 4 : 2,
    totalYears: round === 1 ? 4 : 2,
    contractType: 'rookie',
    noTradeClause: false,
    playerOption: false,
    teamOption: round === 1 && pickNumber <= 30,
    guaranteed: round === 1,
  }

  const status: PlayerStatus = {
    health: 'healthy',
    currentInjury: null,
    fatigue: 0,
    morale: 80,
    isRookie: true,
    isFreeAgent: false,
    isRestrictedFA: false,
    teamId,
  }

  return {
    id: prospect.id,
    nbaId: 0,
    headshotUrl: '',
    teamId,
    bio,
    ratings: prospect.ratings,
    shotChart: prospect.shotChart ?? { zones: [] },
    tendencies: prospect.tendencies,
    character: prospect.character,
    durability: prospect.durability ?? {
      overallDurability: 80,
      ankleHealth: 80,
      kneeHealth: 80,
      shoulderHealth: 80,
      backHealth: 80,
      wristHandHealth: 80,
      footHealth: 80,
      concussionRisk: 15,
      softTissueRisk: 20,
      injuryHistory: [],
    },
    contract,
    status,
    careerStats: [],
    awards: [],
  }
}

export function runDraftLottery(
  teams: Team[],
): DraftLotteryResult[] {
  const nonPlayoff = [...teams]
    .sort((a, b) => {
      const winPctA = a.seasonRecord.wins / Math.max(1, a.seasonRecord.wins + a.seasonRecord.losses)
      const winPctB = b.seasonRecord.wins / Math.max(1, b.seasonRecord.wins + b.seasonRecord.losses)
      return winPctA - winPctB
    })
    .slice(0, 14)

  const odds = [140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15, 10, 5]

  const results: DraftLotteryResult[] = nonPlayoff.map((t, i) => ({
    teamId: t.id,
    originalSeed: i + 1,
    pickNumber: i + 1,
    moved: false,
  }))

  const remaining = [...results]
  const remainingOdds = [...odds]
  const topPicks: DraftLotteryResult[] = []

  for (let pick = 1; pick <= 4 && remaining.length > 0; pick++) {
    const totalOdds = remainingOdds.reduce((s, o) => s + o, 0)
    let roll = Math.random() * totalOdds
    let winnerIdx = 0

    for (let j = 0; j < remainingOdds.length; j++) {
      roll -= remainingOdds[j]
      if (roll <= 0) {
        winnerIdx = j
        break
      }
    }

    const winner = remaining[winnerIdx]
    winner.pickNumber = pick
    winner.moved = winner.originalSeed !== pick
    topPicks.push(winner)

    remaining.splice(winnerIdx, 1)
    remainingOdds.splice(winnerIdx, 1)
  }

  remaining.sort((a, b) => a.originalSeed - b.originalSeed)
  remaining.forEach((r, i) => {
    r.pickNumber = 5 + i
    r.moved = r.originalSeed !== r.pickNumber
  })

  return [...topPicks, ...remaining].sort((a, b) => a.pickNumber - b.pickNumber)
}

export function buildDraftOrder(
  lotteryResults: DraftLotteryResult[],
  allTeams: Team[],
): DraftPick[] {
  const picks: DraftPick[] = []

  for (const lr of lotteryResults) {
    picks.push({
      pickNumber: lr.pickNumber,
      round: 1,
      teamId: lr.teamId,
      prospectId: null,
      prospectName: null,
    })
  }

  const nonLotteryTeams = allTeams
    .filter(t => !lotteryResults.some(lr => lr.teamId === t.id))
    .sort((a, b) => {
      const winPctA = a.seasonRecord.wins / Math.max(1, a.seasonRecord.wins + a.seasonRecord.losses)
      const winPctB = b.seasonRecord.wins / Math.max(1, b.seasonRecord.wins + b.seasonRecord.losses)
      return winPctA - winPctB
    })

  let pickNum = lotteryResults.length + 1
  for (const t of nonLotteryTeams) {
    picks.push({
      pickNumber: pickNum++,
      round: 1,
      teamId: t.id,
      prospectId: null,
      prospectName: null,
    })
  }

  const round2Teams = allTeams
    .sort((a, b) => {
      const winPctA = a.seasonRecord.wins / Math.max(1, a.seasonRecord.wins + a.seasonRecord.losses)
      const winPctB = b.seasonRecord.wins / Math.max(1, b.seasonRecord.wins + b.seasonRecord.losses)
      return winPctA - winPctB
    })

  for (const t of round2Teams) {
    picks.push({
      pickNumber: pickNum++,
      round: 2,
      teamId: t.id,
      prospectId: null,
      prospectName: null,
    })
  }

  return picks
}

export function generateDraftClass(seasonYear: number, count: number = 60): DraftProspect[] {
  const firstNames = [
    'Jalen', 'Marcus', 'Tobias', 'Nikolai', 'Devin', 'Jaylen', 'Andre', 'Karl',
    'Zion', 'Damian', 'Santiago', 'Isaiah', 'Cam', 'Tre', 'Brandon', 'Malik',
    'Darius', 'Xavier', 'Elijah', 'Caleb', 'Jayson', 'Tyrese', 'Ayo', 'Keegan',
    'Jabari', 'Scoot', 'Dereck', 'Ausar', 'Jarace', 'Cason', 'Gradey', 'Bilal',
    'Jordan', 'Nick', 'Kobe', 'Amar', 'Davion', 'Herb', 'Tari', 'Leonard',
    'Terrence', 'Kyle', 'Ben', 'Paolo', 'Franz', 'Evan', 'Scottie', 'Cade',
    'Jett', 'Bronny', 'Reed', 'Matas', 'Alex', 'Cooper', 'Dylan', 'Yves',
    'AJ', 'Ron', 'Ja', 'Anthony',
  ]

  const lastNames = [
    'Crawford', 'Webb', 'Adebayo', 'Petrovic', 'Okafor', 'Watkins', 'Baptiste',
    'Reed', 'Palmer', 'Rhodes', 'Reyes', 'Thompson', 'Boozer', 'Williams', 'Park',
    'Johnson', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas',
    'Jackson', 'Harris', 'Martin', 'Robinson', 'Clark', 'Lewis', 'Walker',
    'Green', 'Baker', 'Hall', 'Allen', 'Young', 'King', 'Wright', 'Scott',
    'Mitchell', 'Carter', 'Phillips', 'Evans', 'Turner', 'Collins', 'Stewart',
    'Morris', 'Murphy', 'Cook', 'Rogers', 'Morgan', 'Bell', 'Howard', 'Ward',
    'Jenkins', 'Russell', 'Brooks', 'Gray', 'James', 'Powell', 'Long',
  ]

  const schools = [
    'Duke', 'Kentucky', 'North Carolina', 'Kansas', 'UCLA', 'Gonzaga', 'Michigan',
    'Villanova', 'Arizona', 'Houston', 'Auburn', 'Baylor', 'Tennessee', 'Texas',
    'Connecticut', 'Purdue', 'Real Madrid', 'FC Barcelona', 'Partizan Belgrade',
    'Overtime Elite', 'G League Ignite', 'NBL (Australia)',
  ]

  const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']

  return Array.from({ length: count }, (_, i) => {
    const quality = 1 - (i / count)
    const trueOverall = Math.round(62 + quality * 28 + (Math.random() - 0.5) * 8)
    const ceiling = Math.min(99, trueOverall + Math.round(Math.random() * 10 + 3))
    const floor = Math.max(55, trueOverall - Math.round(Math.random() * 8 + 2))
    const uncertainty = Math.round(Math.random() * 6 + 2)
    const projectedOverall = trueOverall + Math.round((Math.random() - 0.5) * uncertainty)
    const pos = positions[Math.floor(Math.random() * positions.length)]

    return {
      id: `draft-${seasonYear}-${i + 1}`,
      firstName: firstNames[i % firstNames.length],
      lastName: lastNames[i % lastNames.length],
      position: pos,
      secondaryPosition: null,
      age: 19 + Math.floor(Math.random() * 3),
      school: schools[Math.floor(Math.random() * schools.length)],
      country: Math.random() > 0.8 ? 'International' : 'USA',
      height: 74 + Math.floor(Math.random() * 12),
      weight: 180 + Math.floor(Math.random() * 60),
      hand: 'R' as const,
      projectedOverall: Math.min(99, Math.max(55, projectedOverall)),
      ceiling,
      floor,
      trueOverall: Math.min(99, Math.max(55, trueOverall)),
      scoutingRevealed: i < 15 ? 3 : i < 30 ? 2 : 1,
      storyline: null,
      ratings: generateBasicRatings(trueOverall, pos),
      tendencies: generateBasicTendencies(),
      character: generateBasicCharacter(),
      durability: {
        overallDurability: 70 + Math.floor(Math.random() * 25),
        ankleHealth: 70 + Math.floor(Math.random() * 25),
        kneeHealth: 70 + Math.floor(Math.random() * 25),
        shoulderHealth: 70 + Math.floor(Math.random() * 25),
        backHealth: 70 + Math.floor(Math.random() * 25),
        wristHandHealth: 70 + Math.floor(Math.random() * 25),
        footHealth: 70 + Math.floor(Math.random() * 25),
        concussionRisk: Math.floor(Math.random() * 25),
        softTissueRisk: Math.floor(Math.random() * 30),
        injuryHistory: [],
      },
      shotChart: { zones: [] },
    }
  })
}

function generateBasicRatings(overall: number, _pos: Position): PlayerRatings {
  const vary = () => Math.round(overall + (Math.random() - 0.5) * 16)
  const clamp = (v: number) => Math.min(99, Math.max(40, v))
  return {
    finishing: clamp(vary()), closeRange: clamp(vary()), midRange: clamp(vary()),
    threePoint: clamp(vary()), freeThrow: clamp(vary()), postGame: clamp(vary()),
    drawFoul: clamp(vary()), offBallMovement: clamp(vary()), ballHandling: clamp(vary()),
    passingVision: clamp(vary()), passingAccuracy: clamp(vary()),
    perimeterDefense: clamp(vary()), interiorDefense: clamp(vary()),
    shotBlocking: clamp(vary()), stealing: clamp(vary()),
    defensiveIq: clamp(vary()), defensiveConsistency: clamp(vary()),
    speed: clamp(vary()), acceleration: clamp(vary()), lateralQuickness: clamp(vary()),
    vertical: clamp(vary()), strength: clamp(vary()), stamina: clamp(vary()),
    basketballIq: clamp(vary()), offensiveIq: clamp(vary()),
    rebounding: clamp(vary()), offensiveRebounding: clamp(vary()),
    hustle: clamp(vary()), intangibles: clamp(vary()),
    overall, potential: Math.min(99, overall + Math.round(Math.random() * 10 + 3)),
    peakAge: 26 + Math.floor(Math.random() * 6),
  }
}

function generateBasicTendencies(): PlayerTendencies {
  const r = () => Math.round(40 + Math.random() * 50)
  return {
    pullUpFrequency: r(), catchAndShootFrequency: r(), driveFrequency: r(),
    postUpFrequency: r(), isoFrequency: r(), pickAndRollBallHandler: r(),
    pickAndRollScreener: r(), spotUpFrequency: r(), transitionFrequency: r(),
    cutFrequency: r(), passOutOfDriveRate: r(), skipPassRate: r(),
    alleyOopPassRate: r(), gambleForSteals: r(), helpDefenseRate: r(),
    closeoutAggression: r(), boxOutRate: r(), usageDesire: r(),
    pacePreference: r(), foulProneness: r(), shotClockTendency: r(),
    contestedShotWillingness: r(),
  }
}

function generateBasicCharacter(): CharacterTraits {
  const r = () => Math.round(30 + Math.random() * 50)
  return {
    leadership: r(), workEthic: r(), clutch: r(), ego: r(),
    coachability: r(), temperament: r(), fanFavorite: r(),
    mediaPersonality: r(), loyalty: r(), competitiveness: r(),
  }
}

export function cpuAutoPick(
  prospects: DraftProspect[],
  team: Team,
  teamPlayers: Player[],
): DraftProspect | null {
  if (prospects.length === 0) return null

  const positionNeed = getPositionNeed(teamPlayers)

  const scored = prospects.map(p => {
    let score = p.projectedOverall * 2 + p.ceiling * 0.5
    if (positionNeed.includes(p.position)) score += 5
    return { prospect: p, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.prospect ?? prospects[0]
}

function getPositionNeed(players: Player[]): string[] {
  const counts: Record<string, number> = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 }
  for (const p of players) {
    counts[p.bio.position] = (counts[p.bio.position] ?? 0) + 1
  }
  const needs: string[] = []
  for (const [pos, count] of Object.entries(counts)) {
    if (count < 2) needs.push(pos)
  }
  return needs
}

export function getCpuPickAnalysis(prospect: DraftProspect, team: Team, teamPlayers: Player[]): string {
  const needs = getPositionNeed(teamPlayers)
  const fillsNeed = needs.includes(prospect.position)
  const name = `${prospect.firstName} ${prospect.lastName}`
  const teamName = `${team.info.city} ${team.info.name}`

  if (prospect.trueOverall >= 80) {
    return fillsNeed
      ? `${teamName} get their franchise cornerstone with ${name} — a ${prospect.position} who fills a key positional need.`
      : `${teamName} take BPA with ${name}, the most talented player on the board.`
  }
  if (prospect.ceiling >= 90) {
    return `${teamName} swing for upside with ${name}, a ${prospect.position} with a sky-high ceiling.`
  }
  if (fillsNeed) {
    return `${teamName} address a positional need, selecting ${prospect.position} ${name}.`
  }
  return `${teamName} select ${name}, a ${prospect.position} from ${prospect.school}.`
}
