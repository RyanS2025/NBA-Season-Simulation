import { v4 as uuid } from 'uuid'
import { metaDB } from './meta-db'
import { openLeagueDB, deleteLeagueDB } from './league-db'
import type { LeagueDB, LeagueState } from './league-db'
import type { LeagueMeta, LeagueSettings, Team, Player, ContractInfo, DraftPickAsset } from '../types'

const MAX_LEAGUES = 10

export async function listLeagues(): Promise<LeagueMeta[]> {
  return metaDB.leagues.orderBy('lastSavedAt').reverse().toArray()
}

export async function getLeagueCount(): Promise<number> {
  return metaDB.leagues.count()
}

export async function canCreateLeague(): Promise<boolean> {
  return (await getLeagueCount()) < MAX_LEAGUES
}

export interface CreateLeagueOptions {
  name: string
  userTeamId: string
  settings: LeagueSettings
  teams: Team[]
  players: Player[]
  contracts: ContractInfo[]
  draftPicks: DraftPickAsset[]
  startDate: string
  seasonYear: number
}

export async function createLeague(opts: CreateLeagueOptions): Promise<{ leagueId: string; db: LeagueDB }> {
  if (!(await canCreateLeague())) {
    throw new Error(`Maximum of ${MAX_LEAGUES} leagues reached. Delete a league first.`)
  }

  const leagueId = uuid()
  const now = new Date().toISOString()

  const userTeam = opts.teams.find(t => t.id === opts.userTeamId)
  const meta: LeagueMeta = {
    id: leagueId,
    name: opts.name,
    createdAt: now,
    lastSavedAt: now,
    userTeamId: opts.userTeamId,
    userTeamName: userTeam ? `${userTeam.info.city} ${userTeam.info.name}` : 'Unknown',
    currentSeason: opts.seasonYear,
    currentPhase: 'preseason',
  }

  await metaDB.leagues.add(meta)

  const db = openLeagueDB(leagueId)

  const leagueState: LeagueState = {
    id: 'singleton',
    leagueId,
    leagueName: opts.name,
    currentSeason: opts.seasonYear,
    currentDate: opts.startDate,
    currentPhase: 'preseason',
    userTeamId: opts.userTeamId,
    settings: opts.settings,
    seasonHistory: [],
  }

  await db.transaction('rw',
    [db.leagueState, db.teams, db.players, db.contracts, db.draftPicks],
    async () => {
      await db.leagueState.add(leagueState)
      await db.teams.bulkAdd(opts.teams)
      await db.players.bulkAdd(opts.players)
      await db.contracts.bulkAdd(opts.contracts)
      if (opts.draftPicks.length > 0) {
        await db.draftPicks.bulkAdd(opts.draftPicks)
      }
    }
  )

  return { leagueId, db }
}

export async function loadLeague(leagueId: string): Promise<LeagueDB> {
  const meta = await metaDB.leagues.get(leagueId)
  if (!meta) {
    throw new Error(`League ${leagueId} not found`)
  }
  return openLeagueDB(leagueId)
}

export async function saveLeagueMeta(leagueId: string, updates: Partial<LeagueMeta>): Promise<void> {
  await metaDB.leagues.update(leagueId, {
    ...updates,
    lastSavedAt: new Date().toISOString(),
  })
}

export async function deleteLeague(leagueId: string): Promise<void> {
  await deleteLeagueDB(leagueId)
  await metaDB.leagues.delete(leagueId)
}

export async function getLeagueState(db: LeagueDB): Promise<LeagueState> {
  const state = await db.leagueState.get('singleton')
  if (!state) {
    throw new Error('League state not found')
  }
  return state
}

export async function updateLeagueState(db: LeagueDB, updates: Partial<LeagueState>): Promise<void> {
  await db.leagueState.update('singleton', updates)
}

export async function getAllTeams(db: LeagueDB): Promise<Team[]> {
  return db.teams.toArray()
}

export async function getTeam(db: LeagueDB, teamId: string): Promise<Team | undefined> {
  return db.teams.get(teamId)
}

export async function updateTeam(db: LeagueDB, team: Team): Promise<void> {
  await db.teams.put(team)
}

export async function getAllPlayers(db: LeagueDB): Promise<Player[]> {
  return db.players.toArray()
}

export async function getPlayer(db: LeagueDB, playerId: string): Promise<Player | undefined> {
  return db.players.get(playerId)
}

export async function getTeamPlayers(db: LeagueDB, teamId: string): Promise<Player[]> {
  return db.players.where('status.teamId').equals(teamId).toArray()
}

export async function updatePlayer(db: LeagueDB, player: Player): Promise<void> {
  await db.players.put(player)
}

export async function updatePlayers(db: LeagueDB, players: Player[]): Promise<void> {
  await db.players.bulkPut(players)
}

export async function getTeamContracts(db: LeagueDB, teamId: string): Promise<ContractInfo[]> {
  return db.contracts.where('teamId').equals(teamId).toArray()
}

export async function updateContract(db: LeagueDB, contract: ContractInfo): Promise<void> {
  await db.contracts.put(contract)
}

export async function addTransaction(db: LeagueDB, transaction: import('../types').Transaction): Promise<void> {
  await db.transactions.add(transaction)
}

export async function getTransactions(db: LeagueDB, seasonYear: number): Promise<import('../types').Transaction[]> {
  return db.transactions.where('seasonYear').equals(seasonYear).reverse().sortBy('date')
}

export async function getGamesOnDate(db: LeagueDB, date: string): Promise<import('../types').Game[]> {
  return db.games.where('date').equals(date).toArray()
}

export async function addGames(db: LeagueDB, games: import('../types').Game[]): Promise<void> {
  await db.games.bulkAdd(games)
}

export async function addGameResult(db: LeagueDB, gameId: string, date: string, seasonYear: number, result: import('../types').GameResult): Promise<void> {
  await db.gameResults.add({ gameId, date, seasonYear, result })
  await db.games.update(gameId, { result, status: 'final' })
}
