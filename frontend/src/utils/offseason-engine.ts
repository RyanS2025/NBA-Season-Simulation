import type { Player, Team } from '../types'
import type { StaffRoster, CoachSpecialty } from '../types/staff'

export interface OffseasonChanges {
  updatedPlayers: Player[]
  retiredPlayerIds: string[]
  freeAgentIds: string[]
  developmentLog: { playerId: string; name: string; change: number; reason: string }[]
}

const SPECIALTY_RATINGS: Record<CoachSpecialty, string[]> = {
  shooting: ['threePoint', 'midRange', 'freeThrow'],
  offense: ['finishing', 'closeRange', 'ballHandling', 'passingVision'],
  defense: ['perimeterDefense', 'interiorDefense'],
  playerDevelopment: [],
  bigMen: ['rebounding', 'interiorDefense', 'finishing', 'closeRange'],
  guards: ['ballHandling', 'passingVision', 'speed', 'threePoint'],
}

const PHYSICAL_RATINGS = new Set(['speed', 'acceleration', 'vertical'])

function getStaffModifiers(teamId: string, staffMap: Map<string, StaffRoster>) {
  const staff = staffMap.get(teamId)
  if (!staff) return { coachMult: 1.0, motivationBoost: 0, specialtyBonuses: new Map<string, number>(), trainerDecayReduction: 0, devFocusMult: 1.0 }

  const hc = staff.headCoach
  const coachMult = 0.7 + (hc.playerDevelopment / 100) * 0.6
  const motivationBoost = (hc.motivation / 100) * 0.3

  const specialtyBonuses = new Map<string, number>()
  let devCoachBonus = 0
  for (const ac of staff.assistantCoaches) {
    if (ac.specialty === 'playerDevelopment') {
      devCoachBonus += ac.specialtyRating / 100 * 0.3
      continue
    }
    const targetRatings = SPECIALTY_RATINGS[ac.specialty] ?? []
    const bonus = (ac.specialtyRating / 100) * 1.2
    for (const r of targetRatings) {
      specialtyBonuses.set(r, (specialtyBonuses.get(r) ?? 0) + bonus)
    }
  }

  const avgTrainerConditioning = staff.trainers.length > 0
    ? staff.trainers.reduce((s, t) => s + t.skills.strengthConditioning, 0) / staff.trainers.length
    : 50
  const trainerDecayReduction = (avgTrainerConditioning / 100) * 0.8

  const devFocusMult = 1.0 + devCoachBonus + ((staff.generalManager?.skills.playerDevelopmentFocus ?? 50) / 100) * 0.15

  return { coachMult, motivationBoost, specialtyBonuses, trainerDecayReduction, devFocusMult }
}

export function runPlayerDevelopment(players: Player[], staffMap?: Map<string, StaffRoster>): OffseasonChanges {
  const updatedPlayers: Player[] = []
  const retiredPlayerIds: string[] = []
  const freeAgentIds: string[] = []
  const developmentLog: OffseasonChanges['developmentLog'] = []
  const resolvedStaffMap = staffMap ?? new Map()

  for (const p of players) {
    const updated = { ...p, ratings: { ...p.ratings } }
    const age = p.bio.age
    const peakAge = p.ratings.peakAge || 28
    const workEthic = p.character.workEthic
    const mods = getStaffModifiers(p.teamId, resolvedStaffMap)

    const effectiveWorkEthic = Math.min(100, workEthic + mods.motivationBoost * 100)

    let change = 0
    let reason = ''

    if (age <= 22) {
      change = 2 + (effectiveWorkEthic / 100) * 2 + (Math.random() - 0.3) * 2
      reason = 'Young player growth'
    } else if (age <= 25) {
      change = 1 + (effectiveWorkEthic / 100) * 1.5 + (Math.random() - 0.4) * 1.5
      reason = 'Development years'
    } else if (age <= peakAge) {
      change = (Math.random() - 0.3) * 1
      reason = 'Peak years'
    } else if (age <= 32) {
      change = -1 + (Math.random() - 0.5) * 1
      reason = 'Early decline'
    } else if (age <= 35) {
      change = -2 + (Math.random() - 0.5) * 1
      reason = 'Declining'
    } else {
      change = -3 + (Math.random() - 0.5) * 1.5
      reason = 'Late career decline'
    }

    if (change > 0) {
      change *= mods.coachMult * mods.devFocusMult
    } else if (change < 0) {
      change *= Math.max(0.5, 1.0 - mods.trainerDecayReduction * 0.3)
    }

    change = Math.round(change)

    const ratingKeys: (keyof typeof updated.ratings)[] = [
      'finishing', 'closeRange', 'midRange', 'threePoint', 'freeThrow',
      'ballHandling', 'passingVision', 'speed', 'acceleration', 'vertical',
      'perimeterDefense', 'interiorDefense', 'rebounding',
    ]

    for (const key of ratingKeys) {
      const current = updated.ratings[key] as number
      let delta = change + Math.round((Math.random() - 0.5) * 2)

      const specialtyBonus = mods.specialtyBonuses.get(key) ?? 0
      if (specialtyBonus > 0 && change >= 0) {
        delta += Math.round(specialtyBonus)
      }

      if (PHYSICAL_RATINGS.has(key) && age > 30) {
        const physicalReduction = mods.trainerDecayReduction * 0.5
        delta = Math.round(delta + physicalReduction)
      }

      const newVal = Math.min(99, Math.max(40, current + delta))
      ;(updated.ratings as Record<string, number>)[key] = newVal
    }

    // Recalculate overall (simple average of key ratings)
    const pos = p.bio.position
    updated.ratings.overall = computeOverall(updated.ratings, pos)

    // Age up
    updated.bio = { ...p.bio, age: age + 1, yearsInLeague: p.bio.yearsInLeague + 1 }

    // Check retirement (36+ with low overall and low competitiveness)
    if (age >= 36 && updated.ratings.overall < 72 && p.character.competitiveness < 70) {
      if (Math.random() < 0.6) {
        retiredPlayerIds.push(p.id)
        continue
      }
    }
    if (age >= 38 && updated.ratings.overall < 76) {
      if (Math.random() < 0.8) {
        retiredPlayerIds.push(p.id)
        continue
      }
    }

    // Check contract expiration
    if (p.contract && p.contract.yearsRemaining <= 1) {
      updated.status = { ...p.status, isFreeAgent: true }
      updated.teamId = ''
      freeAgentIds.push(p.id)
    } else if (p.contract) {
      updated.contract = { ...p.contract, yearsRemaining: p.contract.yearsRemaining - 1 }
    }

    if (change !== 0) {
      developmentLog.push({
        playerId: p.id,
        name: `${p.bio.firstName} ${p.bio.lastName}`,
        change,
        reason,
      })
    }

    updatedPlayers.push(updated)
  }

  return { updatedPlayers, retiredPlayerIds, freeAgentIds, developmentLog }
}

