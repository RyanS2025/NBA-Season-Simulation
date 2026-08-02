import type { Player } from './player';
import type { Team } from './team';
import type { Game, GameResult } from './game';
import type { ContractInfo, CBAConstants, TradePackage } from './contract';
import type { LeagueSettings, SeasonAwards, SeasonPhase } from './league';

export interface SimWorkerRequestEnvelope {
  requestId: string;
  request: SimWorkerRequest;
}

export interface SimWorkerResponseEnvelope {
  requestId: string;
  response: SimWorkerResponse;
}

export type SimWorkerRequest =
  | { type: "INIT"; payload: { engineCode: string } }
  | { type: "SIMULATE_GAME"; payload: SimulateGamePayload }
  | { type: "SIMULATE_GAMES_BATCH"; payload: SimulateGamesBatchPayload }
  | { type: "SIMULATE_TO_DATE"; payload: SimulateToDatePayload }
  | { type: "SIMULATE_DEADLINE_HOUR"; payload: SimulateDeadlineHourPayload }
  | { type: "EVALUATE_TRADE"; payload: EvaluateTradePayload }
  | { type: "VALIDATE_TRADE"; payload: ValidateTradePayload }
  | { type: "RUN_DRAFT"; payload: RunDraftPayload }
  | { type: "RUN_DRAFT_LOTTERY"; payload: RunDraftLotteryPayload }
  | { type: "RUN_FREE_AGENCY"; payload: RunFreeAgencyPayload }
  | { type: "RUN_ALLSTAR_WEEKEND"; payload: RunAllStarWeekendPayload }
  | { type: "ADVANCE_OFFSEASON"; payload: AdvanceOffseasonPayload }
  | { type: "COMPUTE_CAP_SHEET"; payload: ComputeCapSheetPayload }
  | { type: "COMPUTE_AWARDS"; payload: ComputeAwardsPayload }
  | { type: "GENERATE_SCHEDULE"; payload: GenerateSchedulePayload }
  | { type: "PLAYER_DEVELOPMENT"; payload: PlayerDevelopmentPayload }
  | { type: "GENERATE_LEAGUE_ACTIVITY"; payload: GenerateLeagueActivityPayload }
  | { type: "CHECK_RETIREMENTS"; payload: CheckRetirementsPayload }
  | { type: "CHECK_HOF_ELIGIBILITY"; payload: CheckHofEligibilityPayload }
  | { type: "CANCEL"; payload: { requestId: string } };

export type SimWorkerResponse =
  | { type: "INIT_COMPLETE"; success: boolean; error?: string }
  | { type: "GAME_RESULT"; payload: GameResult }
  | { type: "GAMES_BATCH_RESULT"; payload: GameResult[] }
  | { type: "TRADE_EVALUATION"; payload: TradeEvaluation }
  | { type: "TRADE_VALIDATION"; payload: TradeValidation }
  | { type: "DRAFT_RESULTS"; payload: DraftResults }
  | { type: "DRAFT_LOTTERY_RESULTS"; payload: DraftLotteryResults }
  | { type: "FREE_AGENCY_RESULTS"; payload: FreeAgencyResults }
  | { type: "ALLSTAR_RESULTS"; payload: AllStarResults }
  | { type: "CAP_SHEET"; payload: CapSheet }
  | { type: "AWARDS"; payload: SeasonAwards }
  | { type: "SCHEDULE"; payload: Game[] }
  | { type: "DEVELOPMENT_RESULTS"; payload: PlayerDevelopmentResult[] }
  | { type: "LEAGUE_ACTIVITY_RESULTS"; payload: LeagueActivityResults }
  | { type: "RETIREMENT_RESULTS"; payload: RetirementResults }
  | { type: "HOF_RESULTS"; payload: HofResults }
  | { type: "DEADLINE_HOUR_RESULTS"; payload: DeadlineHourResults }
  | { type: "PROGRESS"; payload: { percent: number; message: string } }
  | { type: "ERROR"; payload: { code: string; message: string } };

export interface SimulateGamePayload {
  homeTeam: Team;
  awayTeam: Team;
  homePlayers: Player[];
  awayPlayers: Player[];
  settings: LeagueSettings;
  isPlayoff: boolean;
  neutralSite: boolean;
}

export interface SimulateGamesBatchPayload {
  games: SimulateGamePayload[];
}

export interface SimulateToDatePayload {
  targetDate: string;
  allTeams: Team[];
  allPlayers: Player[];
  schedule: Game[];
  settings: LeagueSettings;
}

export interface SimulateDeadlineHourPayload {
  hour: number;
  allTeams: Team[];
  allPlayers: Player[];
  settings: LeagueSettings;
  cba: CBAConstants;
}

export interface EvaluateTradePayload {
  trade: TradePackage;
  allTeams: Team[];
  allPlayers: Player[];
  cba: CBAConstants;
  settings: LeagueSettings;
}

