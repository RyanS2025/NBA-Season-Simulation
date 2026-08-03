import type { Player, CBAConstants, CapSheet } from '../types'

export const CBA_2026_27: CBAConstants = {
  salaryCap: 141_000_000,
  luxuryTaxThreshold: 171_000_000,
  firstApron: 179_000_000,
  secondApron: 189_000_000,
  minimumTeamSalary: 113_000_000,
  maxContractPercentages: {
    zeroToSixYears: 0.25,
    sevenToNineYears: 0.30,
    tenPlusYears: 0.35,
  },
  rookieScale: {
    1: { year1: 12_160_000, year2: 12_770_000, year3Option: 13_380_000, year4Option: 17_850_000 },
    2: { year1: 10_890_000, year2: 11_430_000, year3Option: 11_980_000, year4Option: 15_970_000 },
    3: { year1: 9_770_000, year2: 10_260_000, year3Option: 10_750_000, year4Option: 14_330_000 },
    4: { year1: 8_770_000, year2: 9_210_000, year3Option: 9_650_000, year4Option: 12_870_000 },
    5: { year1: 7_890_000, year2: 8_280_000, year3Option: 8_680_000, year4Option: 11_570_000 },
    6: { year1: 5_530_000, year2: 5_810_000, year3Option: 6_230_000, year4Option: 8_300_000 },
    7: { year1: 4_920_000, year2: 5_170_000, year3Option: 5_540_000, year4Option: 7_390_000 },
    8: { year1: 4_360_000, year2: 4_580_000, year3Option: 4_910_000, year4Option: 6_550_000 },
    9: { year1: 3_860_000, year2: 4_050_000, year3Option: 4_340_000, year4Option: 5_790_000 },
    10: { year1: 3_410_000, year2: 3_580_000, year3Option: 3_840_000, year4Option: 5_120_000 },
    11: { year1: 2_510_000, year2: 2_630_000, year3Option: 2_820_000, year4Option: 3_760_000 },
    12: { year1: 2_510_000, year2: 2_630_000, year3Option: 2_820_000, year4Option: 3_760_000 },
    13: { year1: 2_510_000, year2: 2_630_000, year3Option: 2_820_000, year4Option: 3_760_000 },
    14: { year1: 2_510_000, year2: 2_630_000, year3Option: 2_820_000, year4Option: 3_760_000 },
    15: { year1: 2_510_000, year2: 2_630_000, year3Option: 2_820_000, year4Option: 3_760_000 },
    16: { year1: 2_510_000, year2: 2_630_000, year3Option: 2_820_000, year4Option: 3_760_000 },
    17: { year1: 2_510_000, year2: 2_630_000, year3Option: 2_820_000, year4Option: 3_760_000 },
    18: { year1: 2_510_000, year2: 2_630_000, year3Option: 2_820_000, year4Option: 3_760_000 },
    19: { year1: 2_510_000, year2: 2_630_000, year3Option: 2_820_000, year4Option: 3_760_000 },
    20: { year1: 2_510_000, year2: 2_630_000, year3Option: 2_820_000, year4Option: 3_760_000 },
    21: { year1: 2_510_000, year2: 2_630_000, year3Option: 2_820_000, year4Option: 3_760_000 },
    22: { year1: 2_510_000, year2: 2_630_000, year3Option: 2_820_000, year4Option: 3_760_000 },
    23: { year1: 2_510_000, year2: 2_630_000, year3Option: 2_820_000, year4Option: 3_760_000 },
    24: { year1: 2_510_000, year2: 2_630_000, year3Option: 2_820_000, year4Option: 3_760_000 },
    25: { year1: 2_510_000, year2: 2_630_000, year3Option: 2_820_000, year4Option: 3_760_000 },
    26: { year1: 2_510_000, year2: 2_630_000, year3Option: 2_820_000, year4Option: 3_760_000 },
    27: { year1: 2_510_000, year2: 2_630_000, year3Option: 2_820_000, year4Option: 3_760_000 },
    28: { year1: 2_510_000, year2: 2_630_000, year3Option: 2_820_000, year4Option: 3_760_000 },
    29: { year1: 2_510_000, year2: 2_630_000, year3Option: 2_820_000, year4Option: 3_760_000 },
    30: { year1: 2_510_000, year2: 2_630_000, year3Option: 2_820_000, year4Option: 3_760_000 },
  },
  veteranMinimums: {
    0: 1_119_000, 1: 1_119_000, 2: 1_119_000, 3: 1_119_000,
    4: 2_019_000, 5: 2_019_000, 6: 2_019_000,
    7: 2_346_000, 8: 2_346_000, 9: 2_346_000,
    10: 2_891_000,
  },
  midLevelException: 12_400_000,
  taxpayerMLE: 7_200_000,
  biAnnualException: 4_500_000,
  annualRaises: {
    birdRights: 0.08,
    otherTeam: 0.05,
  },
  tradeRules: {
    overCapMatchingPercentage: 1.25,
    overCapMatchingFlat: 100_000,
    apronMatchingRule: 'standard',
  },
  hardCapTriggers: ['sign_and_trade', 'bi_annual_exception', 'mid_level_exception'],
}

