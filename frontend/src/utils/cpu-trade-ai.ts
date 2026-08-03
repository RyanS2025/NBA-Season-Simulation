import type { Player, Team, DraftPickAsset, Position, TeamPersonality, TeamArchetype } from '../types'
import { calculatePlayerValue, calculatePickValue, type TradeContext, type PlayerValuation } from './trade-value-engine'

// ── Strategy Types ──────────────────────────────────────────────

export type TeamStrategy = 'contending' | 'playoff' | 'retooling' | 'rebuilding'

export interface RosterNeed {
  position: Position
  skillGap: 'shooting' | 'rim_protection' | 'playmaking' | 'rebounding' | 'defense' | 'scoring' | 'general'
  urgency: number
}

export interface TradeEvaluation {
  verdict: 'strong_accept' | 'accept' | 'borderline' | 'reject' | 'strong_reject'
  valueDiff: number
  reasoning: string
}

export interface TradeProposal {
  team1Id: string
  team2Id: string
  team1Players: string[]
  team2Players: string[]
  team1Picks: DraftPickAsset[]
  team2Picks: DraftPickAsset[]
  headline: string
  isBreaking: boolean
}

export interface BackgroundTradeResult {
  proposal: TradeProposal
  headline: string
  isBreaking: boolean
}

// ── Strategy Derivation ─────────────────────────────────────────

export function getTeamStrategy(team: Team, teamPlayers: Player[]): TeamStrategy {
  const record = team.seasonRecord
  const totalGames = record.wins + record.losses
  const winPct = totalGames > 0 ? record.wins / totalGames : 0.5

  const avgOverall = teamPlayers.length > 0
    ? teamPlayers.reduce((s, p) => s + p.ratings.overall, 0) / teamPlayers.length
    : 70

  const personality = team.teamPersonality
  const patienceModifier = personality ? (personality.ownerPatience - 50) * 0.005 : 0

  if (winPct >= 0.6 + patienceModifier && avgOverall >= 77) return 'contending'
  if (winPct >= 0.45 + patienceModifier && avgOverall >= 73) return 'playoff'
  if (winPct >= 0.35 && avgOverall >= 70) return 'retooling'
  return 'rebuilding'
}

// ── Roster Needs ────────────────────────────────────────────────

export function identifyNeeds(team: Team, teamPlayers: Player[]): RosterNeed[] {
  const strategy = getTeamStrategy(team, teamPlayers)
  const needs: RosterNeed[] = []
  const posCounts: Record<Position, number> = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 }

  for (const p of teamPlayers) {
    posCounts[p.bio.position]++
  }

  const isContending = strategy === 'contending' || strategy === 'playoff'

  for (const [pos, count] of Object.entries(posCounts) as [Position, number][]) {
    if (count <= 1) {
      needs.push({ position: pos, skillGap: 'general', urgency: isContending ? 9 : 6 })
    } else if (count === 2) {
      needs.push({ position: pos, skillGap: 'general', urgency: isContending ? 5 : 3 })
    }
  }

  const avgThree = teamPlayers.length > 0
    ? teamPlayers.reduce((s, p) => s + p.ratings.threePoint, 0) / teamPlayers.length
    : 50
  if (avgThree < 55) {
    needs.push({ position: 'SG', skillGap: 'shooting', urgency: isContending ? 8 : 5 })
  }

  const avgInterior = teamPlayers.length > 0
    ? teamPlayers.reduce((s, p) => s + p.ratings.interiorDefense, 0) / teamPlayers.length
    : 50
  if (avgInterior < 50) {
    needs.push({ position: 'C', skillGap: 'rim_protection', urgency: isContending ? 8 : 4 })
  }

  const avgPassing = teamPlayers.length > 0
    ? teamPlayers.reduce((s, p) => s + p.ratings.passingVision, 0) / teamPlayers.length
    : 50
  if (avgPassing < 50) {
    needs.push({ position: 'PG', skillGap: 'playmaking', urgency: isContending ? 7 : 4 })
  }

  needs.sort((a, b) => b.urgency - a.urgency)
  return needs
}

// ── Personality Modifiers ───────────────────────────────────────

