export type OffensiveScheme =
  | "motion"
  | "iso_heavy"
  | "pick_and_roll"
  | "triangle"
  | "pace_and_space"
  | "princeton"
  | "drive_and_kick";

export type DefensiveScheme =
  | "man_to_man"
  | "switching"
  | "drop_coverage"
  | "blitz"
  | "zone_2_3"
  | "zone_3_2"
  | "pack_the_paint";

export type PlayoffResult =
  | "missed_playoffs"
  | "first_round"
  | "second_round"
  | "conference_finals"
  | "finals_lost"
  | "champion";

export interface Coach {
  name: string;
  offenseRating: number;
  defenseRating: number;
  playerDevelopment: number;
  motivation: number;
  adaptability: number;
  experience: number;
}

export interface CoachingStaff {
  headCoach: Coach;
  offensiveScheme: OffensiveScheme;
  defensiveScheme: DefensiveScheme;
  pacePreference: number;
  threePointEmphasis: number;
  starterMinutes: [number, number, number, number, number];
  /** Per-player minutes set by the user on the Coaching page (playerId -> minutes). */
  rotationMinutes?: Record<string, number>;
  /** When true the sim uses rotationMinutes instead of auto-assigning by skill. */
  manualRotation?: boolean;
}

export interface TeamInfo {
  city: string;
  name: string;
  abbreviation: string;
  conference: "Eastern" | "Western";
  division: string;
  primaryColor: string;
  secondaryColor: string;
  arenaName: string;
  arenaCapacity: number;
  marketSize: number;
}

export interface RosterSlot {
  playerId: string;
  rosterStatus: "active" | "inactive" | "two_way" | "g_league";
  lineupPosition: number;
}

export interface TradeException {
  id: string;
  amount: number;
  expirationDate: string;
  sourcePlayerId: string;
}

export interface CapHold {
  playerId: string;
  amount: number;
  type: "bird" | "early_bird" | "non_bird" | "draft_pick" | "unsigned_first_round";
}

export interface DraftPickProtection {
  type: "top" | "lottery" | "range";
  value: number;
  fallbackYear: number | null;
  fallbackProtections: DraftPickProtection[] | null;
}

export interface DraftPickAsset {
  year: number;
  round: 1 | 2;
  originalTeamId: string;
  currentOwnerTeamId: string;
  protections: DraftPickProtection[];
  isSwapRight: boolean;
}

export interface TeamFinances {
  salaryCap: number;
  totalPayroll: number;
  luxuryTaxThreshold: number;
  firstApronThreshold: number;
  secondApronThreshold: number;
  isOverCap: boolean;
  isInLuxuryTax: boolean;
  isAboveFirstApron: boolean;
  isAboveSecondApron: boolean;
  taxBill: number;
  tradeExceptions: TradeException[];
  capHolds: CapHold[];
  draftPicks: DraftPickAsset[];
}

export interface SeasonRecord {
  wins: number;
  losses: number;
  conferenceWins: number;
  conferenceLosses: number;
  divisionWins: number;
  divisionLosses: number;
  homeWins: number;
  homeLosses: number;
  awayWins: number;
  awayLosses: number;
  streak: number;
  last10Wins: number;
  last10Losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface TeamSeasonHistory {
  year: number;
  wins: number;
  losses: number;
  playoffResult: PlayoffResult;
  mvpId: string | null;
}

export interface Team {
  id: string;
  info: TeamInfo;
  roster: RosterSlot[];
  coaching: CoachingStaff;
  finances: TeamFinances;
  chemistry: number;
  homeCourtAdvantage: number;
  seasonRecord: SeasonRecord;
  history: TeamSeasonHistory[];
  staff: import('./staff').StaffRoster | null;
  teamPersonality: import('./staff').TeamPersonality | null;
}
