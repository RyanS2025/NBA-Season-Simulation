import type { DraftPickAsset } from './team';

export interface ContractInfo {
  id: string;
  playerId: string;
  teamId: string;
  type: ContractType;
  years: ContractYear[];
  totalValue: number;
  signingDate: string;
  birdRightsStatus: BirdRightsStatus;
  tradeRestriction: TradeRestriction | null;
  hasNoTradeClause: boolean;
  hasPlayerOption: boolean;
  hasTeamOption: boolean;
  playerOptionYear: number | null;
  teamOptionYear: number | null;
  isFullyGuaranteed: boolean;
  poisonPillProvision: boolean;
}

export interface ContractYear {
  year: number;
  salary: number;
  isGuaranteed: boolean;
  guaranteeDate: string | null;
  incentives: ContractIncentive[];
  tradeBonus: number;
}

export interface ContractIncentive {
  description: string;
  amount: number;
  type: "likely" | "unlikely";
  criteria: string;
}

export type ContractType =
  | "rookie_scale"
  | "rookie_scale_extension"
  | "veteran_max"
  | "designated_veteran_max"
  | "standard"
  | "minimum"
  | "mid_level_exception"
  | "bi_annual_exception"
  | "taxpayer_mid_level"
  | "two_way"
  | "ten_day"
  | "sign_and_trade"
  | "qualifying_offer";

export type BirdRightsStatus =
  | "full_bird"
  | "early_bird"
  | "non_bird"
  | "none";

export interface TradeRestriction {
  type: "newly_signed" | "sign_and_trade" | "poison_pill";
  restrictionEndDate: string;
}

export interface CBAConstants {
  salaryCap: number;
  luxuryTaxThreshold: number;
  firstApron: number;
  secondApron: number;
  minimumTeamSalary: number;
  maxContractPercentages: {
    zeroToSixYears: number;
    sevenToNineYears: number;
    tenPlusYears: number;
  };
  rookieScale: Record<number, RookieScaleEntry>;
  veteranMinimums: Record<number, number>;
  midLevelException: number;
  taxpayerMLE: number;
  biAnnualException: number;
  annualRaises: {
    birdRights: number;
    otherTeam: number;
  };
  tradeRules: {
    overCapMatchingPercentage: number;
    overCapMatchingFlat: number;
    apronMatchingRule: "dollar_for_dollar" | "standard";
  };
  hardCapTriggers: string[];
}

export interface RookieScaleEntry {
  year1: number;
  year2: number;
  year3Option: number;
  year4Option: number;
}

export interface TradePackage {
  id: string;
  teams: TradeTeamPackage[];
  status: "proposed" | "accepted" | "rejected" | "invalid";
  validationErrors: string[];
}

export interface TradeTeamPackage {
  teamId: string;
  playersOut: string[];
  playersIn: string[];
  picksOut: DraftPickAsset[];
  picksIn: DraftPickAsset[];
  cashOut: number;
  cashIn: number;
  salaryOut: number;
  salaryIn: number;
}

export interface Trade {
  id: string;
  date: string;
  teams: TradeTeamPackage[];
  description: string;
  seasonYear: number;
}

export interface CapSheet {
  salaryCap: number;
  totalPayroll: number;
  luxuryTaxThreshold: number;
  firstApron: number;
  secondApron: number;
  capSpace: number;
  midLevelException: number;
  biAnnualException: number;
  taxpayerMLE: number;
  isOverCap: boolean;
  isInLuxuryTax: boolean;
}
