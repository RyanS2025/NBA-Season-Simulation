import type { Player, Position } from '../types/player'
import type { Team } from '../types'
import type { AllStarRecord, AllStarGameScore } from '../db/league-db'

interface AllStarSelection {
  starters: { east: string[]; west: string[] }
  reserves: { east: string[]; west: string[] }
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

function getLatestStats(player: Player) {
  if (!player.careerStats || player.careerStats.length === 0) return null
  return player.careerStats[player.careerStats.length - 1]
}

function allStarScore(player: Player): number {
  const stats = getLatestStats(player)
  if (!stats || stats.gp < 5) return 0
  return stats.ppg * 1.0 + stats.rpg * 0.8 + stats.apg * 1.2 + stats.spg * 2.0 + stats.bpg * 2.0
}

const POSITION_SLOTS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']

export function selectAllStars(
  players: Player[],
  teams: Team[],
): AllStarSelection {
  const teamConf = new Map<string, 'Eastern' | 'Western'>()
  for (const t of teams) teamConf.set(t.id, t.info.conference)

  const east = players.filter(p => teamConf.get(p.teamId) === 'Eastern')
  const west = players.filter(p => teamConf.get(p.teamId) === 'Western')

  function pickStarters(pool: Player[]): string[] {
    const starters: string[] = []
    const used = new Set<string>()
    for (const pos of POSITION_SLOTS) {
      const candidates = pool
        .filter(p => p.bio.position === pos && !used.has(p.id))
        .sort((a, b) => allStarScore(b) - allStarScore(a))
      if (candidates.length > 0) {
        starters.push(candidates[0].id)
        used.add(candidates[0].id)
      }
    }
    return starters
  }

  function pickReserves(pool: Player[], starterIds: string[], count: number): string[] {
    const starterSet = new Set(starterIds)
    return pool
      .filter(p => !starterSet.has(p.id))
      .sort((a, b) => allStarScore(b) - allStarScore(a))
      .slice(0, count)
      .map(p => p.id)
  }

  const eastStarters = pickStarters(east)
  const westStarters = pickStarters(west)
  const eastReserves = pickReserves(east, eastStarters, 7)
  const westReserves = pickReserves(west, westStarters, 7)

  return {
    starters: { east: eastStarters, west: westStarters },
    reserves: { east: eastReserves, west: westReserves },
  }
}

export function selectAllStarsWithVotes(
  players: Player[],
  teams: Team[],
  userStarters: { east: string[]; west: string[] },
): AllStarSelection {
  const teamConf = new Map<string, 'Eastern' | 'Western'>()
  for (const t of teams) teamConf.set(t.id, t.info.conference)

  const east = players.filter(p => teamConf.get(p.teamId) === 'Eastern')
  const west = players.filter(p => teamConf.get(p.teamId) === 'Western')

  const eastStarterSet = new Set(userStarters.east)
  const westStarterSet = new Set(userStarters.west)

  const eastReserves = east
    .filter(p => !eastStarterSet.has(p.id))
    .sort((a, b) => allStarScore(b) - allStarScore(a))
    .slice(0, 7)
    .map(p => p.id)

  const westReserves = west
    .filter(p => !westStarterSet.has(p.id))
    .sort((a, b) => allStarScore(b) - allStarScore(a))
    .slice(0, 7)
    .map(p => p.id)

  return {
    starters: userStarters,
    reserves: { east: eastReserves, west: westReserves },
  }
}

export interface ContestResults {
  threePointWinnerId: string
  dunkWinnerId: string
  skillsWinnerId: string
}

export function simulateContests(
  selection: AllStarSelection,
  players: Player[],
  seed: number,
): ContestResults {
  const rng = mulberry32(seed)
  const allIds = [
    ...selection.starters.east,
    ...selection.starters.west,
    ...selection.reserves.east,
    ...selection.reserves.west,
  ]

  const playerMap = new Map(players.map(p => [p.id, p]))

  function pickContestWinner(scoreFn: (p: Player) => number): string {
    const candidates = allIds
      .map(id => playerMap.get(id))
      .filter((p): p is Player => !!p)
    let best = candidates[0]
    let bestScore = -Infinity
    for (const p of candidates) {
      const score = scoreFn(p) + rng() * 20
      if (score > bestScore) {
        bestScore = score
        best = p
      }
    }
    return best.id
  }

  const threePointWinnerId = pickContestWinner(p => p.ratings.threePoint)
  const dunkWinnerId = pickContestWinner(p => p.ratings.vertical + p.ratings.speed)
  const skillsWinnerId = pickContestWinner(p => {
    const stats = getLatestStats(p)
    return (p.ratings.passingVision + p.ratings.ballHandling) / 2 + (stats?.apg ?? 0) * 2
  })

  return { threePointWinnerId, dunkWinnerId, skillsWinnerId }
}

export function simulateAllStarGame(
  selection: AllStarSelection,
  players: Player[],
  seed: number,
): AllStarGameScore {
  const rng = mulberry32(seed + 999)
  const playerMap = new Map(players.map(p => [p.id, p]))

  function teamStrength(ids: string[]): number {
    let total = 0
    for (const id of ids) {
      const p = playerMap.get(id)
      if (!p) continue
      const stats = getLatestStats(p)
      total += stats ? stats.ppg + stats.rpg * 0.5 + stats.apg * 0.7 : 15
    }
    return total
  }

  const eastIds = [...selection.starters.east, ...selection.reserves.east]
  const westIds = [...selection.starters.west, ...selection.reserves.west]
  const eastStr = teamStrength(eastIds)
  const westStr = teamStrength(westIds)

  const baseScore = 150
  const eastScore = Math.round(baseScore + (eastStr - westStr) * 0.3 + (rng() - 0.5) * 30)
  const westScore = Math.round(baseScore + (westStr - eastStr) * 0.3 + (rng() - 0.5) * 30)

  const finalEast = Math.max(120, eastScore)
  const finalWest = Math.max(120, westScore === finalEast ? westScore + 1 : westScore)

  const mvpPool = finalEast > finalWest ? eastIds : westIds
  const mvpIdx = Math.floor(rng() * Math.min(5, mvpPool.length))

  return {
    eastScore: finalEast,
    westScore: finalWest,
    mvpId: mvpPool[mvpIdx] ?? null,
  }
}

export function runAllStarWeekend(
  players: Player[],
  teams: Team[],
  seasonYear: number,
  userStarters?: { east: string[]; west: string[] },
): AllStarRecord {
  const selection = userStarters
    ? selectAllStarsWithVotes(players, teams, userStarters)
    : selectAllStars(players, teams)
  const contests = simulateContests(selection, players, seasonYear * 31337)
  const gameScore = simulateAllStarGame(selection, players, seasonYear * 7919)

  return {
    seasonYear,
    starters: selection.starters,
    reserves: selection.reserves,
    gameScore,
    contestWinners: {
      threePoint: contests.threePointWinnerId,
      dunk: contests.dunkWinnerId,
      skills: contests.skillsWinnerId,
    },
  }
}
