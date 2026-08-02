import type { CBAConstants } from './contract';

export interface League {
  id: string;
  name: string;
  createdAt: string;
  lastSavedAt: string;
  settings: LeagueSettings;
  currentSeason: number;
  userTeamId: string;
  cbaConstants: CBAConstants;
  seasonHistory: SeasonSummary[];
}

export interface LeagueSettings {
  injuriesEnabled: boolean;
  fatigueEnabled: boolean;
  cbaRulesEnabled: boolean;
  tradeDeadlineEnabled: boolean;
  storylinesEnabled: boolean;
  playerDevelopmentEnabled: boolean;
  moraleEnabled: boolean;
  allStarWeekendEnabled: boolean;
  backgroundTradesEnabled: boolean;
  draftLotteryEnabled: boolean;
  simulationSpeed: "instant" | "fast" | "detailed";
  difficulty: "easy" | "normal" | "hard" | "legendary";
  playoffFormat: "traditional_16" | "play_in";
  injuryFrequency: "rare" | "normal" | "frequent" | "brutal";
  tradeFrequency: "rare" | "normal" | "frequent";
  gamesPerSeason: 82 | 72 | 58;
  salaryCapMultiplier: number;
  quarterLengthMinutes: number;
  draftRounds: 2;
  autoStopPoints: AutoStopConfig;
}

export interface AutoStopConfig {
  extensionDeadline: boolean;
  tradeDeadline: boolean;
  allStarBreak: boolean;
  playoffsStart: boolean;
  draftLottery: boolean;
  draftNight: boolean;
  freeAgency: boolean;
}

export type SeasonPhase =
  | "preseason"
  | "regular_season"
  | "extension_deadline"
  | "trade_deadline"
  | "all_star_break"
  | "regular_season_post_deadline"
  | "awards_voting"
  | "playoffs"
  | "champion"
  | "draft_lottery"
  | "draft"
  | "free_agency"
  | "coaching_carousel"
  | "offseason";

export interface SeasonSummary {
  year: number;
  championTeamId: string;
  finalistTeamId: string;
  mvpPlayerId: string;
  rotyPlayerId: string | null;
  topScorerPlayerId: string;
  topScorerPPG: number;
}

export interface SeasonAwards {
  mvp: string;
  dpoy: string;
  roty: string;
  sixthMan: string;
  mip: string;
  coty: string;
  eoty: string;
  clutchPoy: string;
  allNBA: {
    first: string[];
    second: string[];
    third: string[];
  };
  allDefensive: {
    first: string[];
    second: string[];
  };
  allRookie: {
    first: string[];
    second: string[];
  };
  finalsMvp: string | null;
  allStarMvp: string | null;
}

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  details: Record<string, unknown>;
  description: string;
  seasonYear: number;
}

export type TransactionType =
  | "trade"
  | "draft"
  | "signing"
  | "waiver"
  | "release"
  | "two_way_conversion"
  | "extension"
  | "option_exercised"
  | "option_declined"
  | "injured_reserve"
  | "recalled"
  | "buyout"
  | "ten_day_signing"
  | "staff_hire"
  | "staff_fire"
  | "staff_resign"
  | "staff_extension";

export interface LeagueMeta {
  id: string;
  name: string;
  createdAt: string;
  lastSavedAt: string;
  userTeamId: string;
  userTeamName: string;
  currentSeason: number;
  currentPhase: SeasonPhase;
}
