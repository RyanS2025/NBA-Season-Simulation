import type { Player, Team, DraftPickAsset, Position } from '../types'

// ── Public Return Types ─────────────────────────────────────────

export interface PlayerValuation {
  rawValue: number
  stars: number
  breakdown: {
    production: number
    skill: number
    ageTrajectory: number
    contractValue: number
    positionalScarcity: number
    teamFit: number
    character: number
    durability: number
  }
}

export interface PickValuation {
  rawValue: number
  stars: number
  projectedPick: number
  protectionDiscount: number
  futureDiscount: number
}

export interface CashValuation {
  rawValue: number
  stars: number
}

export interface TradeContext {
  evaluatingTeam: Team
  evaluatingTeamPlayers: Player[]
  allPlayers: Player[]
  currentSeason: number
  currentDate: string
  tradeDeadlineDate?: string
}

// ── Star Mapping ────────────────────────────────────────────────

const STAR_THRESHOLDS: [number, number][] = [
  [90, 5.0],
  [82, 4.5],
  [74, 4.0],
  [66, 3.5],
  [58, 3.0],
  [50, 2.5],
  [42, 2.0],
  [34, 1.5],
  [20, 1.0],
  [0, 0.5],
]

function rawToStars(raw: number): number {
  for (const [threshold, stars] of STAR_THRESHOLDS) {
    if (raw >= threshold) return stars
  }
  return 0.5
}

// ── Position-Weighted Skill Composite ───────────────────────────

const POSITION_WEIGHTS: Record<Position, Record<string, number>> = {
  PG: {
    ballHandling: 1.2, passingVision: 1.2, passingAccuracy: 1.0, threePoint: 0.9,
    speed: 0.8, perimeterDefense: 0.7, offensiveIq: 0.8, basketballIq: 0.6,
    finishing: 0.5, midRange: 0.4, stealing: 0.5, lateralQuickness: 0.5,
  },
  SG: {
    threePoint: 1.2, midRange: 0.8, finishing: 0.8, offBallMovement: 0.9,
    perimeterDefense: 0.7, speed: 0.6, ballHandling: 0.5, passingVision: 0.4,
    lateralQuickness: 0.5, stealing: 0.4, drawFoul: 0.4, basketballIq: 0.5,
  },
  SF: {
    finishing: 0.9, threePoint: 0.8, perimeterDefense: 0.8, rebounding: 0.6,
    strength: 0.5, midRange: 0.6, ballHandling: 0.5, passingVision: 0.4,
    interiorDefense: 0.4, speed: 0.5, offBallMovement: 0.5, basketballIq: 0.5,
  },
  PF: {
    rebounding: 1.0, interiorDefense: 0.9, finishing: 0.8, strength: 0.7,
    threePoint: 0.7, shotBlocking: 0.5, postGame: 0.6, midRange: 0.4,
    perimeterDefense: 0.4, offensiveRebounding: 0.5, basketballIq: 0.5, hustle: 0.4,
  },
  C: {
    interiorDefense: 1.2, rebounding: 1.1, shotBlocking: 1.0, finishing: 0.9,
    strength: 0.8, postGame: 0.7, offensiveRebounding: 0.6, basketballIq: 0.4,
    freeThrow: 0.3, hustle: 0.4, lateralQuickness: 0.3, threePoint: 0.3,
  },
}

function computeSkillComposite(player: Player): number {
  const pos = player.bio.position
  const weights = POSITION_WEIGHTS[pos]
  let weighted = 0
  let totalWeight = 0
  const r = player.ratings

  for (const [key, w] of Object.entries(weights)) {
    const val = r[key as keyof typeof r]
    if (typeof val === 'number') {
      weighted += val * w
      totalWeight += w
    }
  }

  const base = totalWeight > 0 ? weighted / totalWeight : 50

  const offenseSkills = [r.finishing, r.midRange, r.threePoint, r.ballHandling, r.passingVision]
  const defenseSkills = [r.perimeterDefense, r.interiorDefense, r.shotBlocking, r.stealing, r.defensiveIq]
  const avgOff = offenseSkills.reduce((a, b) => a + b, 0) / offenseSkills.length
  const avgDef = defenseSkills.reduce((a, b) => a + b, 0) / defenseSkills.length
  const twoWayBonus = Math.min(3, avgOff >= 60 && avgDef >= 60 ? ((avgOff + avgDef) / 2 - 60) * 0.1 : 0)

  return Math.min(30, (base / 100) * 30 + twoWayBonus)
}

