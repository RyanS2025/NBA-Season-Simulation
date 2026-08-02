import type { ShotZoneId } from './player';

export interface Game {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  seasonYear: number;
  gameNumber: number;
  gameType: "regular_season" | "playoff" | "allstar" | "preseason";
  playoffSeries: PlayoffSeriesRef | null;
  date: string;
  status: "scheduled" | "in_progress" | "final";
  result: GameResult | null;
}

export interface GameResult {
  homeScore: number;
  awayScore: number;
  overtime: number;
  winningTeamId: string;
  homeBoxScore: TeamBoxScore;
  awayBoxScore: TeamBoxScore;
  quarterScores: {
    home: number[];
    away: number[];
  };
}

export interface TeamBoxScore {
  teamId: string;
  playerStats: PlayerGameStats[];
  teamStats: TeamGameStats;
}

export interface PlayerGameStats {
  playerId: string;
  minutes: number;
  points: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  totalRebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  personalFouls: number;
  plusMinus: number;
  shotChart: ShotAttempt[];
}

export interface ShotAttempt {
  zoneId: ShotZoneId;
  made: boolean;
  assisted: boolean;
  assistedByPlayerId: string | null;
  quarter: number;
  isContested: boolean;
  shotType: "jumper" | "layup" | "dunk" | "floater" | "hook" | "fadeaway" | "tip_in" | "heave";
}

export interface TeamGameStats {
  fastBreakPoints: number;
  pointsInPaint: number;
  secondChancePoints: number;
  benchPoints: number;
  turnovers: number;
  teamRebounds: number;
  biggestLead: number;
  pace: number;
}

export interface PlayoffSeriesRef {
  seriesId: string;
  round: 1 | 2 | 3 | 4;
  higherSeedTeamId: string;
  lowerSeedTeamId: string;
  higherSeedWins: number;
  lowerSeedWins: number;
  gameNumberInSeries: number;
}
