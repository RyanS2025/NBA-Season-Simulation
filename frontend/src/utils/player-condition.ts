import type { Player, ActiveInjury, InjuryType, BodyPart, SeasonStats } from '../types/player'

type Severity = ActiveInjury['severity']

// ── Availability ────────────────────────────────────────────────

/** Whether a player can take the floor tonight. */
export function isAvailable(p: Player): boolean {
  if (isHoldingOut(p)) return false
  const inj = p.status.currentInjury
  if (!inj) return true
  return !!inj.playingThrough
}

/**
 * An ignored trade demand eventually becomes a holdout: after ~20 team
 * games, players without strong loyalty refuse to suit up until moved.
 */
export function isHoldingOut(p: Player): boolean {
  if (!p.status.tradeRequested) return false
  const games = p.status.tradeRequestGames ?? 0
  const loyalty = p.character.loyalty ?? 50
  return games >= 20 && loyalty < 55
}

/** Only mild injuries can be played through. */
export function canPlayThrough(injury: Pick<ActiveInjury, 'severity' | 'type'>): boolean {
  if (injury.severity === 'minor') return true
  if (injury.severity === 'moderate') {
    return injury.type === 'soreness' || injury.type === 'inflammation' || injury.type === 'contusion'
  }
  return false
}

// ── Injury generation ───────────────────────────────────────────

interface BodyPartRisk {
  part: BodyPart
  weight: (p: Player) => number
  types: InjuryType[]
}

const BODY_PARTS: BodyPartRisk[] = [
  { part: 'ankle', weight: p => 130 - p.durability.ankleHealth, types: ['sprain', 'sprain', 'fracture'] },
  { part: 'knee', weight: p => 125 - p.durability.kneeHealth, types: ['sprain', 'soreness', 'tear'] },
  { part: 'hamstring', weight: p => 60 + p.durability.softTissueRisk * 0.5, types: ['strain', 'strain', 'tear'] },
  { part: 'back', weight: p => 115 - p.durability.backHealth, types: ['soreness', 'strain', 'inflammation'] },
  { part: 'shoulder', weight: p => 105 - p.durability.shoulderHealth, types: ['soreness', 'sprain', 'dislocation'] },
  { part: 'foot', weight: p => 110 - p.durability.footHealth, types: ['soreness', 'sprain', 'fracture'] },
  { part: 'wrist', weight: p => 100 - p.durability.wristHandHealth, types: ['sprain', 'sprain', 'fracture'] },
  { part: 'groin', weight: p => 50 + p.durability.softTissueRisk * 0.4, types: ['strain', 'strain', 'strain'] },
  { part: 'calf', weight: p => 45 + p.durability.softTissueRisk * 0.4, types: ['strain', 'strain', 'tear'] },
  { part: 'quad', weight: p => 40 + p.durability.softTissueRisk * 0.3, types: ['contusion', 'strain', 'strain'] },
  { part: 'achilles', weight: p => 8 + p.durability.softTissueRisk * 0.15 + Math.max(0, p.bio.age - 28) * 1.5, types: ['soreness', 'strain', 'tear'] },
  { part: 'head', weight: p => p.durability.concussionRisk * 0.4, types: ['concussion', 'concussion', 'concussion'] },
]

const FREQUENCY_MULT: Record<string, number> = { rare: 0.4, normal: 1.0, frequent: 1.8, brutal: 3.0 }

/**
 * Per-game injury roll. Returns a new ActiveInjury or null. Probability
 * scales with minutes played, age, durability, and the team's trainer.
 */
export function rollForInjury(
  player: Player,
  minutes: number,
  trainerPrevention: number,
  frequency: string,
): ActiveInjury | null {
  if (minutes <= 0 || player.status.currentInjury) return null

  const minuteFactor = minutes / 36
  const durability = player.durability.overallDurability || 75
  const agePenalty = Math.max(0, player.bio.age - 29) * 0.0012
  const base = 0.011 * minuteFactor
  const durabilityMult = 1 + (75 - durability) * 0.02
  const trainerMult = 1.2 - (trainerPrevention / 100) * 0.4
  const freqMult = FREQUENCY_MULT[frequency] ?? 1.0

  const probability = (base * durabilityMult + agePenalty) * trainerMult * freqMult
  if (Math.random() >= probability) return null

  // Pick body part weighted by the player's weaknesses
  const weights = BODY_PARTS.map(bp => Math.max(1, bp.weight(player)))
  const total = weights.reduce((s, w) => s + w, 0)
  let roll = Math.random() * total
  let chosen = BODY_PARTS[0]
  for (let i = 0; i < BODY_PARTS.length; i++) {
    roll -= weights[i]
    if (roll <= 0) { chosen = BODY_PARTS[i]; break }
  }

  // Severity distribution: mostly minor knocks, rare disasters
  const sevRoll = Math.random()
  let severity: Severity
  let gamesOut: number
  let typeIdx: number
  if (sevRoll < 0.60) {
    severity = 'minor'
    gamesOut = 1 + Math.floor(Math.random() * 3)
    typeIdx = 0
  } else if (sevRoll < 0.87) {
    severity = 'moderate'
    gamesOut = 4 + Math.floor(Math.random() * 9)
    typeIdx = 1
  } else if (sevRoll < 0.97) {
    severity = 'severe'
    gamesOut = 13 + Math.floor(Math.random() * 23)
    typeIdx = 2
  } else {
    severity = 'season_ending'
    gamesOut = 40 + Math.floor(Math.random() * 42)
    typeIdx = 2
  }

  return {
    bodyPart: chosen.part,
    type: chosen.types[typeIdx],
    severity,
    gamesRemaining: gamesOut,
    dateInjured: '',
  }
}