export interface ValidateTradePayload {
  trade: TradePackage;
  cba: CBAConstants;
  teams: Team[];
  contracts: ContractInfo[];
}

export interface RunDraftPayload {
  draftClass: Player[];
  draftOrder: { round: number; pick: number; teamId: string }[];
  allTeams: Team[];
  settings: LeagueSettings;
  userTeamId: string;
}

export interface RunDraftLotteryPayload {
  nonPlayoffTeams: { teamId: string; wins: number; losses: number }[];
}

export interface RunFreeAgencyPayload {
  freeAgents: Player[];
  allTeams: Team[];
  cba: CBAConstants;
  settings: LeagueSettings;
  userTeamId: string;
}

export interface RunAllStarWeekendPayload {
  allTeams: Team[];
  allPlayers: Player[];
  seasonStats: Record<string, PlayerSeasonStatline>;
  settings: LeagueSettings;
}

export interface AdvanceOffseasonPayload {
  allTeams: Team[];
  allPlayers: Player[];
  settings: LeagueSettings;
  cba: CBAConstants;
}

export interface ComputeCapSheetPayload {
  teamId: string;
  contracts: ContractInfo[];
  cba: CBAConstants;
}

export interface ComputeAwardsPayload {
  allTeams: Team[];
  allPlayers: Player[];
  seasonStats: Record<string, PlayerSeasonStatline>;
  settings: LeagueSettings;
  preseasonProjections: Record<string, number>;
}

export interface GenerateSchedulePayload {
  teams: { id: string; conference: string; division: string }[];
  gamesPerSeason: number;
  startDate: string;
}

export interface PlayerDevelopmentPayload {
  players: Player[];
  settings: LeagueSettings;
}

export interface GenerateLeagueActivityPayload {
  allTeams: Team[];
  allPlayers: Player[];
  cba: CBAConstants;
  settings: LeagueSettings;
  currentDate: string;
  phase: SeasonPhase;
}

export interface CheckRetirementsPayload {
  allPlayers: Player[];
}

export interface CheckHofEligibilityPayload {
  retiredPlayers: Player[];
  existingHofIds: string[];
}

export interface TradeEvaluation {
  isValid: boolean;
  fairnessScore: number;
  cpuWillAccept: boolean;
  cpuRejectionReason: string | null;
  salaryValidation: TradeValidation;
}

export interface TradeValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  salaryBreakdown: Record<string, {
    outgoing: number;
    incoming: number;
    newPayroll: number;
    newTaxSituation: string;
  }>;
}

export interface DraftResults {
  picks: { round: number; pick: number; teamId: string; playerId: string }[];
  undraftedPlayerIds: string[];
}

export interface DraftLotteryResults {
  order: { teamId: string; originalPosition: number; lotteryPosition: number }[];
}

export interface FreeAgencyResults {
  signings: {
    playerId: string;
    teamId: string;
    contract: ContractInfo;
  }[];
  remainingFreeAgentIds: string[];
}

export interface AllStarResults {
  starters: { east: string[]; west: string[] };
  reserves: { east: string[]; west: string[] };
  threePointContestWinner: string;
  dunkContestWinner: string;
  skillsChallengeWinner: string;
  gameResult: GameResult;
  gameMvpId: string;
}

export interface CapSheet {
  teamId: string;
  totalSalary: number;
  capSpace: number;
  luxuryTaxAmount: number;
  exceptions: {
    midLevel: { available: boolean; remaining: number };
    biAnnual: { available: boolean; remaining: number };
    taxpayerMLE: { available: boolean; remaining: number };
  };
  isHardCapped: boolean;
  hardCapAmount: number | null;
  projectedNextYearSalary: number;
}

export interface PlayerDevelopmentResult {
  playerId: string;
  ratingChanges: Record<string, number>;
  newOverall: number;
  narrative: string;
}

export interface LeagueActivityResults {
  trades: TradePackage[];
  signings: { playerId: string; teamId: string; contract: ContractInfo }[];
  waivings: { playerId: string; teamId: string }[];
  injuryUpdates: { playerId: string; update: string }[];
}

export interface DeadlineHourResults {
  hour: number;
  trades: TradePackage[];
  newsItems: string[];
}

export interface RetirementResults {
  retiredPlayerIds: string[];
  narratives: Record<string, string>;
}

export interface HofResults {
  inducteeIds: string[];
  narratives: Record<string, string>;
}

export interface PlayerSeasonStatline {
  playerId: string;
  seasonYear: number;
  teamId: string;
  gamesPlayed: number;
  gamesStarted: number;
  minutesPerGame: number;
  pointsPerGame: number;
  reboundsPerGame: number;
  assistsPerGame: number;
  stealsPerGame: number;
  blocksPerGame: number;
  turnoversPerGame: number;
  fieldGoalPct: number;
  threePointPct: number;
  freeThrowPct: number;
  plusMinusPerGame: number;
  playerEfficiencyRating: number;
}