function getPersonalityMultipliers(
  personality: TeamPersonality | null,
  _strategy: TeamStrategy,
) {
  if (!personality) return { provenPlayerMult: 1, pickMult: 1, veteranMult: 1, noiseFactor: 0.15 }

  const archetype = personality.primaryArchetype

  const baseMultipliers: Record<TeamArchetype, { provenPlayerMult: number; pickMult: number; veteranMult: number }> = {
    winNow:          { provenPlayerMult: 1.15, pickMult: 0.85, veteranMult: 1.10 },
    rebuilding:      { provenPlayerMult: 0.85, pickMult: 1.20, veteranMult: 0.80 },
    developmental:   { provenPlayerMult: 0.95, pickMult: 1.10, veteranMult: 0.90 },
    analyticsDriven: { provenPlayerMult: 1.05, pickMult: 1.05, veteranMult: 0.95 },
    oldSchool:       { provenPlayerMult: 1.05, pickMult: 0.95, veteranMult: 1.10 },
    bigMarketSpender:{ provenPlayerMult: 1.15, pickMult: 0.90, veteranMult: 1.05 },
    smallMarketSaver:{ provenPlayerMult: 0.90, pickMult: 1.10, veteranMult: 0.90 },
  }

  const mults = baseMultipliers[archetype]
  const noiseFactor = 0.10 + (100 - personality.aggressiveness) * 0.001

  return { ...mults, noiseFactor }
}

// ── Trade Evaluation ────────────────────────────────────────────

export function evaluateTradeOffer(
  incomingPlayers: Player[],
  outgoingPlayers: Player[],
  incomingPicks: DraftPickAsset[],
  outgoingPicks: DraftPickAsset[],
  evaluatingTeam: Team,
  allPlayers: Player[],
  allTeams: Team[],
  currentSeason: number,
  currentDate: string,
): TradeEvaluation {
  const teamPlayers = allPlayers.filter(p => p.teamId === evaluatingTeam.id)
  const strategy = getTeamStrategy(evaluatingTeam, teamPlayers)
  const personality = evaluatingTeam.teamPersonality
  const mults = getPersonalityMultipliers(personality, strategy)

  const ctx: TradeContext = {
    evaluatingTeam,
    evaluatingTeamPlayers: teamPlayers,
    allPlayers,
    currentSeason,
    currentDate,
  }

  let incomingValue = 0
  for (const p of incomingPlayers) {
    const val = calculatePlayerValue(p, ctx)
    let adjusted = val.rawValue
    if (p.bio.age >= 30) adjusted *= mults.veteranMult
    if (val.stars >= 3.5) adjusted *= mults.provenPlayerMult
    incomingValue += adjusted
  }
  for (const pk of incomingPicks) {
    const val = calculatePickValue(pk, { ...ctx, allTeams })
    incomingValue += val.rawValue * mults.pickMult
  }

  let outgoingValue = 0
  for (const p of outgoingPlayers) {
    const val = calculatePlayerValue(p, ctx)
    outgoingValue += val.rawValue
  }
  for (const pk of outgoingPicks) {
    const val = calculatePickValue(pk, { ...ctx, allTeams })
    outgoingValue += val.rawValue
  }

  const noise = (Math.random() - 0.5) * 2 * mults.noiseFactor * outgoingValue
  const valueDiff = incomingValue - outgoingValue + noise

  const needs = identifyNeeds(evaluatingTeam, teamPlayers)
  const topNeedPositions = new Set(needs.slice(0, 3).map(n => n.position))
  const fillsNeed = incomingPlayers.some(p => topNeedPositions.has(p.bio.position))
  const needBonus = fillsNeed ? outgoingValue * 0.08 : 0

  const adjustedDiff = valueDiff + needBonus

  if (adjustedDiff > outgoingValue * 0.15) {
    return { verdict: 'strong_accept', valueDiff: adjustedDiff, reasoning: 'Great value — acquiring significantly more than giving up' }
  }
  if (adjustedDiff > outgoingValue * 0.02) {
    return { verdict: 'accept', valueDiff: adjustedDiff, reasoning: fillsNeed ? 'Fair trade that fills a roster need' : 'Slightly favorable value' }
  }
  if (adjustedDiff > -outgoingValue * 0.08) {
    return { verdict: 'borderline', valueDiff: adjustedDiff, reasoning: 'Close to fair — might counter' }
  }
  if (adjustedDiff > -outgoingValue * 0.25) {
    return { verdict: 'reject', valueDiff: adjustedDiff, reasoning: 'Not enough value coming back' }
  }
  return { verdict: 'strong_reject', valueDiff: adjustedDiff, reasoning: 'Significantly lopsided — would never accept' }
}

// ── Counter-Offer Generation ────────────────────────────────────

export interface CounterOffer {
  addPlayers: string[]
  addPicks: DraftPickAsset[]
  removePlayers: string[]
  message: string
}

