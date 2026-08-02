import type { Team, Player } from '../types'

export interface DraftProspect {
  id: string
  firstName: string
  lastName: string
  position: 'PG' | 'SG' | 'SF' | 'PF' | 'C'
  age: number
  school: string
  country: string
  projectedOverall: number
  ceiling: number
  floor: number
  trueOverall: number
  scoutingRevealed: number
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

  // 2019+ NBA lottery odds: bottom 3 each have 14%, then decreasing
  const odds = [140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15, 10, 5]

  const results: DraftLotteryResult[] = nonPlayoff.map((t, i) => ({
    teamId: t.id,
    originalSeed: i + 1,
    pickNumber: i + 1,
    moved: false,
  }))

  // Simulate top 4 picks via weighted random
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

  // Remaining teams fill slots 5-14 in original order
  remaining.sort((a, b) => a.originalSeed - b.originalSeed)
  remaining.forEach((r, i) => {
    r.pickNumber = 5 + i
    r.moved = r.originalSeed !== r.pickNumber
  })

  return [...topPicks, ...remaining].sort((a, b) => a.pickNumber - b.pickNumber)
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

  const positions: DraftProspect['position'][] = ['PG', 'SG', 'SF', 'PF', 'C']

  return Array.from({ length: count }, (_, i) => {
    const quality = 1 - (i / count)
    const trueOverall = Math.round(62 + quality * 28 + (Math.random() - 0.5) * 8)
    const ceiling = Math.min(99, trueOverall + Math.round(Math.random() * 10 + 3))
    const floor = Math.max(55, trueOverall - Math.round(Math.random() * 8 + 2))
    const uncertainty = Math.round(Math.random() * 6 + 2)
    const projectedOverall = trueOverall + Math.round((Math.random() - 0.5) * uncertainty)

    return {
      id: `draft-${seasonYear}-${i + 1}`,
      firstName: firstNames[i % firstNames.length],
      lastName: lastNames[i % lastNames.length],
      position: positions[Math.floor(Math.random() * positions.length)],
      age: 19 + Math.floor(Math.random() * 3),
      school: schools[Math.floor(Math.random() * schools.length)],
      country: Math.random() > 0.8 ? 'International' : 'USA',
      projectedOverall: Math.min(99, Math.max(55, projectedOverall)),
      ceiling,
      floor,
      trueOverall: Math.min(99, Math.max(55, trueOverall)),
      scoutingRevealed: i < 15 ? 3 : i < 30 ? 2 : 1,
    }
  })
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
