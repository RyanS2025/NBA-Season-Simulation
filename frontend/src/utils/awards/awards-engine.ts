import type { Player, Team } from '../../types'
import type {
  Reporter, ActiveNarrative, AwardType, AwardBallot, BallotPick,
  AwardResult, ControversialVote,
} from '../../types'

// ── Seeded PRNG ─────────────────────────────────────────────────

function mulberry32(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Stats Access ────────────────────────────────────────────────

/**
 * Stats for the CURRENT sim season only. Falling back to the last
 * careerStats entry is a bug: players who haven't logged a game this
 * season would be judged on stale data from a prior season (or their
 * imported real-NBA history).
 */
function getSeasonStats(p: Player, season: string) {
  return p.careerStats?.find(s => s.season === season) ?? null
}

function getPriorSeasonStats(p: Player, season: string) {
  if (!p.careerStats) return null
  const idx = p.careerStats.findIndex(s => s.season === season)
  if (idx > 0) return p.careerStats[idx - 1]
  return null
}

/** Games-played floor that scales up as the season progresses. */
function minGp(team: Team, cap: number): number {
  const teamGames = team.seasonRecord.wins + team.seasonRecord.losses
  return Math.min(cap, Math.max(3, Math.floor(teamGames * 0.5)))
}

// ── Objective Scoring (no bias) ─────────────────────────────────

const BALLOT_POINTS = [10, 7, 5, 3, 1]

export interface CandidateScore {
  playerId: string
  objectiveScore: number
  teamWinPct: number
}

function teamWinPct(team: Team): number {
  const total = team.seasonRecord.wins + team.seasonRecord.losses
  return total > 0 ? team.seasonRecord.wins / total : 0.5
}

export function scoreMVPCandidate(p: Player, team: Team, season: string): number {
  const s = getSeasonStats(p, season)
  if (!s || s.gp < minGp(team, 20)) return 0
  const winPct = teamWinPct(team)
  return (
    s.ppg * 1.5 + s.apg * 1.2 + s.rpg * 0.8 +
    s.spg * 3.0 + s.bpg * 2.5 -
    s.topg * 1.5 +
    (s.fg_pct ?? 0) * 15 + (s.three_pct ?? 0) * 10 +
    winPct * 30 +
    s.mpg * 0.1
  )
}

export function scoreDPOYCandidate(p: Player, team: Team, season: string): number {
  const s = getSeasonStats(p, season)
  if (!s || s.gp < minGp(team, 20)) return 0
  const r = p.ratings
  const winPct = teamWinPct(team)
  return (
    r.perimeterDefense * 0.3 + r.interiorDefense * 0.3 +
    r.shotBlocking * 0.25 + r.stealing * 0.25 +
    r.defensiveIq * 0.2 + r.defensiveConsistency * 0.15 +
    s.bpg * 15 + s.spg * 12 + s.rpg * 2 +
    winPct * 15
  )
}

export function scoreROYCandidate(p: Player, team: Team, season: string): number {
  if (!p.status.isRookie && p.bio.yearsInLeague > 1) return 0
  const s = getSeasonStats(p, season)
  if (!s || s.gp < minGp(team, 15)) return 0
  return s.ppg * 1.5 + s.rpg * 1.0 + s.apg * 1.2 + s.spg * 2.5 + s.bpg * 2.5 - s.topg * 1.0
}

export function scoreSixthManCandidate(p: Player, team: Team, season: string): number {
  const s = getSeasonStats(p, season)
  if (!s || s.gp < minGp(team, 15)) return 0
  if (s.gs > s.gp * 0.5) return 0
  return s.ppg * 1.5 + s.rpg * 0.8 + s.apg * 1.0 + s.spg * 2.0 + s.bpg * 2.0 + (s.fg_pct ?? 0) * 10
}

export function scoreMIPCandidate(p: Player, team: Team, season: string): number {
  const s = getSeasonStats(p, season)
  const prior = getPriorSeasonStats(p, season)
  if (!s || s.gp < minGp(team, 20) || !prior || prior.gp < 20) return 0
  const ppgJump = s.ppg - prior.ppg
  const rpgJump = s.rpg - prior.rpg
  const apgJump = s.apg - prior.apg
  if (ppgJump < 2) return 0
  return ppgJump * 3 + rpgJump * 1.5 + apgJump * 1.5 + s.ppg * 0.5
}

export function scoreClutchPOYCandidate(p: Player, team: Team, season: string): number {
  const s = getSeasonStats(p, season)
  if (!s || s.gp < minGp(team, 20)) return 0
  const clutch = p.character.clutch
  const winPct = teamWinPct(team)
  return s.ppg * 1.0 + clutch * 0.4 + (s.ft_pct ?? 0) * 15 + winPct * 20
}

export function scoreCOTYCandidate(team: Team): number {
  const winPct = teamWinPct(team)
  const totalGames = team.seasonRecord.wins + team.seasonRecord.losses
  if (totalGames < 20) return 0
  const overperformance = winPct - 0.5
  return overperformance * 100 + winPct * 50
}

export function scoreEOTYCandidate(team: Team): number {
  const winPct = teamWinPct(team)
  const totalGames = team.seasonRecord.wins + team.seasonRecord.losses
  if (totalGames < 20) return 0
  return winPct * 40 + (team.info.marketSize <= 5 ? 10 : 0)
}

type ScorerFn = (p: Player, t: Team, season: string) => number

const PLAYER_SCORERS: Record<string, ScorerFn> = {
  mvp: scoreMVPCandidate,
  dpoy: scoreDPOYCandidate,
  roy: scoreROYCandidate,
  sixth_man: scoreSixthManCandidate,
  mip: scoreMIPCandidate,
  clutch_poy: scoreClutchPOYCandidate,
}

// ── Bias Application ────────────────────────────────────────────

function applyReporterBias(
  objectiveScore: number,
  objectiveRank: number,
  candidatePlayer: Player,
  candidateTeam: Team,
  reporter: Reporter,
  narratives: ActiveNarrative[],
  rng: () => number,
): number {
  let score = objectiveScore
  const personality = reporter.personality

  const playerNarratives = narratives.filter(n => n.playerId === candidatePlayer.id)
  for (const n of playerNarratives) {
    if (n.type === 'voter_fatigue') {
      score -= n.strength * personality.narrativeWeight * 8
    } else {
      score += n.strength * personality.narrativeWeight * 5
    }
  }

  if (candidateTeam.info.marketSize >= 7) {
    score += personality.bigMarketBias * 5
  }

  score += candidatePlayer.character.mediaPersonality * personality.mediaPersonalityBonus * 0.3

  if (candidatePlayer.awards.length >= 3) {
    score += personality.nameRecognitionBias * 4
  }

  if (reporter.type === 'beat_writer' && reporter.beatTeamId === candidateTeam.id) {
    const qualityGate = Math.max(0, (15 - objectiveRank) / 15)
    score += personality.teamBias * qualityGate * 15
  }

  score += (rng() - 0.5) * 3

  return score
}

// ── Ballot Generation ───────────────────────────────────────────

function generateBallot(
  reporter: Reporter,
  candidates: CandidateScore[],
  players: Map<string, Player>,
  teams: Map<string, Team>,
  narratives: ActiveNarrative[],
): AwardBallot {
  const rng = mulberry32(reporter.seed + candidates.length)

  const scored = candidates.map((c, idx) => {
    const player = players.get(c.playerId)
    const team = player ? teams.get(player.teamId) : undefined
    if (!player || !team) return { ...c, biasedScore: c.objectiveScore, rank: idx }

    return {
      ...c,
      biasedScore: applyReporterBias(
        c.objectiveScore, idx + 1, player, team, reporter, narratives, rng,
      ),
      rank: idx,
    }
  })

  scored.sort((a, b) => b.biasedScore - a.biasedScore)

  const picks: BallotPick[] = scored.slice(0, 5).map((s, i) => {
    const objectiveIdx = candidates.findIndex(c => c.playerId === s.playerId)
    const isHomerPick = reporter.type === 'beat_writer' && (() => {
      const player = players.get(s.playerId)
      return player?.teamId === reporter.beatTeamId && (i + 1) < objectiveIdx + 1
    })()
    const biasInflation = Math.max(0, objectiveIdx - i)

    return {
      candidateId: s.playerId,
      rank: i + 1,
      points: BALLOT_POINTS[i],
      isHomerPick: !!isHomerPick,
      biasInflation,
    }
  })

  return {
    reporterId: reporter.id,
    reporterName: `${reporter.firstName} ${reporter.lastName}`,
    reporterOutlet: reporter.outlet,
    reporterType: reporter.type,
    beatTeamId: reporter.beatTeamId,
    picks,
  }
}

// ── Controversial Vote Detection ────────────────────────────────

function detectControversialVotes(
  ballots: AwardBallot[],
  candidates: CandidateScore[],
  players: Map<string, Player>,
  reporters: Reporter[],
): ControversialVote[] {
  const controversial: ControversialVote[] = []
  const reporterMap = new Map(reporters.map(r => [r.id, r]))
  const candidateRankMap = new Map(candidates.map((c, i) => [c.playerId, i + 1]))

  for (const ballot of ballots) {
    const reporter = reporterMap.get(ballot.reporterId)
    if (!reporter) continue

    for (const pick of ballot.picks) {
      const objectiveRank = candidateRankMap.get(pick.candidateId) ?? 999
      const player = players.get(pick.candidateId)
      if (!player) continue
      const playerName = `${player.bio.firstName} ${player.bio.lastName}`

      if (reporter.type === 'beat_writer' && player.teamId === reporter.beatTeamId) {
        if (pick.rank + 3 <= objectiveRank) {
          controversial.push({
            reporterId: reporter.id,
            reporterName: `${reporter.firstName} ${reporter.lastName}`,
            outlet: reporter.outlet,
            candidateId: pick.candidateId,
            candidateName: playerName,
            rank: pick.rank,
            objectiveRank,
            reason: `Homer pick: beat writer ranked ${playerName} #${pick.rank} (objective #${objectiveRank})`,
          })
        }
      }

      if (pick.rank === 1 && objectiveRank > 3) {
        controversial.push({
          reporterId: reporter.id,
          reporterName: `${reporter.firstName} ${reporter.lastName}`,
          outlet: reporter.outlet,
          candidateId: pick.candidateId,
          candidateName: playerName,
          rank: 1,
          objectiveRank,
          reason: `Sole 1st-place vote for ${playerName} who ranked #${objectiveRank} objectively`,
        })
      }
    }
  }

  return controversial
}

// ── Full Award Computation ──────────────────────────────────────

function computePlayerAward(
  awardType: AwardType,
  scorer: ScorerFn,
  allPlayers: Player[],
  allTeams: Team[],
  reporters: Reporter[],
  narratives: ActiveNarrative[],
  season: string,
): AwardResult {
  const teamMap = new Map(allTeams.map(t => [t.id, t]))
  const playerMap = new Map(allPlayers.map(p => [p.id, p]))

  const candidates: CandidateScore[] = []
  for (const p of allPlayers) {
    const team = teamMap.get(p.teamId)
    if (!team) continue
    const score = scorer(p, team, season)
    if (score > 0) candidates.push({ playerId: p.id, objectiveScore: score, teamWinPct: teamWinPct(team) })
  }

  candidates.sort((a, b) => b.objectiveScore - a.objectiveScore)
  const topCandidates = candidates.slice(0, 15)

  const ballots = reporters.map(r => generateBallot(r, topCandidates, playerMap, teamMap, narratives))

  const voteTotals: Record<string, number> = {}
  const firstPlaceVotes: Record<string, number> = {}
  for (const ballot of ballots) {
    for (const pick of ballot.picks) {
      voteTotals[pick.candidateId] = (voteTotals[pick.candidateId] ?? 0) + pick.points
      if (pick.rank === 1) {
        firstPlaceVotes[pick.candidateId] = (firstPlaceVotes[pick.candidateId] ?? 0) + 1
      }
    }
  }

  const sortedCandidates = Object.entries(voteTotals).sort((a, b) => b[1] - a[1])
  const winnerId = sortedCandidates[0]?.[0] ?? ''
  const winnerPoints = sortedCandidates[0]?.[1] ?? 0
  const runnerUpPoints = sortedCandidates[1]?.[1] ?? 0

  const controversialVotes = detectControversialVotes(ballots, topCandidates, playerMap, reporters)

  return {
    awardType,
    winnerId,
    voteTotals,
    firstPlaceVotes,
    maxPossiblePoints: reporters.length * BALLOT_POINTS[0],
    ballots,
    controversialVotes,
    marginOfVictory: winnerPoints - runnerUpPoints,
    wasUnanimous: (firstPlaceVotes[winnerId] ?? 0) === reporters.length,
  }
}

function computeTeamAward(
  awardType: AwardType,
  scorer: (team: Team) => number,
  allTeams: Team[],
  reporters: Reporter[],
  narratives: ActiveNarrative[],
  playerMap: Map<string, Player>,
): AwardResult {
  const teamMap = new Map(allTeams.map(t => [t.id, t]))

  const candidates: CandidateScore[] = allTeams
    .map(t => ({ playerId: t.id, objectiveScore: scorer(t), teamWinPct: teamWinPct(t) }))
    .filter(c => c.objectiveScore > 0)
    .sort((a, b) => b.objectiveScore - a.objectiveScore)
    .slice(0, 10)

  const ballots = reporters.map(r => generateBallot(r, candidates, playerMap, teamMap, narratives))

  const voteTotals: Record<string, number> = {}
  const firstPlaceVotes: Record<string, number> = {}
  for (const ballot of ballots) {
    for (const pick of ballot.picks) {
      voteTotals[pick.candidateId] = (voteTotals[pick.candidateId] ?? 0) + pick.points
      if (pick.rank === 1) {
        firstPlaceVotes[pick.candidateId] = (firstPlaceVotes[pick.candidateId] ?? 0) + 1
      }
    }
  }

  const sorted = Object.entries(voteTotals).sort((a, b) => b[1] - a[1])
  const winnerId = sorted[0]?.[0] ?? ''
  const winnerPoints = sorted[0]?.[1] ?? 0
  const runnerUpPoints = sorted[1]?.[1] ?? 0

  return {
    awardType,
    winnerId,
    voteTotals,
    firstPlaceVotes,
    maxPossiblePoints: reporters.length * BALLOT_POINTS[0],
    ballots,
    controversialVotes: [],
    marginOfVictory: winnerPoints - runnerUpPoints,
    wasUnanimous: (firstPlaceVotes[winnerId] ?? 0) === reporters.length,
  }
}

export function computeAllAwards(
  allPlayers: Player[],
  allTeams: Team[],
  reporters: Reporter[],
  narratives: ActiveNarrative[],
  seasonYear: number,
): Record<string, AwardResult> {
  const results: Record<string, AwardResult> = {}
  const playerMap = new Map(allPlayers.map(p => [p.id, p]))
  const season = String(seasonYear)

  for (const [awardType, scorer] of Object.entries(PLAYER_SCORERS)) {
    results[awardType] = computePlayerAward(
      awardType as AwardType, scorer, allPlayers, allTeams, reporters, narratives, season,
    )
  }

  results.coty = computeTeamAward('coty', scoreCOTYCandidate, allTeams, reporters, narratives, playerMap)
  results.eoty = computeTeamAward('eoty', scoreEOTYCandidate, allTeams, reporters, narratives, playerMap)

  return results
}