export function generateCounterOffer(
  incomingPlayers: Player[],
  outgoingPlayers: Player[],
  incomingPicks: DraftPickAsset[],
  outgoingPicks: DraftPickAsset[],
  evaluatingTeam: Team,
  proposingTeam: Team,
  allPlayers: Player[],
  allTeams: Team[],
  currentSeason: number,
  currentDate: string,
): CounterOffer | null {
  const evaluation = evaluateTradeOffer(
    incomingPlayers, outgoingPlayers, incomingPicks, outgoingPicks,
    evaluatingTeam, allPlayers, allTeams, currentSeason, currentDate,
  )

  if (evaluation.verdict === 'strong_reject') return null
  if (evaluation.verdict === 'strong_accept' || evaluation.verdict === 'accept') return null

  const deficit = Math.abs(evaluation.valueDiff)
  const proposingPlayers = allPlayers
    .filter(p => p.teamId === proposingTeam.id && !incomingPlayers.some(ip => ip.id === p.id))
    .sort((a, b) => b.ratings.overall - a.ratings.overall)

  const ctx: TradeContext = {
    evaluatingTeam,
    evaluatingTeamPlayers: allPlayers.filter(p => p.teamId === evaluatingTeam.id),
    allPlayers,
    currentSeason,
    currentDate,
  }

  for (const candidate of proposingPlayers) {
    const val = calculatePlayerValue(candidate, ctx)
    if (val.rawValue >= deficit * 0.5 && val.rawValue <= deficit * 2.0) {
      return {
        addPlayers: [candidate.id],
        addPicks: [],
        removePlayers: [],
        message: `We'd need ${candidate.bio.firstName} ${candidate.bio.lastName} included to make this work`,
      }
    }
  }

  return {
    addPlayers: [],
    addPicks: [],
    removePlayers: [],
    message: `We don't see a path to a deal here — the value gap is too wide`,
  }
}

// ── CPU Trade Proposal Generation ───────────────────────────────

export function generateCPUTradeProposal(
  team: Team,
  allTeams: Team[],
  allPlayers: Player[],
  _allPicks: DraftPickAsset[],
  currentSeason: number,
  currentDate: string,
): TradeProposal | null {
  const teamPlayers = allPlayers.filter(p => p.teamId === team.id)
  const needs = identifyNeeds(team, teamPlayers)

  if (needs.length === 0) return null

  const topNeed = needs[0]

  const ctx: TradeContext = {
    evaluatingTeam: team,
    evaluatingTeamPlayers: teamPlayers,
    allPlayers,
    currentSeason,
    currentDate,
  }

  const targets: { player: Player; value: PlayerValuation; teamId: string }[] = []
  for (const t of allTeams) {
    if (t.id === team.id) continue
    const tPlayers = allPlayers.filter(p => p.teamId === t.id)
    for (const p of tPlayers) {
      if (p.bio.position !== topNeed.position) continue
      const val = calculatePlayerValue(p, ctx)
      if (val.stars >= 2.0 && val.stars <= 4.0) {
        targets.push({ player: p, value: val, teamId: t.id })
      }
    }
  }

  if (targets.length === 0) return null

  targets.sort((a, b) => b.value.rawValue - a.value.rawValue)
  const target = targets[Math.floor(Math.random() * Math.min(3, targets.length))]

  const expendable = teamPlayers
    .filter(p => {
      const val = calculatePlayerValue(p, ctx)
      return val.stars <= 2.5 && p.bio.position !== topNeed.position
    })
    .sort((a, b) => {
      const aVal = calculatePlayerValue(a, ctx).rawValue
      const bVal = calculatePlayerValue(b, ctx).rawValue
      return bVal - aVal
    })

  if (expendable.length === 0) return null

  const packagePlayers: Player[] = []
  let packageValue = 0

  for (const p of expendable) {
    if (packagePlayers.length >= 3) break
    const val = calculatePlayerValue(p, ctx)
    packagePlayers.push(p)
    packageValue += val.rawValue
    if (packageValue >= target.value.rawValue * 0.85) break
  }

  const targetTeam = allTeams.find(t => t.id === target.teamId)
  if (!targetTeam) return null

  const evaluation = evaluateTradeOffer(
    packagePlayers, [target.player], [], [],
    targetTeam, allPlayers, allTeams, currentSeason, currentDate,
  )

  if (evaluation.verdict === 'strong_reject' || evaluation.verdict === 'reject') return null

  const isBreaking = target.value.stars >= 4.0
  const teamName = `${team.info.city} ${team.info.name}`
  const targetName = `${target.player.bio.firstName} ${target.player.bio.lastName}`
  const fromTeam = `${targetTeam.info.city} ${targetTeam.info.name}`

  return {
    team1Id: team.id,
    team2Id: target.teamId,
    team1Players: packagePlayers.map(p => p.id),
    team2Players: [target.player.id],
    team1Picks: [],
    team2Picks: [],
    headline: `${teamName} acquire ${targetName} from ${fromTeam}`,
    isBreaking,
  }
}