// ── Production Score ────────────────────────────────────────────

function computeProduction(player: Player): number {
  const stats = player.careerStats
  if (!stats || stats.length === 0) {
    return Math.max(0, (computeSkillComposite(player) / 30) * 10)
  }
  const latest = stats[stats.length - 1]

  const raw =
    latest.ppg * 1.0 +
    latest.apg * 1.5 +
    latest.rpg * 0.8 +
    latest.spg * 3.0 +
    latest.bpg * 3.0 -
    latest.topg * 1.0

  const fgEff = latest.fga > 0 ? latest.fg_pct : 0.45
  const tsApprox = latest.fga > 0
    ? latest.ppg / (2 * (latest.fga + 0.44 * latest.fta))
    : 0.52
  const efficiencyBonus = Math.max(0, (tsApprox - 0.52) * 30)
  const volumeBonus = Math.min(3, latest.ppg > 20 ? (latest.ppg - 20) * 0.15 : 0)

  return Math.min(30, Math.max(0, raw * 0.7 + efficiencyBonus + volumeBonus + fgEff * 2))
}

// ── Age Trajectory ──────────────────────────────────────────────

function computeAgeTrajectory(player: Player): number {
  const age = player.bio.age
  const potential = player.ratings.potential
  const potentialGap = Math.max(0, potential - player.ratings.overall)

  if (age <= 21) return 15 + potentialGap * 0.1
  if (age <= 23) return 10 + potentialGap * 0.15
  if (age <= 25) return 5 + potentialGap * 0.1
  if (age <= 28) return 2
  if (age <= 30) return 0
  if (age <= 32) return -3
  if (age <= 34) return -6
  return -12
}

// ── Contract Value ──────────────────────────────────────────────

function computeContractValue(player: Player, rawAbility: number): number {
  const contract = player.contract
  if (!contract) return 5

  const salary = contract.annualSalary

  const expectedSalary = rawAbility >= 80 ? 35_000_000 + (rawAbility - 80) * 1_500_000
    : rawAbility >= 60 ? 10_000_000 + (rawAbility - 60) * 1_250_000
    : rawAbility >= 40 ? 2_000_000 + (rawAbility - 40) * 400_000
    : 2_000_000

  const surplus = (expectedSalary - salary) / 5_000_000
  const yearsMultiplier = Math.max(0.5, Math.min(1.5, 1 + (contract.yearsRemaining - 2) * 0.15))

  return Math.max(-15, Math.min(10, surplus * yearsMultiplier))
}

// ── Positional Scarcity ─────────────────────────────────────────

function computePositionalScarcity(player: Player, allPlayers: Player[]): number {
  const pos = player.bio.position
  const posPlayers = allPlayers.filter(p =>
    p.bio.position === pos && p.ratings.overall >= 75
  )
  if (posPlayers.length <= 8) return 5
  if (posPlayers.length <= 12) return 3
  if (posPlayers.length <= 18) return 1
  return 0
}

// ── Team Fit ────────────────────────────────────────────────────

