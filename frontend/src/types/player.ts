import type { ContractInfo } from './contract';

export type Position = "PG" | "SG" | "SF" | "PF" | "C";

export type ShotZoneId =
  | "restricted_area"
  | "paint_non_ra"
  | "midrange_left_baseline"
  | "midrange_left_wing"
  | "midrange_center"
  | "midrange_right_wing"
  | "midrange_right_baseline"
  | "three_left_corner"
  | "three_left_wing"
  | "three_center"
  | "three_right_wing"
  | "three_right_corner"
  | "backcourt"
  | "post_up";

export type InjuryType =
  | "sprain"
  | "strain"
  | "fracture"
  | "tear"
  | "contusion"
  | "concussion"
  | "soreness"
  | "inflammation"
  | "dislocation";

export type BodyPart =
  | "ankle"
  | "knee"
  | "shoulder"
  | "back"
  | "wrist"
  | "hand"
  | "foot"
  | "hamstring"
  | "groin"
  | "calf"
  | "head"
  | "hip"
  | "quad"
  | "elbow"
  | "finger"
  | "thumb"
  | "rib"
  | "achilles";

export interface PlayerBio {
  firstName: string;
  lastName: string;
  position: Position;
  secondaryPosition: Position | null;
  height: number;
  weight: number;
  age: number;
  yearsInLeague: number;
  college: string | null;
  country: string;
  draftYear: number;
  draftRound: number;
  draftPick: number;
  jerseyNumber: number;
  hand: "L" | "R";
}

export interface PlayerRatings {
  finishing: number;
  closeRange: number;
  midRange: number;
  threePoint: number;
  freeThrow: number;
  postGame: number;
  drawFoul: number;
  offBallMovement: number;
  ballHandling: number;
  passingVision: number;
  passingAccuracy: number;
  perimeterDefense: number;
  interiorDefense: number;
  shotBlocking: number;
  stealing: number;
  defensiveIQ: number;
  defensiveConsistency: number;
  speed: number;
  acceleration: number;
  lateralQuickness: number;
  vertical: number;
  strength: number;
  stamina: number;
  basketballIQ: number;
  offensiveIQ: number;
  rebounding: number;
  offensiveRebounding: number;
  hustle: number;
  overall: number;
  potential: number;
  peakAge: number;
}

export interface ShotZone {
  zoneId: ShotZoneId;
  tendency: number;
  makeRate: number;
}

export interface ShotChartProfile {
  zones: ShotZone[];
}

export interface PlayerTendencies {
  pullUpFrequency: number;
  catchAndShootFrequency: number;
  driveFrequency: number;
  postUpFrequency: number;
  isoFrequency: number;
  pickAndRollBallHandler: number;
  pickAndRollScreener: number;
  spotUpFrequency: number;
  transitionFrequency: number;
  cutFrequency: number;
  passOutOfDriveRate: number;
  skipPassRate: number;
  alleyOopPassRate: number;
  gambleForSteals: number;
  helpDefenseRate: number;
  closeoutAggression: number;
  boxOutRate: number;
  usageDesire: number;
  pacePreference: number;
  foulProneness: number;
  shotClockTendency: number;
  contestedShotWillingness: number;
}

export interface CharacterTraits {
  leadership: number;
  workEthic: number;
  clutch: number;
  ego: number;
  coachability: number;
  temperament: number;
  fanFavorite: number;
  mediaPersonality: number;
  loyalty: number;
  competitiveness: number;
}

export interface InjuryRecord {
  type: InjuryType;
  severity: "minor" | "moderate" | "severe" | "season_ending";
  gamesOut: number;
  seasonYear: number;
  bodyPart: BodyPart;
}

export interface DurabilityProfile {
  overallDurability: number;
  ankleHealth: number;
  kneeHealth: number;
  shoulderHealth: number;
  backHealth: number;
  wristHandHealth: number;
  footHealth: number;
  concussionRisk: number;
  softTissueRisk: number;
  injuryHistory: InjuryRecord[];
}

export interface ActiveInjury {
  bodyPart: BodyPart;
  type: InjuryType;
  severity: "minor" | "moderate" | "severe" | "season_ending";
  gamesRemaining: number;
  dateInjured: string;
}

export interface PlayerStatus {
  health: "healthy" | "day_to_day" | "out" | "injured_reserve";
  currentInjury: ActiveInjury | null;
  fatigue: number;
  morale: number;
  isRookie: boolean;
  isFreeAgent: boolean;
  isRestrictedFA: boolean;
  teamId: string | null;
}

export interface Player {
  id: string;
  bio: PlayerBio;
  ratings: PlayerRatings;
  shotChart: ShotChartProfile;
  tendencies: PlayerTendencies;
  character: CharacterTraits;
  durability: DurabilityProfile;
  contract: ContractInfo | null;
  status: PlayerStatus;
}