// ── Background Trade Runner ─────────────────────────────────────

export function generateBackgroundTrades(
  allTeams: Team[],
  allPlayers: Player[],
  allPicks: DraftPickAsset[],
  currentSeason: number,
  currentDate: string,
  tradeFrequency: 'rare' | 'normal' | 'frequent',
): BackgroundTradeResult[] {
  const month = new Date(currentDate).getMonth()

  const baseChances: Record<string, number> = {
    rare: 0.02,
    normal: 0.05,
    frequent: 0.10,
  }
  let tradeChance = baseChances[tradeFrequency]

  if (month === 11 || month === 0) tradeChance *= 1.5
  if (month === 1) tradeChance *= 2.5

  const results: BackgroundTradeResult[] = []
  const tradedTeams = new Set<string>()

  const shuffledTeams = [...allTeams].sort(() => Math.random() - 0.5)

  for (const team of shuffledTeams) {
    if (tradedTeams.has(team.id)) continue
    if (Math.random() > tradeChance) continue

    const proposal = generateCPUTradeProposal(
      team, allTeams, allPlayers, allPicks, currentSeason, currentDate,
    )

    if (proposal) {
      results.push({
        proposal,
        headline: proposal.headline,
        isBreaking: proposal.isBreaking,
      })
      tradedTeams.add(proposal.team1Id)
      tradedTeams.add(proposal.team2Id)
    }
  }

  return results
}

// ── Trade Deadline Day ──────────────────────────────────────────

export interface DeadlineHourBlock {
  hour: number
  label: string
  trades: BackgroundTradeResult[]
}

export function simulateTradeDeadlineDay(
  allTeams: Team[],
  allPlayers: Player[],
  allPicks: DraftPickAsset[],
  currentSeason: number,
  deadlineDate: string,
  userTeamId: string,
): DeadlineHourBlock[] {
  const hours: DeadlineHourBlock[] = []
  const tradedTeams = new Set<string>()
  const cpuTeams = allTeams.filter(t => t.id !== userTeamId)

  const blocks = [
    { hour: 9,  label: 'Morning',      urgency: 0.06 },
    { hour: 11, label: 'Late Morning',  urgency: 0.10 },
    { hour: 13, label: 'Early Afternoon', urgency: 0.15 },
    { hour: 15, label: 'Afternoon',     urgency: 0.22 },
    { hour: 17, label: 'Evening Rush',  urgency: 0.30 },
    { hour: 19, label: 'Final Hours',   urgency: 0.40 },
    { hour: 21, label: 'Last Call',     urgency: 0.50 },
    { hour: 23, label: 'Buzzer Beater', urgency: 0.60 },
  ]

  for (const block of blocks) {
    const trades: BackgroundTradeResult[] = []
    const shuffled = [...cpuTeams].sort(() => Math.random() - 0.5)

    for (const team of shuffled) {
      if (tradedTeams.has(team.id)) continue
      if (Math.random() > block.urgency) continue

      const proposal = generateCPUTradeProposal(
        team, allTeams, allPlayers, allPicks, currentSeason, deadlineDate,
      )

      if (proposal) {
        trades.push({ proposal, headline: proposal.headline, isBreaking: proposal.isBreaking })
        tradedTeams.add(proposal.team1Id)
        tradedTeams.add(proposal.team2Id)
      }
    }

    if (trades.length > 0) {
      hours.push({ hour: block.hour, label: block.label, trades })
    }
  }

  return hours
}

// ── Prediction for UI ───────────────────────────────────────────

export type TradeLikelihood = 'Likely Accept' | 'Possible' | 'Likely Counter' | 'Likely Reject' | 'Will Reject'

export function predictTradeResponse(
  incomingPlayers: Player[],
  outgoingPlayers: Player[],
  incomingPicks: DraftPickAsset[],
  outgoingPicks: DraftPickAsset[],
  evaluatingTeam: Team,
  allPlayers: Player[],
  allTeams: Team[],
  currentSeason: number,
  currentDate: string,
): TradeLikelihood {
  const evaluation = evaluateTradeOffer(
    incomingPlayers, outgoingPlayers, incomingPicks, outgoingPicks,
    evaluatingTeam, allPlayers, allTeams, currentSeason, currentDate,
  )

  switch (evaluation.verdict) {
    case 'strong_accept': return 'Likely Accept'
    case 'accept': return 'Likely Accept'
    case 'borderline': return 'Likely Counter'
    case 'reject': return 'Likely Reject'
    case 'strong_reject': return 'Will Reject'
  }
}