function computeTeamFit(player: Player, ctx: TradeContext): number {
  const teamPlayers = ctx.evaluatingTeamPlayers
  const pos = player.bio.position

  const posCount = teamPlayers.filter(p => p.bio.position === pos).length
  const posNeed = posCount <= 1 ? 4 : posCount === 2 ? 2 : 0

  const teamAvgThree = teamPlayers.length > 0
    ? teamPlayers.reduce((s, p) => s + p.ratings.threePoint, 0) / teamPlayers.length
    : 50
  const shootingNeed = teamAvgThree < 55 && player.ratings.threePoint >= 70 ? 2 : 0

  const teamAvgDef = teamPlayers.length > 0
    ? teamPlayers.reduce((s, p) => s + p.ratings.interiorDefense, 0) / teamPlayers.length
    : 50
  const rimNeed = teamAvgDef < 50 && player.ratings.interiorDefense >= 70 ? 2 : 0

  return Math.min(8, posNeed + shootingNeed + rimNeed)
}

// ── Character ───────────────────────────────────────────────────

function computeCharacter(player: Player): number {
  const c = player.character
  const positive = (c.leadership - 50) * 0.05 + (c.clutch - 50) * 0.04 + (c.workEthic - 50) * 0.03
  const negative = (c.ego - 50) * 0.03 + (50 - c.coachability) * 0.03 + (50 - c.temperament) * 0.02
  return Math.max(-5, Math.min(5, positive - negative))
}

// ── Durability ──────────────────────────────────────────────────

function computeDurability(player: Player): number {
  const d = player.durability.overallDurability
  const injuries = player.durability.injuryHistory.length
  const severePenalty = player.durability.injuryHistory
    .filter(i => i.severity === 'severe' || i.severity === 'season_ending')
    .length * 2

  if (d >= 80 && injuries <= 1) return 0
  if (d >= 60) return -2 - severePenalty
  if (d >= 40) return -4 - severePenalty
  return -8
}

// ── Deadline Premium ────────────────────────────────────────────

function computeDeadlinePremium(ctx: TradeContext): number {
  if (!ctx.tradeDeadlineDate) return 1.0
  const current = new Date(ctx.currentDate).getTime()
  const deadline = new Date(ctx.tradeDeadlineDate).getTime()
  const daysUntil = (deadline - current) / (1000 * 60 * 60 * 24)

  if (daysUntil <= 0 || daysUntil > 60) return 1.0
  if (daysUntil <= 3) return 1.20
  if (daysUntil <= 7) return 1.15
  if (daysUntil <= 14) return 1.10
  return 1.05
}

// ── Player Value (Main) ─────────────────────────────────────────

export function calculatePlayerValue(
  player: Player,
  ctx: TradeContext,
): PlayerValuation {
  const production = computeProduction(player)
  const skill = computeSkillComposite(player)
  const ageTrajectory = computeAgeTrajectory(player)
  const abilityRaw = production + skill
  const contractValue = computeContractValue(player, abilityRaw)
  const positionalScarcity = computePositionalScarcity(player, ctx.allPlayers)
  const teamFit = computeTeamFit(player, ctx)
  const character = computeCharacter(player)
  const durability = computeDurability(player)

  let rawValue = production + skill + ageTrajectory + contractValue +
    positionalScarcity + teamFit + character + durability

  rawValue *= computeDeadlinePremium(ctx)
  rawValue = Math.max(0, Math.min(100, rawValue))

  return {
    rawValue: Math.round(rawValue * 10) / 10,
    stars: rawToStars(rawValue),
    breakdown: {
      production: Math.round(production * 10) / 10,
      skill: Math.round(skill * 10) / 10,
      ageTrajectory: Math.round(ageTrajectory * 10) / 10,
      contractValue: Math.round(contractValue * 10) / 10,
      positionalScarcity: Math.round(positionalScarcity * 10) / 10,
      teamFit: Math.round(teamFit * 10) / 10,
      character: Math.round(character * 10) / 10,
      durability: Math.round(durability * 10) / 10,
    },
  }
}

// ── Pick Value ──────────────────────────────────────────────────

const PICK_VALUE_CURVE: number[] = [
  85, 80, 76, 72, 68, 65, 62, 59, 56, 53,
  50, 48, 46, 44, 42, 40, 38, 36, 34, 32,
  30, 29, 28, 27, 26, 25, 24, 23, 22, 21,
]

