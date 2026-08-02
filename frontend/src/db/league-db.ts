import Dexie, { type EntityTable } from 'dexie'
import type {
  Player,
  Team,
  ContractInfo,
  Game,
  GameResult,
  Transaction,
  SeasonAwards,
  DraftPickAsset,
  LeagueSettings,
  StoredStaffMember,
  StaffMarketEntry,
  AwardsSeasonState,
} from '../types'

export interface LeagueState {
  id: 'singleton'
  leagueId: string
  leagueName: string
  currentSeason: number
  currentDate: string
  currentPhase: string
  userTeamId: string
  settings: LeagueSettings
}

export interface PlayerSeasonStats {
  id: string
  playerId: string
  seasonYear: number
  teamId: string
  gamesPlayed: number
  gamesStarted: number
  minutesPerGame: number
  pointsPerGame: number
  reboundsPerGame: number
  assistsPerGame: number
  stealsPerGame: number
  blocksPerGame: number
  turnoversPerGame: number
  fieldGoalPct: number
  threePointPct: number
  freeThrowPct: number
  plusMinusPerGame: number
  playerEfficiencyRating: number
}

export interface StoredGameResult {
  gameId: string
  date: string
  seasonYear: number
  result: GameResult
}

export interface AwardRecord {
  seasonYear: number
  awards: SeasonAwards
}

export interface HallOfFameEntry {
  playerId: string
  playerName: string
  inductionYear: number
  careerStats: Record<string, number>
  accolades: string[]
}

export interface RetiredPlayer {
  playerId: string
  playerName: string
  retirementYear: number
  lastTeamId: string
  careerStats: Record<string, number>
  accolades: string[]
}

export interface AllStarRecord {
  seasonYear: number
  starters: { east: string[]; west: string[] }
  reserves: { east: string[]; west: string[] }
  gameResult: GameResult | null
  gameMvpId: string | null
  contestWinners: Record<string, string>
}

export interface PreseasonProjection {
  seasonYear: number
  teamId: string
  projectedWins: number
}

class LeagueDB extends Dexie {
  leagueState!: EntityTable<LeagueState, 'id'>
  teams!: EntityTable<Team, 'id'>
  players!: EntityTable<Player, 'id'>
  contracts!: EntityTable<ContractInfo, 'id'>
  games!: EntityTable<Game, 'id'>
  gameResults!: EntityTable<StoredGameResult, 'gameId'>
  playerSeasonStats!: EntityTable<PlayerSeasonStats, 'id'>
  draftPicks!: EntityTable<DraftPickAsset, 'year'>
  transactions!: EntityTable<Transaction, 'id'>
  awards!: EntityTable<AwardRecord, 'seasonYear'>
  hallOfFame!: EntityTable<HallOfFameEntry, 'playerId'>
  retiredPlayers!: EntityTable<RetiredPlayer, 'playerId'>
  allStarHistory!: EntityTable<AllStarRecord, 'seasonYear'>
  preseasonProjections!: EntityTable<PreseasonProjection, 'seasonYear'>
  staff!: EntityTable<StoredStaffMember, 'id'>
  staffMarket!: EntityTable<StaffMarketEntry, 'id'>
  awardsSeasonState!: EntityTable<AwardsSeasonState, 'seasonYear'>

  constructor(leagueId: string) {
    super(`bbalsim_league_${leagueId}`)

    this.version(1).stores({
      leagueState: 'id',
      teams: 'id, [info.conference], [info.division]',
      players: 'id, [bio.position], [status.teamId]',
      contracts: 'id, playerId, teamId, [teamId+contract_type]',
      games: 'id, date, [homeTeamId+date], [awayTeamId+date], [date+isPlayoff]',
      gameResults: 'gameId, date, seasonYear',
      playerSeasonStats: 'id, [playerId+seasonYear], playerId, seasonYear, teamId',
      draftPicks: '++, year, [year+round], originalTeamId, currentOwnerTeamId',
      transactions: 'id, date, transactionType, seasonYear',
      awards: 'seasonYear',
      hallOfFame: 'playerId, inductionYear',
      retiredPlayers: 'playerId, retirementYear',
      allStarHistory: 'seasonYear',
      preseasonProjections: '++, [seasonYear+teamId], seasonYear',
    })

    this.version(2).stores({
      leagueState: 'id',
      teams: 'id, [info.conference], [info.division]',
      players: 'id, [bio.position], [status.teamId]',
      contracts: 'id, playerId, teamId, [teamId+contract_type]',
      games: 'id, date, [homeTeamId+date], [awayTeamId+date], [date+isPlayoff]',
      gameResults: 'gameId, date, seasonYear',
      playerSeasonStats: 'id, [playerId+seasonYear], playerId, seasonYear, teamId',
      draftPicks: '++, year, [year+round], originalTeamId, currentOwnerTeamId',
      transactions: 'id, date, transactionType, seasonYear',
      awards: 'seasonYear',
      hallOfFame: 'playerId, inductionYear',
      retiredPlayers: 'playerId, retirementYear',
      allStarHistory: 'seasonYear',
      preseasonProjections: '++, [seasonYear+teamId], seasonYear',
      staff: 'id, staffType, teamId, [teamId+staffType]',
      staffMarket: 'id, staffType, marketStatus',
      awardsSeasonState: 'seasonYear',
    })
  }
}

export function openLeagueDB(leagueId: string): LeagueDB {
  return new LeagueDB(leagueId)
}

export async function deleteLeagueDB(leagueId: string): Promise<void> {
  await Dexie.delete(`bbalsim_league_${leagueId}`)
}

export type { LeagueDB }
