import type { Player, Team } from '../../types'
import type {
  Reporter, ActiveNarrative, AwardType,
  AwardRaceCandidate, AwardRaceSnapshot,
} from '../../types'
import {
  scoreMVPCandidate, scoreDPOYCandidate, scoreROYCandidate,
  scoreSixthManCandidate, scoreMIPCandidate, scoreClutchPOYCandidate,
  type CandidateScore,
} from './awards-engine'

type ScorerFn = (p: Player, t: Team) => number

const RACE_SCORERS: Record<string, ScorerFn> = {
  mvp: scoreMVPCandidate,
  dpoy: scoreDPOYCandidate,
  roy: scoreROYCandidate,
  sixth_man: scoreSixthManCandidate,
  mip: scoreMIPCandidate,
  clutch_poy: scoreClutchPOYCandidate,
}

const BALLOT_POINTS = [10, 7, 5, 3, 1]

function projectPoints(
  objectiveRank: number,
  reporterCount: number,
): number {
  if (objectiveRank <= 0 || objectiveRank > 5) return 0
  return BALLOT_POINTS[objectiveRank - 1] * reporterCount * 0.7
}

function determineTrend(
  playerId: string,
  currentScore: number,
  priorSnapshots: AwardRaceSnapshot[],
): 'rising' | 'steady' | 'falling' {
  if (priorSnapshots.length === 0) return 'steady'
  const lastSnapshot = priorSnapshots[priorSnapshots.length - 1]
  const priorCandidate = lastSnapshot.candidates.find(c => c.playerId === playerId)
  if (!priorCandidate) return 'rising'

  const diff = currentScore - priorCandidate.objectiveScore
  if (diff > 2) return 'rising'
  if (diff < -2) return 'falling'
  return 'steady'
}

function getNarrativeBoosts(playerId: string, narratives: ActiveNarrative[]): string[] {
  return narratives
    .filter(n => n.playerId === playerId && n.strength > 0.3)
    .map(n => n.type)
}

function buildRaceSnapshot(
  awardType: AwardType,
  scorer: ScorerFn,
  players: Player[],
  teams: Team[],
  reporters: Reporter[],
  narratives: ActiveNarrative[],
  priorSnapshots: AwardRaceSnapshot[],
  week: number,
): AwardRaceSnapshot {
  const teamMap = new Map(teams.map(t => [t.id, t]))

  const scored: CandidateScore[] = []
  for (const p of players) {
    const team = teamMap.get(p.teamId)
    if (!team) continue
    const score = scorer(p, team)
    if (score > 0) scored.push({ playerId: p.id, objectiveScore: score, teamWinPct: 0 })
  }

  scored.sort((a, b) => b.objectiveScore - a.objectiveScore)

  const priorForThisAward = priorSnapshots.filter(s => s.awardType === awardType)

  const candidates: AwardRaceCandidate[] = scored.slice(0, 10).map((s, i) => ({
    playerId: s.playerId,
    objectiveScore: s.objectiveScore,
    projectedPoints: projectPoints(i + 1, reporters.length),
    projectedFirstPlace: i === 0 ? reporters.length * 0.6 : i === 1 ? reporters.length * 0.2 : 0,
    trendDirection: determineTrend(s.playerId, s.objectiveScore, priorForThisAward),
    narrativeBoosts: getNarrativeBoosts(s.playerId, narratives),
  }))

  return { awardType, week, candidates }
}

export function generateWeeklySnapshots(
  players: Player[],
  teams: Team[],
  reporters: Reporter[],
  narratives: ActiveNarrative[],
  priorSnapshots: AwardRaceSnapshot[],
  currentWeek: number,
): AwardRaceSnapshot[] {
  const snapshots: AwardRaceSnapshot[] = []

  for (const [awardType, scorer] of Object.entries(RACE_SCORERS)) {
    snapshots.push(
      buildRaceSnapshot(
        awardType as AwardType, scorer, players, teams, reporters,
        narratives, priorSnapshots, currentWeek,
      ),
    )
  }

  return snapshots
}
