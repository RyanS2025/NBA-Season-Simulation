import type { Player, Team } from '../../types'
import type { ActiveNarrative, NarrativeType } from '../../types'
import { v4 as uuid } from 'uuid'

interface NarrativeContext {
  currentWeek: number
  currentSeason: number
}

function getCurrentStats(p: Player, season: number) {
  return p.careerStats?.find(s => s.season === String(season)) ?? null
}

function getPriorStats(p: Player, season: number) {
  if (!p.careerStats) return null
  const idx = p.careerStats.findIndex(s => s.season === String(season))
  if (idx > 0) return p.careerStats[idx - 1]
  return null
}

function makeNarrative(
  playerId: string, type: NarrativeType, strength: number,
  week: number, description: string,
): ActiveNarrative {
  return { id: uuid(), playerId, type, strength: Math.min(1, Math.max(0, strength)), startWeek: week, description }
}

function checkComeback(p: Player, ctx: NarrativeContext): ActiveNarrative | null {
  if (p.status.health !== 'healthy') return null
  if (!p.status.currentInjury && p.durability.injuryHistory && p.durability.injuryHistory.length > 0) {
    const stats = getCurrentStats(p, ctx.currentSeason)
    if (stats && stats.ppg >= 15 && stats.gp >= 10) {
      return makeNarrative(
        p.id, 'comeback', 0.6 + (stats.ppg - 15) * 0.02, ctx.currentWeek,
        `${p.bio.firstName} ${p.bio.lastName} is back and performing at a high level after injury`,
      )
    }
  }
  return null
}

function checkOverdue(p: Player, _ctx: NarrativeContext): ActiveNarrative | null {
  const allNbaCount = p.awards.filter(a => a.includes('All-NBA') || a.includes('all_nba')).length
  const mvpCount = p.awards.filter(a => a.includes('MVP') || a.includes('mvp')).length
  if (allNbaCount >= 3 && mvpCount === 0) {
    const stats = getCurrentStats(p, _ctx.currentSeason)
    if (stats && stats.ppg >= 20) {
      return makeNarrative(
        p.id, 'overdue', 0.5 + allNbaCount * 0.08, _ctx.currentWeek,
        `${p.bio.firstName} ${p.bio.lastName} has ${allNbaCount} All-NBA selections but no MVP — is this the year?`,
      )
    }
  }
  return null
}

function checkBreakout(p: Player, ctx: NarrativeContext): ActiveNarrative | null {
  if (p.bio.age > 25) return null
  const stats = getCurrentStats(p, ctx.currentSeason)
  const prior = getPriorStats(p, ctx.currentSeason)
  if (!stats || stats.gp < 10) return null

  if (prior) {
    const ppgJump = stats.ppg - prior.ppg
    if (ppgJump >= 6) {
      return makeNarrative(
        p.id, 'breakout', 0.5 + ppgJump * 0.04, ctx.currentWeek,
        `${p.bio.firstName} ${p.bio.lastName} is having a breakout season, averaging ${stats.ppg.toFixed(1)} PPG (up from ${prior.ppg.toFixed(1)})`,
      )
    }
  } else if (stats.ppg >= 18 && p.bio.yearsInLeague <= 2) {
    return makeNarrative(
      p.id, 'breakout', 0.6, ctx.currentWeek,
      `Sophomore ${p.bio.firstName} ${p.bio.lastName} is emerging as a star, averaging ${stats.ppg.toFixed(1)} PPG`,
    )
  }
  return null
}

function checkLegacy(p: Player, ctx: NarrativeContext): ActiveNarrative | null {
  if (p.bio.age < 35) return null
  const totalAwards = p.awards.length
  if (totalAwards < 3) return null
  const stats = getCurrentStats(p, ctx.currentSeason)
  if (stats && stats.ppg >= 15) {
    return makeNarrative(
      p.id, 'legacy', 0.4 + totalAwards * 0.05, ctx.currentWeek,
      `${p.bio.firstName} ${p.bio.lastName} continues to defy age at ${p.bio.age}, still contributing at a high level`,
    )
  }
  return null
}

function checkVoterFatigue(p: Player, ctx: NarrativeContext): ActiveNarrative | null {
  const recentMvps = p.awards.filter(a => {
    const isMvp = a.includes('MVP') || a.includes('mvp')
    return isMvp && !a.includes('Finals')
  }).length

  if (recentMvps >= 2) {
    return makeNarrative(
      p.id, 'voter_fatigue', 0.3 + recentMvps * 0.1, ctx.currentWeek,
      `Voters may be looking for a fresh face — ${p.bio.firstName} ${p.bio.lastName} has won ${recentMvps} MVPs`,
    )
  }
  return null
}

function checkUnderdogTeam(p: Player, team: Team, ctx: NarrativeContext): ActiveNarrative | null {
  if (team.info.marketSize > 5) return null
  const stats = getCurrentStats(p, ctx.currentSeason)
  if (!stats || stats.ppg < 22) return null
  const totalGames = team.seasonRecord.wins + team.seasonRecord.losses
  const winPct = totalGames > 0 ? team.seasonRecord.wins / totalGames : 0
  if (winPct >= 0.55) {
    return makeNarrative(
      p.id, 'underdog_team', 0.5, ctx.currentWeek,
      `${p.bio.firstName} ${p.bio.lastName} is carrying small-market ${team.info.city} to a strong record`,
    )
  }
  return null
}

export function updateNarratives(
  players: Player[],
  teams: Team[],
  existingNarratives: ActiveNarrative[],
  currentWeek: number,
  currentSeason: number,
): ActiveNarrative[] {
  const ctx: NarrativeContext = { currentWeek, currentSeason }
  const teamMap = new Map(teams.map(t => [t.id, t]))
  const existingByPlayer = new Map<string, Set<NarrativeType>>()

  for (const n of existingNarratives) {
    if (!existingByPlayer.has(n.playerId)) existingByPlayer.set(n.playerId, new Set())
    existingByPlayer.get(n.playerId)!.add(n.type)
  }

  const updated = existingNarratives.map(n => {
    const weeksActive = currentWeek - n.startWeek
    const decay = weeksActive > 10 ? 0.97 : 1.0
    return { ...n, strength: n.strength * decay }
  }).filter(n => n.strength > 0.1)

  const checkers: Array<(p: Player, team: Team) => ActiveNarrative | null> = [
    (p) => checkComeback(p, ctx),
    (p) => checkOverdue(p, ctx),
    (p) => checkBreakout(p, ctx),
    (p) => checkLegacy(p, ctx),
    (p) => checkVoterFatigue(p, ctx),
    (p, t) => checkUnderdogTeam(p, t, ctx),
  ]

  for (const player of players) {
    const team = teamMap.get(player.teamId)
    if (!team) continue
    const existing = existingByPlayer.get(player.id) ?? new Set()

    for (const checker of checkers) {
      const narrative = checker(player, team)
      if (narrative && !existing.has(narrative.type)) {
        updated.push(narrative)
        existing.add(narrative.type)
      }
    }
  }

  return updated
}
