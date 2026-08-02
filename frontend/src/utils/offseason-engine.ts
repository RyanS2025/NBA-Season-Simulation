import type { Player, Team } from '../types'

export interface OffseasonChanges {
  updatedPlayers: Player[]
  retiredPlayerIds: string[]
  freeAgentIds: string[]
  developmentLog: { playerId: string; name: string; change: number; reason: string }[]
}

export function runPlayerDevelopment(players: Player[]): OffseasonChanges {
  const updatedPlayers: Player[] = []
  const retiredPlayerIds: string[] = []
  const freeAgentIds: string[] = []
  const developmentLog: OffseasonChanges['developmentLog'] = []

  for (const p of players) {
    const updated = { ...p, ratings: { ...p.ratings } }
    const age = p.bio.age
    const peakAge = p.ratings.peakAge || 28
    const workEthic = p.character.workEthic

    let change = 0
    let reason = ''

    if (age <= 22) {
      change = Math.round(2 + (workEthic / 100) * 2 + (Math.random() - 0.3) * 2)
      reason = 'Young player growth'
    } else if (age <= 25) {
      change = Math.round(1 + (workEthic / 100) * 1.5 + (Math.random() - 0.4) * 1.5)
      reason = 'Development years'
    } else if (age <= peakAge) {
      change = Math.round((Math.random() - 0.3) * 1)
      reason = 'Peak years'
    } else if (age <= 32) {
      change = Math.round(-1 + (Math.random() - 0.5) * 1)
      reason = 'Early decline'
    } else if (age <= 35) {
      change = Math.round(-2 + (Math.random() - 0.5) * 1)
      reason = 'Declining'
    } else {
      change = Math.round(-3 + (Math.random() - 0.5) * 1.5)
      reason = 'Late career decline'
    }

    // Apply change to key ratings
    const ratingKeys: (keyof typeof updated.ratings)[] = [
      'finishing', 'closeRange', 'midRange', 'threePoint', 'freeThrow',
      'ballHandling', 'passingVision', 'speed', 'acceleration', 'vertical',
      'perimeterDefense', 'interiorDefense', 'rebounding',
    ]

    for (const key of ratingKeys) {
      const current = updated.ratings[key] as number
      const newVal = Math.min(99, Math.max(40, current + change + Math.round((Math.random() - 0.5) * 2)))
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
