import type { Player, SeasonStats } from '../types/player'
import type { TeamInfo } from '../types/team'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawObj = Record<string, any>

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function transformKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(transformKeys)
  if (obj !== null && typeof obj === 'object') {
    const result: RawObj = {}
    for (const [key, value] of Object.entries(obj as RawObj)) {
      result[snakeToCamel(key)] = transformKeys(value)
    }
    return result
  }
  return obj
}

const STATS_KEYS_KEEP_SNAKE = new Set([
  'fg_pct', 'three_pm', 'three_pa', 'three_pct', 'ft_pct',
])

function transformStatsKeys(stats: RawObj[]): SeasonStats[] {
  return stats.map(s => {
    const result: RawObj = {}
    for (const [key, value] of Object.entries(s)) {
      if (STATS_KEYS_KEEP_SNAKE.has(key)) {
        result[key] = value
      } else {
        result[snakeToCamel(key)] = value
      }
    }
    return result as SeasonStats
  })
}

function transformPlayer(raw: RawObj): Player {
  const p = transformKeys(raw) as RawObj
  if (raw.career_stats) {
    p.careerStats = transformStatsKeys(raw.career_stats)
  }
  if (raw.bio?.hand === 'right') p.bio.hand = 'R'
  if (raw.bio?.hand === 'left') p.bio.hand = 'L'
  return p as Player
}

let cachedPlayers: Player[] | null = null

export async function loadPlayers(): Promise<Player[]> {
  if (cachedPlayers) return cachedPlayers
  const resp = await fetch('/data/players_2026_27.json')
  const raw: RawObj[] = await resp.json()
  cachedPlayers = raw.map(transformPlayer)
  return cachedPlayers
}

export function getPlayerById(players: Player[], id: string): Player | undefined {
  return players.find(p => p.id === id)
}

export function getPlayersByTeam(players: Player[], teamId: string): Player[] {
  return players.filter(p => p.teamId === teamId)
}

let cachedTeamMap: Map<string, TeamInfo> | null = null

export async function loadTeamMap(): Promise<Map<string, TeamInfo>> {
  if (cachedTeamMap) return cachedTeamMap
  const resp = await fetch('/data/teams.json')
  const raw: RawObj[] = await resp.json()
  cachedTeamMap = new Map()
  for (const team of raw) {
    const info = transformKeys(team.info) as TeamInfo
    cachedTeamMap.set(team.id, info)
  }
  return cachedTeamMap
}
