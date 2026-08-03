import type { Team } from '../types'
import type { HeadCoach, StaffMarketEntry, CoachPersonality, StaffContract } from '../types/staff'
import { v4 as uuid } from 'uuid'

function mulberry32(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

const FIRST_NAMES = [
  'Mike', 'Steve', 'Rick', 'Tom', 'Bill', 'Dave', 'Jim', 'John', 'Bob', 'Dan',
  'Greg', 'Mark', 'Jeff', 'Scott', 'Brian', 'Chris', 'Eric', 'Kevin', 'Paul', 'Tony',
  'Jason', 'Frank', 'Larry', 'Phil', 'Terry', 'Gary', 'Ray', 'Andre', 'Nate', 'Sam',
]

const LAST_NAMES = [
  'Williams', 'Johnson', 'Brown', 'Davis', 'Miller', 'Wilson', 'Anderson', 'Thomas',
  'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Robinson', 'Clark',
  'Lewis', 'Walker', 'Hall', 'Young', 'King', 'Wright', 'Hill', 'Scott', 'Green',
  'Adams', 'Baker', 'Nelson', 'Carter', 'Mitchell',
]

export function updateHotSeat(team: Team, won: boolean): number {
  if (!team.staff) return 0
  const hc = team.staff.headCoach
  const totalGames = team.seasonRecord.wins + team.seasonRecord.losses
  if (totalGames < 10) return hc.hotSeatLevel

  const winPct = team.seasonRecord.wins / totalGames
  const ownerPatience = team.teamPersonality?.ownerPatience ?? 50

  let delta = 0
  if (won) {
    delta = -1.5
  } else {
    delta = 2.0
    if (winPct < 0.35) delta += 1.5
    else if (winPct < 0.45) delta += 0.5
  }

  delta *= (1.0 - ownerPatience / 200)

  return Math.max(0, Math.min(100, hc.hotSeatLevel + delta))
}

export function evaluateCoachesForFiring(
  teams: Team[],
  _seasonYear: number,
): { teamId: string; coach: HeadCoach; reason: string }[] {
  const fired: { teamId: string; coach: HeadCoach; reason: string }[] = []

  for (const team of teams) {
    if (!team.staff) continue
    const hc = team.staff.headCoach
    const totalGames = team.seasonRecord.wins + team.seasonRecord.losses
    if (totalGames < 20) continue

    const winPct = team.seasonRecord.wins / totalGames
    const ownerPatience = team.teamPersonality?.ownerPatience ?? 50
    const fireThreshold = 60 + (ownerPatience / 100) * 25

    let shouldFire = false
    let reason = ''

    if (hc.hotSeatLevel >= fireThreshold) {
      shouldFire = true
      reason = `Hot seat level (${Math.round(hc.hotSeatLevel)}) exceeded threshold`
    } else if (winPct < 0.30 && ownerPatience < 60) {
      shouldFire = true
      reason = `Dismal ${(winPct * 100).toFixed(0)}% win rate`
    } else if (winPct < 0.38 && hc.hotSeatLevel > 50) {
      shouldFire = true
      reason = `Poor record combined with hot seat pressure`
    }

    if (shouldFire && hc.contract.yearsRemaining <= 0) {
      shouldFire = true
      reason += ' (contract expired)'
    }

    if (shouldFire) {
      fired.push({ teamId: team.id, coach: hc, reason })
    }
  }

  return fired
}

function generateCoach(rng: () => number, seasonYear: number): HeadCoach {
  const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)]
  const last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)]
  const age = randInt(rng, 38, 65)
  const experience = randInt(rng, age - 38, Math.min(30, age - 30))

  const personality: CoachPersonality = {
    temperament: randInt(rng, 15, 90),
    egoLevel: randInt(rng, 20, 80),
    mediaHandling: randInt(rng, 30, 85),
    clutchCoaching: randInt(rng, 25, 90),
  }

  const contract: StaffContract = {
    annualSalary: randInt(rng, 2_000_000, 8_000_000),
    yearsRemaining: randInt(rng, 3, 5),
    totalYears: 0,
    signingYear: seasonYear,
  }
  contract.totalYears = contract.yearsRemaining

  return {
    id: uuid(),
    name: `${first} ${last}`,
    age,
    offenseRating: randInt(rng, 40, 90),
    defenseRating: randInt(rng, 40, 90),
    playerDevelopment: randInt(rng, 35, 90),
    motivation: randInt(rng, 40, 90),
    adaptability: randInt(rng, 35, 85),
    experience,
    personality,
    contract,
    teamId: '',
    careerRecord: {
      wins: randInt(rng, 0, experience * 50),
      losses: randInt(rng, 0, experience * 50),
    },
    hotSeatLevel: 0,
  }
}

export function generateCoachMarketplace(
  firedCoaches: { teamId: string; coach: HeadCoach }[],
  seasonYear: number,
  seed: number,
): StaffMarketEntry[] {
  const rng = mulberry32(seed + seasonYear * 31)
  const entries: StaffMarketEntry[] = []

  for (const fc of firedCoaches) {
    entries.push({
      id: uuid(),
      staffType: 'headCoach',
      data: { ...fc.coach, teamId: '', hotSeatLevel: 0 },
      marketStatus: 'available',
      previousTeamId: fc.teamId,
      reasonAvailable: 'fired',
      askingSalary: fc.coach.contract.annualSalary * 0.8,
    })
  }

  const freshCount = Math.max(5, 10 - firedCoaches.length)
  for (let i = 0; i < freshCount; i++) {
    const coach = generateCoach(rng, seasonYear)
    entries.push({
      id: uuid(),
      staffType: 'headCoach',
      data: coach,
      marketStatus: 'available',
      previousTeamId: null,
      reasonAvailable: 'new_entry',
      askingSalary: coach.contract.annualSalary,
    })
  }

  return entries
}

export function cpuHireCoaches(
  teams: Team[],
  marketplace: StaffMarketEntry[],
  firedTeamIds: Set<string>,
  userTeamId: string,
): { teamId: string; coachEntry: StaffMarketEntry }[] {
  const hires: { teamId: string; coachEntry: StaffMarketEntry }[] = []
  const available = marketplace.filter(e => e.marketStatus === 'available')

  for (const team of teams) {
    if (team.id === userTeamId) continue
    if (!firedTeamIds.has(team.id)) continue

    const personality = team.teamPersonality
    let bestFit: StaffMarketEntry | null = null
    let bestScore = -Infinity

    for (const entry of available) {
      if (entry.marketStatus !== 'available') continue
      const coach = entry.data as HeadCoach
      let score = (coach.offenseRating + coach.defenseRating) / 2

      if (personality) {
        if (personality.analyticsLeaning > 60) score += coach.adaptability * 0.3
        if (personality.developmentFocus > 60) score += coach.playerDevelopment * 0.5
        if (personality.aggressiveness > 60) score += coach.offenseRating * 0.2
      }

      if (score > bestScore) {
        bestScore = score
        bestFit = entry
      }
    }

    if (bestFit) {
      bestFit.marketStatus = 'hired'
      hires.push({ teamId: team.id, coachEntry: bestFit })
    }
  }

  return hires
}
