export { metaDB } from './meta-db'
export { openLeagueDB, deleteLeagueDB } from './league-db'
export type { LeagueDB, LeagueState, PlayerSeasonStats, StoredGameResult, AwardRecord, HallOfFameEntry, RetiredPlayer, AllStarRecord, PreseasonProjection } from './league-db'
export {
  listLeagues,
  getLeagueCount,
  canCreateLeague,
  createLeague,
  loadLeague,
  saveLeagueMeta,
  deleteLeague,
  getLeagueState,
  updateLeagueState,
  getAllTeams,
  getTeam,
  updateTeam,
  getAllPlayers,
  getPlayer,
  getTeamPlayers,
  updatePlayer,
  updatePlayers,
  getTeamContracts,
  updateContract,
  addTransaction,
  getTransactions,
  getGamesOnDate,
  addGames,
  addGameResult,
} from './league-manager'
export type { CreateLeagueOptions } from './league-manager'
export { useLeagueDB } from './use-league-db'