// ── Permanent (career-altering) effects ─────────────────────────

/** ACL tears, achilles ruptures, and the like never fully heal. */
export function isCareerAltering(injury: Pick<ActiveInjury, 'severity' | 'type' | 'bodyPart'>): boolean {
  if (injury.severity !== 'severe' && injury.severity !== 'season_ending') return false
  if (injury.type === 'tear' && (injury.bodyPart === 'knee' || injury.bodyPart === 'achilles' || injury.bodyPart === 'hamstring')) return true
  if (injury.type === 'fracture' && (injury.bodyPart === 'foot' || injury.bodyPart === 'ankle')) return true
  return false
}

const PHYSICAL_KEYS = ['speed', 'acceleration', 'vertical', 'lateralQuickness'] as const

/**
 * Permanently reduces explosiveness after a career-altering injury.
 * Mutates ratings in place; caller should refresh the displayed overall.
 */
export function applyPermanentEffects(player: Player, injury: ActiveInjury): void {
  const base = injury.severity === 'season_ending' ? 6 : 4
  for (const key of PHYSICAL_KEYS) {
    const loss = base + Math.floor(Math.random() * 4)
    const current = player.ratings[key]
    player.ratings[key] = Math.max(40, current - loss)
  }
  // Soft-tissue tears also sap durability going forward
  player.durability.overallDurability = Math.max(30, player.durability.overallDurability - 8)
  if (injury.bodyPart === 'knee') player.durability.kneeHealth = Math.max(30, player.durability.kneeHealth - 15)
  if (injury.bodyPart === 'achilles' || injury.bodyPart === 'hamstring' || injury.bodyPart === 'calf') {
    player.durability.softTissueRisk = Math.min(99, player.durability.softTissueRisk + 12)
  }
}

// ── Recovery ────────────────────────────────────────────────────

export interface RecoveryResult {
  recovered: boolean
  aggravated: boolean
}

/**
 * Advance recovery by one team game. Good trainers speed rehab; playing
 * through an injury risks aggravating it. On full recovery the injury
 * moves into the player's permanent injury history.
 */
export function advanceInjuryRecovery(player: Player, trainerRehab: number, seasonYear: number): RecoveryResult {
  const injury = player.status.currentInjury
  if (!injury) return { recovered: false, aggravated: false }

  if (injury.playingThrough && Math.random() < 0.05) {
    injury.gamesRemaining += 2 + Math.floor(Math.random() * 3)
    if (injury.severity === 'minor' && Math.random() < 0.4) {
      injury.severity = 'moderate'
      injury.playingThrough = false
      player.status.health = 'out'
    }
    return { recovered: false, aggravated: true }
  }

  let ticks = 1
  if (Math.random() < (trainerRehab / 100) * 0.4) ticks = 2
  injury.gamesRemaining -= ticks

  if (injury.gamesRemaining <= 0) {
    player.durability.injuryHistory = player.durability.injuryHistory ?? []
    player.durability.injuryHistory.push({
      type: injury.type,
      severity: injury.severity,
      gamesOut: Math.max(1, Math.abs(injury.gamesRemaining) + 1),
      seasonYear,
      bodyPart: injury.bodyPart,
      permanentEffect: isCareerAltering(injury),
    })
    player.status.currentInjury = null
    player.status.health = 'healthy'
    return { recovered: true, aggravated: false }
  }
  return { recovered: false, aggravated: false }
}

// ── Hot / cold form ─────────────────────────────────────────────

/**
 * Update the smoothed form signal from tonight's scoring vs the
 * player's season norm. Form is the rounded -2..+2 streak adjustment
 * baked into the displayed overall and a small sim modifier.
 */