const SECOND_ROUND_CURVE: number[] = [
  15, 14, 13, 12, 11, 10, 9, 8, 7, 6,
  5, 5, 4, 4, 3, 3, 3, 2, 2, 2,
  2, 1, 1, 1, 1, 1, 1, 1, 1, 1,
]

function projectPickPosition(
  originalTeamId: string,
  teams: Team[],
  _currentSeason: number,
  _pickYear: number,
): number {
  const team = teams.find(t => t.id === originalTeamId)
  if (!team) return 15

  const record = team.seasonRecord
  const totalGames = record.wins + record.losses
  if (totalGames === 0) return 15

  const winPct = record.wins / totalGames
  const projectedRank = Math.round(30 - winPct * 29)
  return Math.max(1, Math.min(30, projectedRank))
}

export function calculatePickValue(
  pick: DraftPickAsset,
  ctx: TradeContext & { allTeams: Team[] },
): PickValuation {
  const projectedPick = projectPickPosition(
    pick.originalTeamId, ctx.allTeams, ctx.currentSeason, pick.year,
  )

  const baseCurve = pick.round === 1 ? PICK_VALUE_CURVE : SECOND_ROUND_CURVE
  const idx = Math.min(projectedPick - 1, baseCurve.length - 1)
  let value = baseCurve[idx]

  let protectionDiscount = 1.0
  for (const prot of pick.protections) {
    if (prot.type === 'top' && prot.value <= 3) protectionDiscount *= 0.70
    else if (prot.type === 'top' && prot.value <= 10) protectionDiscount *= 0.55
    else if (prot.type === 'lottery') protectionDiscount *= 0.45
  }

  if (pick.isSwapRight) {
    value *= 0.40
    protectionDiscount = 1.0
  }

  value *= protectionDiscount

  const yearsAway = pick.year - ctx.currentSeason
  const futureDiscount = Math.pow(0.92, Math.max(0, yearsAway))
  value *= futureDiscount

  const rawValue = Math.max(0, Math.min(100, value))

  return {
    rawValue: Math.round(rawValue * 10) / 10,
    stars: rawToStars(rawValue),
    projectedPick,
    protectionDiscount: Math.round(protectionDiscount * 100) / 100,
    futureDiscount: Math.round(futureDiscount * 100) / 100,
  }
}

// ── Cash Value ──────────────────────────────────────────────────

export function calculateCashValue(amount: number): CashValuation {
  const rawValue = Math.min(8, (amount / 5_000_000) * 8)
  return {
    rawValue: Math.round(rawValue * 10) / 10,
    stars: rawToStars(rawValue),
  }
}

// ── Trade Balance ───────────────────────────────────────────────

export interface TradeSideValue {
  totalStars: number
  totalRaw: number
  playerValues: { playerId: string; valuation: PlayerValuation }[]
  pickValues: { pick: DraftPickAsset; valuation: PickValuation }[]
  cashValue: CashValuation | null
}

export function calculateTradeSideValue(
  players: Player[],
  picks: DraftPickAsset[],
  cashAmount: number,
  ctx: TradeContext & { allTeams: Team[] },
): TradeSideValue {
  const playerValues = players.map(p => ({
    playerId: p.id,
    valuation: calculatePlayerValue(p, ctx),
  }))

  const pickValues = picks.map(pk => ({
    pick: pk,
    valuation: calculatePickValue(pk, ctx),
  }))

  const cashValue = cashAmount > 0 ? calculateCashValue(cashAmount) : null

  const totalRaw = playerValues.reduce((s, pv) => s + pv.valuation.rawValue, 0)
    + pickValues.reduce((s, pv) => s + pv.valuation.rawValue, 0)
    + (cashValue?.rawValue ?? 0)

  const totalStars = rawToStars(Math.min(100, totalRaw))

  return { totalStars, totalRaw, playerValues, pickValues, cashValue }
}