export function computeTeamPayroll(players: Player[]): number {
  return players.reduce((sum, p) => sum + (p.contract?.annualSalary ?? 0), 0)
}

export function computeCapSheet(players: Player[], cba: CBAConstants = CBA_2026_27): CapSheet {
  const totalPayroll = computeTeamPayroll(players)
  const isOverCap = totalPayroll > cba.salaryCap
  const isInLuxuryTax = totalPayroll > cba.luxuryTaxThreshold

  return {
    salaryCap: cba.salaryCap,
    totalPayroll,
    luxuryTaxThreshold: cba.luxuryTaxThreshold,
    firstApron: cba.firstApron,
    secondApron: cba.secondApron,
    capSpace: Math.max(0, cba.salaryCap - totalPayroll),
    midLevelException: isInLuxuryTax ? 0 : cba.midLevelException,
    biAnnualException: isInLuxuryTax ? 0 : cba.biAnnualException,
    taxpayerMLE: isInLuxuryTax ? cba.taxpayerMLE : 0,
    isOverCap,
    isInLuxuryTax,
  }
}

export function computeLuxuryTax(payroll: number, cba: CBAConstants = CBA_2026_27): number {
  if (payroll <= cba.luxuryTaxThreshold) return 0

  const over = payroll - cba.luxuryTaxThreshold
  let tax = 0
  const brackets = [
    { limit: 5_000_000, rate: 1.50 },
    { limit: 5_000_000, rate: 1.75 },
    { limit: 5_000_000, rate: 2.50 },
    { limit: 5_000_000, rate: 3.25 },
    { limit: Infinity, rate: 3.75 },
  ]

  let remaining = over
  for (const bracket of brackets) {
    const inBracket = Math.min(remaining, bracket.limit)
    tax += inBracket * bracket.rate
    remaining -= inBracket
    if (remaining <= 0) break
  }

  return Math.round(tax)
}

export interface TradeValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  salaryOut: number
  salaryIn: number
}

export function validateTrade(
  outgoingPlayers: Player[],
  incomingPlayers: Player[],
  teamPayroll: number,
  cba: CBAConstants = CBA_2026_27,
): TradeValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const salaryOut = outgoingPlayers.reduce((s, p) => s + (p.contract?.annualSalary ?? 0), 0)
  const salaryIn = incomingPlayers.reduce((s, p) => s + (p.contract?.annualSalary ?? 0), 0)

  if (outgoingPlayers.length === 0) {
    errors.push('Must send at least one player')
  }
  if (incomingPlayers.length === 0) {
    errors.push('Must receive at least one player')
  }

  if (teamPayroll > cba.salaryCap) {
    const maxIncoming = salaryOut * cba.tradeRules.overCapMatchingPercentage + cba.tradeRules.overCapMatchingFlat
    if (salaryIn > maxIncoming) {
      errors.push(
        `Incoming salary ($${formatM(salaryIn)}) exceeds the ${Math.round(cba.tradeRules.overCapMatchingPercentage * 100)}% + $${formatM(cba.tradeRules.overCapMatchingFlat)} matching rule (max $${formatM(maxIncoming)})`,
      )
    }
  }

  if (teamPayroll > cba.firstApron) {
    if (salaryIn > salaryOut) {
      errors.push('Teams above the first apron cannot take back more salary than they send out')
    }
  }

  const newPayroll = teamPayroll - salaryOut + salaryIn
  if (newPayroll > cba.luxuryTaxThreshold && teamPayroll <= cba.luxuryTaxThreshold) {
    warnings.push('This trade will put you into the luxury tax')
  }
  if (newPayroll > cba.firstApron && teamPayroll <= cba.firstApron) {
    warnings.push('This trade will push you above the first apron')
  }

  for (const p of outgoingPlayers) {
    if (p.contract?.noTradeClause) {
      warnings.push(`${p.bio.firstName} ${p.bio.lastName} has a no-trade clause and must approve`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    salaryOut,
    salaryIn,
  }
}

export function getVeteranMinimum(yearsInLeague: number, cba: CBAConstants = CBA_2026_27): number {
  const key = Math.min(yearsInLeague, 10)
  return cba.veteranMinimums[key] ?? cba.veteranMinimums[0]
}

export function getMaxSalary(yearsInLeague: number, cba: CBAConstants = CBA_2026_27): number {
  let pct: number
  if (yearsInLeague >= 10) pct = cba.maxContractPercentages.tenPlusYears
  else if (yearsInLeague >= 7) pct = cba.maxContractPercentages.sevenToNineYears
  else pct = cba.maxContractPercentages.zeroToSixYears

  return Math.round(cba.salaryCap * pct)
}

function formatM(n: number): string {
  return (n / 1_000_000).toFixed(1) + 'M'
}