export function updateForm(player: Player, gamePoints: number, seasonEntry: SeasonStats | null): void {
  if (!seasonEntry || seasonEntry.gp < 5) {
    player.status.form = 0
    player.status.formMomentum = 0
    return
  }
  const norm = Math.max(4, seasonEntry.ppg)
  let delta = Math.max(-1, Math.min(1, (gamePoints - norm) / Math.max(6, norm * 0.6)))
  // Game scoring is right-skewed (a floor at zero, no ceiling), so raw
  // deltas run cold more often than hot — damp the downside to balance.
  if (delta < 0) delta *= 0.65
  const momentum = (player.status.formMomentum ?? 0) * 0.72 + delta * 0.28
  player.status.formMomentum = momentum

  if (momentum > 0.45) player.status.form = 2
  else if (momentum > 0.18) player.status.form = 1
  else if (momentum < -0.45) player.status.form = -2
  else if (momentum < -0.18) player.status.form = -1
  else player.status.form = 0
}

// ── Morale ──────────────────────────────────────────────────────

export type MoraleEvent = 'trade_demand' | 'demand_rescinded' | null

/**
 * Update morale after a team game. Winning helps (more for competitive
 * players), getting benched below your talent level hurts (more for big
 * egos), and everything slowly drifts back toward content. Returns a
 * trade-demand event when morale crosses a threshold.
 */
export function updateMorale(
  player: Player,
  minutesPlayed: number,
  expectedMinutes: number,
  teamWon: boolean,
): MoraleEvent {
  const competitiveness = player.character.competitiveness ?? 50
  const ego = player.character.ego ?? 50
  const loyalty = player.character.loyalty ?? 50

  let morale = player.status.morale ?? 72

  morale += teamWon ? 0.5 * (competitiveness / 100 + 0.4) : -0.85 * (competitiveness / 100 + 0.4)

  // Role satisfaction: playing well below your talent level stings.
  // Injured players sitting out don't blame the coach.
  if (!player.status.currentInjury) {
    const gap = minutesPlayed - expectedMinutes
    if (gap < -8) {
      morale -= 1.1 * (0.5 + ego / 100)
    } else if (gap > -3) {
      morale += 0.15
    }
  }

  // Slow drift back toward a content baseline
  morale += (72 - morale) * 0.012
  morale = Math.max(5, Math.min(99, morale))
  player.status.morale = Math.round(morale * 10) / 10

  // Trade demands: loyalty raises the pain threshold
  const demandThreshold = 22 + (loyalty / 100) * 12
  if (!player.status.tradeRequested && morale < demandThreshold) {
    player.status.tradeRequested = true
    return 'trade_demand'
  }
  if (player.status.tradeRequested && morale > 55) {
    player.status.tradeRequested = false
    player.status.tradeRequestGames = 0
    return 'demand_rescinded'
  }
  return null
}

export type EscalationEvent = 'escalated' | 'holdout' | null

/**
 * Tick an active trade demand forward one game. An unresolved demand
 * poisons the locker room (teammate contagion is handled by the caller)
 * and escalates: public pressure at 10 games, a holdout at 20 for
 * players without strong loyalty ties.
 */
export function advanceTradeDemand(player: Player): EscalationEvent {
  if (!player.status.tradeRequested) return null
  const games = (player.status.tradeRequestGames ?? 0) + 1
  player.status.tradeRequestGames = games
  if (games === 10) return 'escalated'
  if (games === 20 && (player.character.loyalty ?? 50) < 55) return 'holdout'
  return null
}

/**
 * What a player of this caliber expects to play, given where they rank
 * on the roster — mirrors the sim's auto-rotation ladder.
 */
export function expectedMinutesByRank(rank: number): number {
  const targets = [34, 32, 31, 30, 28, 20, 16, 12, 8, 4, 2, 1, 1, 0, 0]
  return targets[Math.min(rank, targets.length - 1)]
}

// ── Displayed overall ───────────────────────────────────────────

function injuryOverallPenalty(p: Player): number {
  const inj = p.status.currentInjury
  if (!inj) return 0
  if (inj.playingThrough) return -2
  switch (inj.severity) {
    case 'minor': return -1
    case 'moderate': return -3
    case 'severe': return -5
    case 'season_ending': return -7
  }
}

/**
 * Recompute the displayed overall as base skill rating plus current
 * form and injury adjustments. The base is captured once so repeated
 * refreshes never compound.
 */
export function refreshDisplayedOverall(p: Player): void {
  const base = p.ratings.baseOverall ?? p.ratings.overall
  p.ratings.baseOverall = base
  const adjusted = base + (p.status.form ?? 0) + injuryOverallPenalty(p)
  p.ratings.overall = Math.max(40, Math.min(99, Math.round(adjusted)))
}

/** Reset the stored base after ratings change (development, permanent injury). */
export function rebaseOverall(p: Player, newBase: number): void {
  p.ratings.baseOverall = Math.max(40, Math.min(99, Math.round(newBase)))
  refreshDisplayedOverall(p)
}
