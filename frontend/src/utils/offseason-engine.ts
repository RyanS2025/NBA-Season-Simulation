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

export function cpuSignFreeAgents(
  freeAgents: Player[],
  teams: Team[],
): { playerId: string; teamId: string; salary: number }[] {
  const signings: { playerId: string; teamId: string; salary: number }[] = []

  const sorted = [...freeAgents].sort((a, b) => b.ratings.overall - a.ratings.overall)

  for (const fa of sorted) {
    const needyTeams = teams.filter(t => {
      const rosterSize = t.roster.length
      return rosterSize < 15 && t.finances.totalPayroll < t.finances.salaryCap * 0.95
    })

    if (needyTeams.length === 0) continue

    const bestFit = needyTeams[Math.floor(Math.random() * needyTeams.length)]
    const salary = estimateMarketSalary(fa)

    signings.push({
      playerId: fa.id,
      teamId: bestFit.id,
      salary,
    })

    bestFit.roster.push({
      playerId: fa.id,
      rosterStatus: 'active',
      lineupPosition: bestFit.roster.length,
    })
    bestFit.finances.totalPayroll += salary
  }

  return signings
}

function estimateMarketSalary(player: Player): number {
  const ovr = player.ratings.overall
  if (ovr >= 90) return Math.round(35_000_000 + Math.random() * 10_000_000)
  if (ovr >= 85) return Math.round(25_000_000 + Math.random() * 10_000_000)
  if (ovr >= 80) return Math.round(15_000_000 + Math.random() * 10_000_000)
  if (ovr >= 75) return Math.round(8_000_000 + Math.random() * 7_000_000)
  if (ovr >= 70) return Math.round(3_000_000 + Math.random() * 5_000_000)
  return Math.round(1_100_000 + Math.random() * 2_000_000)
}
