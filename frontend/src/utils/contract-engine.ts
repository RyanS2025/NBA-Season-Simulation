import type { Player, Team } from '../types'
import { computeOverall } from './offseason-engine'

/** Extension window closes at the league's Dec 15 deadline. */
export function extensionDeadline(seasonYear: number): string {
  return `${seasonYear}-12-15`
}

export function isExtensionEligible(p: Player, currentDate: string, seasonYear: number): boolean {
  if (!p.contract || p.contract.yearsRemaining !== 1) return false
  return currentDate <= extensionDeadline(seasonYear)
}

function skillValue(p: Player): number {
  return computeOverall(p.ratings as unknown as Record<string, number>, p.bio.position)
}

/** What the player believes they're worth per year on the open market. */
export function askingSalary(p: Player): number {
  const value = skillValue(p)
  if (value >= 90) return 42_000_000
  if (value >= 85) return 32_000_000
  if (value >= 80) return 22_000_000
  if (value >= 75) return 13_000_000
  if (value >= 70) return 7_000_000
  return 3_000_000
}

export interface ExtensionVerdict {
  accepted: boolean
  feedback: string
}

/**
 * Whether the player signs the extension. Money is most of it, but a
 * winning situation, good morale, and loyalty all buy a discount —
 * while an unhappy star on a losing team demands a premium to stay.
 */
export function evaluateExtensionOffer(
  p: Player,
  offeredSalary: number,
  offeredYears: number,
  teamWinPct: number,
): ExtensionVerdict {
  const ask = askingSalary(p)
  const morale = p.status.morale ?? 72
  const loyalty = p.character.loyalty ?? 50

  // Discount/premium multiplier on the ask
  let required = ask
  required *= 1 - (loyalty - 50) * 0.003        // loyal players take less
  required *= 1 - (morale - 60) * 0.003         // happy players take less
  required *= 1 - (teamWinPct - 0.5) * 0.25     // contenders get discounts
  if (p.status.tradeRequested) required *= 1.35 // wants out — pay up or lose him

  // Aging players value security (years) over max dollars
  if (p.bio.age >= 31 && offeredYears >= 3) required *= 0.92
  if (p.bio.age <= 25 && offeredYears >= 4) required *= 0.96

  if (offeredSalary >= required) {
    return { accepted: true, feedback: 'Agreed to terms' }
  }
  const shortfall = (required - offeredSalary) / required
  if (shortfall < 0.1) {
    return { accepted: false, feedback: `Close — he's looking for around $${(required / 1e6).toFixed(1)}M per year` }
  }
  if (p.status.tradeRequested) {
    return { accepted: false, feedback: 'Not interested in extending while his trade request stands — unless you overpay' }
  }
  return { accepted: false, feedback: `Rejected — he believes he's worth $${(required / 1e6).toFixed(1)}M per year` }
}

export interface CpuExtension {
  playerId: string
  playerName: string
  teamId: string
  salary: number
  years: number
}

/**
 * At the deadline, CPU front offices lock up their best expiring
 * players at market rate. Mutates player contracts in place.
 */
export function cpuExtendPlayers(
  teams: Team[],
  players: Player[],
  _seasonYear: number,
  userTeamId: string,
): CpuExtension[] {
  const extensions: CpuExtension[] = []

  for (const team of teams) {
    if (team.id === userTeamId) continue
    const expiring = players
      .filter(p => p.teamId === team.id && p.contract?.yearsRemaining === 1)
      .sort((a, b) => skillValue(b) - skillValue(a))
      .slice(0, 3)

    for (const p of expiring) {
      const value = skillValue(p)
      if (value < 74) continue // let role players hit free agency
      const keepChance = value >= 85 ? 0.85 : value >= 80 ? 0.7 : 0.5
      if (Math.random() > keepChance) continue

      const salary = Math.round(askingSalary(p) * (0.95 + Math.random() * 0.1))
      const years = p.bio.age <= 26 ? 4 : p.bio.age <= 30 ? 3 : 2

      applyExtension(p, salary, years)
      extensions.push({
        playerId: p.id,
        playerName: `${p.bio.firstName} ${p.bio.lastName}`,
        teamId: team.id,
        salary,
        years,
      })
    }
  }

  return extensions
}

/** Extension years stack on top of the current final season. */
export function applyExtension(p: Player, salary: number, years: number): void {
  if (!p.contract) return
  p.contract = {
    ...p.contract,
    annualSalary: salary,
    yearsRemaining: 1 + years,
    totalYears: 1 + years,
    contractType: 'extension',
    // Long extensions carry a player option on the final year
    playerOption: years >= 3,
  }
  // Getting paid feels good
  p.status.morale = Math.min(99, (p.status.morale ?? 72) + 8)
}