function computeOverall(ratings: Record<string, number>, position: string): number {
  const weights: Record<string, Record<string, number>> = {
    PG: {
      ballHandling: 1.5, passingVision: 1.3, speed: 1.2, threePoint: 1.0,
      perimeterDefense: 0.8, finishing: 0.8, midRange: 0.6,
    },
    SG: {
      threePoint: 1.4, midRange: 1.0, finishing: 1.0, speed: 1.0,
      perimeterDefense: 0.9, ballHandling: 0.7, passingVision: 0.5,
    },
    SF: {
      finishing: 1.2, threePoint: 1.0, perimeterDefense: 1.0, rebounding: 0.8,
      midRange: 0.8, speed: 0.7, passingVision: 0.5,
    },
    PF: {
      rebounding: 1.3, finishing: 1.2, interiorDefense: 1.1, midRange: 0.8,
      threePoint: 0.6, speed: 0.5, perimeterDefense: 0.5,
    },
    C: {
      rebounding: 1.4, interiorDefense: 1.3, finishing: 1.2, midRange: 0.5,
      speed: 0.3, perimeterDefense: 0.3, threePoint: 0.2,
    },
  }

  const posWeights = weights[position] ?? weights['SF']
  let totalWeight = 0
  let totalScore = 0

  for (const [key, weight] of Object.entries(posWeights)) {
    totalScore += (ratings[key] ?? 70) * weight
    totalWeight += weight
  }

  return Math.min(99, Math.max(60, Math.round(totalScore / totalWeight)))
}

export interface CpuSigning {
  playerId: string
  playerName: string
  teamId: string
  salary: number
  years: number
}

const MINIMUM_SALARY = 1_100_000
const CPU_TARGET_ROSTER = 14
const USER_EMERGENCY_ROSTER = 10

function contractYearsFor(age: number): number {
  if (age <= 24) return 3 + Math.floor(Math.random() * 2) // 3-4
  if (age <= 29) return 2 + Math.floor(Math.random() * 3) // 2-4
  if (age <= 33) return 1 + Math.floor(Math.random() * 3) // 1-3
  return 1 + Math.floor(Math.random() * 2) // 1-2
}

function signPlayerTo(player: Player, teamId: string, salary: number, years: number): void {
  player.teamId = teamId
  player.status = { ...player.status, isFreeAgent: false, teamId }
  player.contract = {
    annualSalary: salary,
    yearsRemaining: years,
    totalYears: years,
    contractType: salary <= MINIMUM_SALARY * 1.05 ? 'minimum' : 'standard',
    noTradeClause: false,
    playerOption: false,
    teamOption: false,
    guaranteed: true,
  }
}

/**
 * CPU offseason free agency: fills every CPU roster back up to a full
 * NBA-size rotation after contract expirations, so the league never
 * drains into an ocean of unsigned players. The user's team is only
 * emergency-filled to a playable minimum with one-year minimum deals,
 * leaving real free agency decisions to the user.
 *
 * Skill value is computed from raw individual ratings (never the
 * cosmetic overall field).
 */
