import type { Player, Team } from '../types'
import type { SeasonAwards, AwardResult } from '../types'
import {
  scoreMVPCandidate, scoreDPOYCandidate, scoreROYCandidate,
} from './awards/awards-engine'

function topNByScore(
  players: Player[],
  teams: Map<string, Team>,
  season: string,
  scorer: (p: Player, t: Team, s: string) => number,
  n: number,
): string[] {
  return players
    .map(p => {
      const team = teams.get(p.teamId)
      return { id: p.id, score: team ? scorer(p, team, season) : 0 }
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map(x => x.id)
}

/**
 * Assemble the full persisted award slate for a season: media-voted
 * individual awards plus All-NBA / All-Defensive / All-Rookie teams
 * built from objective scoring.
 */
export function buildSeasonAwards(
  results: Record<string, AwardResult>,
  players: Player[],
  teams: Team[],
  seasonYear: number,
  finalsMvp: string | null,
  allStarMvp: string | null,
): SeasonAwards {
  const teamMap = new Map(teams.map(t => [t.id, t]))
  const season = String(seasonYear)

  const allNba = topNByScore(players, teamMap, season, scoreMVPCandidate, 15)
  const allDef = topNByScore(players, teamMap, season, scoreDPOYCandidate, 10)
  const allRookie = topNByScore(players, teamMap, season, scoreROYCandidate, 10)

  return {
    mvp: results.mvp?.winnerId ?? '',
    dpoy: results.dpoy?.winnerId ?? '',
    roty: results.roy?.winnerId ?? '',
    sixthMan: results.sixth_man?.winnerId ?? '',
    mip: results.mip?.winnerId ?? '',
    coty: results.coty?.winnerId ?? '',
    eoty: results.eoty?.winnerId ?? '',
    clutchPoy: results.clutch_poy?.winnerId ?? '',
    allNBA: {
      first: allNba.slice(0, 5),
      second: allNba.slice(5, 10),
      third: allNba.slice(10, 15),
    },
    allDefensive: {
      first: allDef.slice(0, 5),
      second: allDef.slice(5, 10),
    },
    allRookie: {
      first: allRookie.slice(0, 5),
      second: allRookie.slice(5, 10),
    },
    finalsMvp,
    allStarMvp,
  }
}

/**
 * Per-player accolade strings for a season's award slate — appended to
 * player.awards so legacy (voter fatigue, overdue, HoF resumes) builds
 * up over the years.
 */
export function awardStringsForPlayers(
  awards: SeasonAwards,
  seasonYear: number,
  championRosterIds: string[],
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  const add = (playerId: string, label: string) => {
    if (!playerId) return
    const arr = map.get(playerId) ?? []
    arr.push(`${seasonYear} ${label}`)
    map.set(playerId, arr)
  }

  add(awards.mvp, 'MVP')
  add(awards.dpoy, 'Defensive Player of the Year')
  add(awards.roty, 'Rookie of the Year')
  add(awards.sixthMan, 'Sixth Man of the Year')
  add(awards.mip, 'Most Improved Player')
  add(awards.clutchPoy, 'Clutch Player of the Year')
  if (awards.finalsMvp) add(awards.finalsMvp, 'Finals MVP')
  if (awards.allStarMvp) add(awards.allStarMvp, 'All-Star MVP')
  for (const id of awards.allNBA.first) add(id, 'All-NBA First Team')
  for (const id of awards.allNBA.second) add(id, 'All-NBA Second Team')
  for (const id of awards.allNBA.third) add(id, 'All-NBA Third Team')
  for (const id of awards.allDefensive.first) add(id, 'All-Defensive First Team')
  for (const id of awards.allDefensive.second) add(id, 'All-Defensive Second Team')
  for (const id of awards.allRookie.first) add(id, 'All-Rookie First Team')
  for (const id of awards.allRookie.second) add(id, 'All-Rookie Second Team')
  for (const id of championRosterIds) add(id, 'Champion')

  return map
}

/** Aggregate a player's career from their per-season stat lines. */
export function careerTotals(p: Player): Record<string, number> {
  let gp = 0, pts = 0, reb = 0, ast = 0, stl = 0, blk = 0
  let seasons = 0
  for (const s of p.careerStats ?? []) {
    if (s.gp <= 0) continue
    seasons++
    gp += s.gp
    pts += s.ppg * s.gp
    reb += s.rpg * s.gp
    ast += s.apg * s.gp
    stl += (s.spg ?? 0) * s.gp
    blk += (s.bpg ?? 0) * s.gp
  }
  return {
    seasons,
    gamesPlayed: gp,
    points: Math.round(pts),
    rebounds: Math.round(reb),
    assists: Math.round(ast),
    steals: Math.round(stl),
    blocks: Math.round(blk),
    ppg: gp > 0 ? Math.round((pts / gp) * 10) / 10 : 0,
    rpg: gp > 0 ? Math.round((reb / gp) * 10) / 10 : 0,
    apg: gp > 0 ? Math.round((ast / gp) * 10) / 10 : 0,
  }
}

const ACCOLADE_POINTS: [RegExp, number][] = [
  [/(?<!Finals |All-Star )MVP$/, 40],
  [/Finals MVP/, 25],
  [/Defensive Player of the Year/, 15],
  [/All-NBA First Team/, 12],
  [/All-NBA Second Team/, 8],
  [/All-NBA Third Team/, 5],
  [/Champion/, 10],
  [/Rookie of the Year/, 8],
  [/All-Defensive First Team/, 5],
  [/All-Defensive Second Team/, 3],
  [/Sixth Man|Most Improved|Clutch Player|All-Star MVP/, 4],
]

/**
 * Hall of Fame resume score. Roughly: an MVP is near-automatic combined
 * with anything else; sustained All-NBA careers or decorated champions
 * clear the bar; compilers need serious longevity.
 */
export function hallOfFameScore(accolades: string[], career: Record<string, number>): number {
  let score = 0
  for (const accolade of accolades) {
    for (const [pattern, points] of ACCOLADE_POINTS) {
      if (pattern.test(accolade)) {
        score += points
        break
      }
    }
  }
  score += (career.points ?? 0) / 1500
  score += (career.assists ?? 0) / 2500
  score += (career.rebounds ?? 0) / 2500
  return score
}

export const HOF_THRESHOLD = 45