export function cpuSignFreeAgents(
  freeAgents: Player[],
  teams: Team[],
  allPlayers: Player[],
  userTeamId: string,
): CpuSigning[] {
  const signings: CpuSigning[] = []

  const rosterCounts = new Map<string, number>()
  const positionCounts = new Map<string, Map<string, number>>()
  for (const t of teams) {
    rosterCounts.set(t.id, 0)
    positionCounts.set(t.id, new Map())
  }
  for (const p of allPlayers) {
    if (!p.teamId || !rosterCounts.has(p.teamId)) continue
    rosterCounts.set(p.teamId, (rosterCounts.get(p.teamId) ?? 0) + 1)
    const posMap = positionCounts.get(p.teamId)!
    posMap.set(p.bio.position, (posMap.get(p.bio.position) ?? 0) + 1)
  }

  const payrolls = new Map<string, number>()
  for (const t of teams) {
    const teamPlayers = allPlayers.filter(p => p.teamId === t.id)
    payrolls.set(t.id, teamPlayers.reduce((s, p) => s + (p.contract?.annualSalary ?? 0), 0))
  }

  const available = [...freeAgents]
    .filter(p => !p.teamId)
    .sort((a, b) => skillValue(b) - skillValue(a))

  const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C']

  const takeBestForTeam = (teamId: string): Player | null => {
    if (available.length === 0) return null
    const posMap = positionCounts.get(teamId)!
    // Most under-represented position on the roster
    const neededPos = POSITIONS.reduce((worst, pos) =>
      (posMap.get(pos) ?? 0) < (posMap.get(worst) ?? 0) ? pos : worst, POSITIONS[0])

    // Prefer a positional fit among the best remaining players
    const scanDepth = Math.min(40, available.length)
    for (let i = 0; i < scanDepth; i++) {
      const cand = available[i]
      if (cand.bio.position === neededPos || cand.bio.secondaryPosition === neededPos) {
        available.splice(i, 1)
        return cand
      }
    }
    return available.shift() ?? null
  }

  // Round-robin: the shortest CPU roster signs next, so talent spreads
  // instead of stacking on whichever team is iterated first.
  const cpuTeams = teams.filter(t => t.id !== userTeamId)
  for (;;) {
    const needy = cpuTeams
      .filter(t => (rosterCounts.get(t.id) ?? 0) < CPU_TARGET_ROSTER)
      .sort((a, b) => (rosterCounts.get(a.id) ?? 0) - (rosterCounts.get(b.id) ?? 0))
    if (needy.length === 0 || available.length === 0) break

    const team = needy[0]
    const player = takeBestForTeam(team.id)
    if (!player) break

    const payroll = payrolls.get(team.id) ?? 0
    const cap = team.finances.salaryCap || 140_000_000
    let salary = estimateMarketSalary(player)
    // Rosters must be filled: fall back to a minimum deal when capped out
    if (payroll + salary > cap * 1.1) salary = MINIMUM_SALARY
    const years = salary <= MINIMUM_SALARY ? 1 : contractYearsFor(player.bio.age)

    signPlayerTo(player, team.id, salary, years)
    signings.push({
      playerId: player.id,
      playerName: `${player.bio.firstName} ${player.bio.lastName}`,
      teamId: team.id,
      salary,
      years,
    })

    rosterCounts.set(team.id, (rosterCounts.get(team.id) ?? 0) + 1)
    payrolls.set(team.id, payroll + salary)
    const posMap = positionCounts.get(team.id)!
    posMap.set(player.bio.position, (posMap.get(player.bio.position) ?? 0) + 1)
  }

  // Emergency-fill the user team to a playable roster with 1-year
  // minimum contracts (lowest-value players, so the user's real free
  // agency choices stay meaningful).
  const userCount = rosterCounts.get(userTeamId) ?? 0
  if (userCount < USER_EMERGENCY_ROSTER && available.length > 0) {
    const cheapest = [...available].sort((a, b) => skillValue(a) - skillValue(b))
    for (let i = 0; i < USER_EMERGENCY_ROSTER - userCount && i < cheapest.length; i++) {
      const player = cheapest[i]
      const idx = available.indexOf(player)
      if (idx >= 0) available.splice(idx, 1)
      signPlayerTo(player, userTeamId, MINIMUM_SALARY, 1)
      signings.push({
        playerId: player.id,
        playerName: `${player.bio.firstName} ${player.bio.lastName}`,
        teamId: userTeamId,
        salary: MINIMUM_SALARY,
        years: 1,
      })
    }
  }

  return signings
}

function skillValue(player: Player): number {
  return computeOverall(player.ratings as unknown as Record<string, number>, player.bio.position)
}

function estimateMarketSalary(player: Player): number {
  const value = skillValue(player)
  if (value >= 90) return Math.round(35_000_000 + Math.random() * 10_000_000)
  if (value >= 85) return Math.round(25_000_000 + Math.random() * 10_000_000)
  if (value >= 80) return Math.round(15_000_000 + Math.random() * 10_000_000)
  if (value >= 75) return Math.round(8_000_000 + Math.random() * 7_000_000)
  if (value >= 70) return Math.round(3_000_000 + Math.random() * 5_000_000)
  return Math.round(MINIMUM_SALARY + Math.random() * 2_000_000)
}
