import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import { useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { openLeagueDB } from '../db/league-db'
import type { LeagueDB, LeagueState } from '../db/league-db'
import {
  getLeagueState,
  updateLeagueState,
  getAllTeams,
  getAllPlayers,
  saveLeagueMeta,
  addGameResult,
  addTransaction,
} from '../db/league-manager'
import { quickSimGame } from '../utils/quick-sim'
import { accumulateGameStats } from '../utils/stat-accumulator'
import { simulateEntirePlayoffs, type PlayoffResults } from '../utils/playoff-sim'
import { validateTrade, computeTeamPayroll } from '../utils/cba-engine'
import { runPlayerDevelopment } from '../utils/offseason-engine'
import { generateSeasonSchedule } from '../utils/schedule-generator'
import type { Team, Game, GameResult, Player, Transaction } from '../types'
import type { SeasonPhase, LeagueSettings } from '../types'
import type { TradeValidationResult } from '../utils/cba-engine'
import { generateBackgroundTrades } from '../utils/cpu-trade-ai'
import { updateHotSeat, evaluateCoachesForFiring, generateCoachMarketplace, cpuHireCoaches } from '../utils/coaching-carousel'
import {
  loadDraftClassFromJSON,
  generateDraftClass,
  runDraftLottery,
  buildDraftOrder,
  cpuAutoPick,
  convertProspectToPlayer,
  getCpuPickAnalysis,
} from '../utils/draft-engine'
import type { DraftProspect, DraftPick, DraftLotteryResult } from '../utils/draft-engine'
import type { HeadCoach, StaffRoster } from '../types/staff'

export interface DraftState {
  prospects: DraftProspect[]
  draftOrder: DraftPick[]
  lotteryResults: DraftLotteryResult[]
  currentPickIndex: number
  completedPicks: (DraftPick & { analysis?: string })[]
  isActive: boolean
}

export interface LeagueContextValue {
  db: LeagueDB | null
  state: LeagueState | null
  teams: Team[]
  players: Player[]
  loading: boolean
  error: string | null
  simming: boolean
  simProgress: string | null
  draftState: DraftState | null

  playoffResults: PlayoffResults | null

  simDay: () => Promise<void>
  simWeek: () => Promise<void>
  simToDate: (targetDate: string) => Promise<void>
  simSeason: () => Promise<void>
  simPlayoffs: () => Promise<void>
  refreshState: () => Promise<void>
  refreshTeams: () => Promise<void>
  executeTrade: (
    outPlayerIds: string[],
    inPlayerIds: string[],
    partnerTeamId: string,
  ) => Promise<TradeValidationResult & { executed: boolean }>
  signFreeAgent: (
    playerId: string,
    teamId: string,
    salary: number,
    years: number,
  ) => Promise<boolean>
  releasePlayer: (playerId: string) => Promise<boolean>
  advanceToNextSeason: () => Promise<boolean>
  updateSettings: (settings: LeagueSettings) => Promise<void>
  startDraft: () => Promise<void>
  userDraftPick: (prospectId: string) => Promise<void>
  advanceDraftPick: () => Promise<{ pick: DraftPick & { analysis?: string }; isUserNext: boolean } | null>
  completeDraft: () => Promise<void>
}

const LeagueContext = createContext<LeagueContextValue | null>(null)

export function LeagueProvider({ children }: { children: ReactNode }) {
  const { id: leagueId } = useParams<{ id: string }>()
  const dbRef = useRef<LeagueDB | null>(null)
  const [state, setState] = useState<LeagueState | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [simming, setSimming] = useState(false)
  const [simProgress, setSimProgress] = useState<string | null>(null)
  const [playoffResults, _setPlayoffResults] = useState<PlayoffResults | null>(null)
  const playoffResultsRef = useRef<PlayoffResults | null>(null)
  const updatePlayoffResults = useCallback((pr: PlayoffResults | null) => {
    playoffResultsRef.current = pr
    _setPlayoffResults(pr)
  }, [])
  const [draftState, _setDraftState] = useState<DraftState | null>(null)
  const draftStateRef = useRef<DraftState | null>(null)
  const updateDraftState = useCallback((ds: DraftState | null) => {
    draftStateRef.current = ds
    _setDraftState(ds)
  }, [])

  useEffect(() => {
    if (!leagueId) {
      setLoading(false)
      return
    }

    const db = openLeagueDB(leagueId)
    dbRef.current = db

    Promise.all([
      getLeagueState(db),
      getAllTeams(db),
      getAllPlayers(db),
    ])
      .then(([s, t, p]) => {
        setState(s)
        setTeams(t)
        setPlayers(p)
        if (s?.playoffResults) {
          updatePlayoffResults(s.playoffResults)
        }
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })

    return () => {
      db.close()
      dbRef.current = null
    }
  }, [leagueId])

  const refreshState = useCallback(async () => {
    const db = dbRef.current
    if (!db) return
    const s = await getLeagueState(db)
    setState(s)
  }, [])

  const refreshTeams = useCallback(async () => {
    const db = dbRef.current
    if (!db) return
    const t = await getAllTeams(db)
    setTeams(t)
  }, [])

  const refreshPlayers = useCallback(async () => {
    const db = dbRef.current
    if (!db) return
    const p = await getAllPlayers(db)
    setPlayers(p)
  }, [])

  const getTeamPlayers = useCallback(
    (teamId: string): Player[] => {
      return players.filter(p => p.teamId === teamId)
    },
    [players],
  )

  const simGames = useCallback(
    async (games: Game[]) => {
      const db = dbRef.current
      if (!db || !state) return

      const teamMap = new Map(teams.map(t => [t.id, t]))
      const statUpdatedPlayers = new Map<string, Player>()

      for (let i = 0; i < games.length; i++) {
        const game = games[i]
        setSimProgress(`Game ${i + 1}/${games.length}`)

        const homePlayers = getTeamPlayers(game.homeTeamId)
        const awayPlayers = getTeamPlayers(game.awayTeamId)

        const homeTeamData = teamMap.get(game.homeTeamId)
        const awayTeamData = teamMap.get(game.awayTeamId)
        const result = quickSimGame(game, homePlayers, awayPlayers, {
          homeStaff: homeTeamData?.staff ?? null,
          awayStaff: awayTeamData?.staff ?? null,
          homeCoaching: homeTeamData?.coaching ?? null,
          awayCoaching: awayTeamData?.coaching ?? null,
        })

        await addGameResult(db, game.id, game.date, state.currentSeason, result)

        if (game.gameType === 'regular_season') {
          const homeModified = accumulateGameStats(
            homePlayers, result, state.currentSeason,
            game.homeTeamId, homeTeamData?.info.abbreviation ?? '',
          )
          const awayModified = accumulateGameStats(
            awayPlayers, result, state.currentSeason,
            game.awayTeamId, awayTeamData?.info.abbreviation ?? '',
          )
          for (const p of homeModified) statUpdatedPlayers.set(p.id, p)
          for (const p of awayModified) statUpdatedPlayers.set(p.id, p)
        }

        const homeTeam = teamMap.get(game.homeTeamId)
        const awayTeam = teamMap.get(game.awayTeamId)

        if (homeTeam) {
          updateTeamRecord(homeTeam, result, game.homeTeamId, game.awayTeamId)
          const homeWon = result.homeScore > result.awayScore
          if (homeTeam.staff) {
            homeTeam.staff.headCoach.hotSeatLevel = updateHotSeat(homeTeam, homeWon)
          }
          await db.teams.put(homeTeam)
        }
        if (awayTeam) {
          updateTeamRecord(awayTeam, result, game.awayTeamId, game.homeTeamId)
          const awayWon = result.awayScore > result.homeScore
          if (awayTeam.staff) {
            awayTeam.staff.headCoach.hotSeatLevel = updateHotSeat(awayTeam, awayWon)
          }
          await db.teams.put(awayTeam)
        }
      }

      if (statUpdatedPlayers.size > 0) {
        await db.players.bulkPut([...statUpdatedPlayers.values()])
        await refreshPlayers()
      }
    },
    [teams, state, getTeamPlayers, refreshPlayers],
  )

  const advanceDate = useCallback(
    async (targetDate: string) => {
      const db = dbRef.current
      if (!db || !state) return

      await updateLeagueState(db, { currentDate: targetDate })
      if (leagueId) {
        await saveLeagueMeta(leagueId, {
          currentPhase: state.currentPhase as SeasonPhase,
          currentSeason: state.currentSeason,
        })
      }
      await refreshState()
      await refreshTeams()
    },
    [state, leagueId, refreshState, refreshTeams],
  )

  const checkSeasonEnd = useCallback(async () => {
    const db = dbRef.current
    if (!db || !state) return

    const remainingGames = await db.games
      .where('date')
      .aboveOrEqual(state.currentDate)
      .filter(g => g.status === 'scheduled' && g.gameType === 'regular_season')
      .count()

    if (remainingGames === 0 && state.currentPhase === 'regular_season') {
      await updateLeagueState(db, { currentPhase: 'playoffs' })
      if (leagueId) {
        await saveLeagueMeta(leagueId, { currentPhase: 'playoffs' })
      }
      await refreshState()
    }
  }, [state, leagueId, refreshState])

  const executeBackgroundTrades = useCallback(
    async (forDate: string) => {
      const db = dbRef.current
      if (!db || !state) return
      if (!state.settings.backgroundTradesEnabled) return

      const currentTeams = await getAllTeams(db)
      const currentPlayers = await getAllPlayers(db)
      const userTeamId = state.userTeamId

      const results = generateBackgroundTrades(
        currentTeams.filter(t => t.id !== userTeamId),
        currentPlayers,
        [],
        state.currentSeason,
        forDate,
        state.settings.tradeFrequency,
      )

      for (const result of results) {
        const { proposal } = result
        const t1Players = currentPlayers.filter(p => proposal.team1Players.includes(p.id))
        const t2Players = currentPlayers.filter(p => proposal.team2Players.includes(p.id))
        if (t1Players.length === 0 && t2Players.length === 0) continue

        const team1 = currentTeams.find(t => t.id === proposal.team1Id)
        const team2 = currentTeams.find(t => t.id === proposal.team2Id)
        if (!team1 || !team2) continue

        await db.transaction('rw', [db.players, db.teams, db.transactions], async () => {
          for (const p of t1Players) {
            const update: Record<string, unknown> = { teamId: proposal.team2Id }
            if (p.status) update['status.teamId'] = proposal.team2Id
            await db.players.update(p.id, update)
          }
          for (const p of t2Players) {
            const update: Record<string, unknown> = { teamId: proposal.team1Id }
            if (p.status) update['status.teamId'] = proposal.team1Id
            await db.players.update(p.id, update)
          }

          const roster1 = team1.roster ?? []
          const roster2 = team2.roster ?? []
          team1.roster = roster1
            .filter(r => !proposal.team1Players.includes(r.playerId))
            .concat(proposal.team2Players.map((id, i) => ({ playerId: id, rosterStatus: 'active' as const, lineupPosition: roster1.length + i })))
          team2.roster = roster2
            .filter(r => !proposal.team2Players.includes(r.playerId))
            .concat(proposal.team1Players.map((id, i) => ({ playerId: id, rosterStatus: 'active' as const, lineupPosition: roster2.length + i })))

          const sal1Out = t1Players.reduce((s, p) => s + (p.contract?.annualSalary ?? 0), 0)
          const sal2Out = t2Players.reduce((s, p) => s + (p.contract?.annualSalary ?? 0), 0)
          if (team1.finances) team1.finances.totalPayroll = (team1.finances.totalPayroll ?? 0) - sal1Out + sal2Out
          if (team2.finances) team2.finances.totalPayroll = (team2.finances.totalPayroll ?? 0) - sal2Out + sal1Out

          await db.teams.put(team1)
          await db.teams.put(team2)

          const tx: Transaction = {
            id: uuid(),
            date: forDate,
            type: 'trade',
            details: {
              team1: proposal.team1Id,
              team2: proposal.team2Id,
              team1PlayersOut: proposal.team1Players,
              team1PlayersIn: proposal.team2Players,
              salaryOut: sal1Out,
              salaryIn: sal2Out,
            },
            description: result.headline,
            seasonYear: state.currentSeason,
          }
          await addTransaction(db, tx)
        })
      }

      if (results.length > 0) {
        await refreshTeams()
        await refreshPlayers()
      }
    },
    [state, refreshTeams, refreshPlayers],
  )

  const simDay = useCallback(async () => {
    const db = dbRef.current
    if (!db || !state || simming) return

    setSimming(true)
    try {
      const currentDate = state.currentDate
      const games = await db.games
        .where('date')
        .equals(currentDate)
        .toArray()

      const unplayed = games.filter(g => g.status === 'scheduled')
      if (unplayed.length > 0) {
        await simGames(unplayed)
      }

      try { await executeBackgroundTrades(currentDate) } catch (e) { console.warn('Background trades skipped:', e) }

      const nextDate = getNextDate(currentDate)
      await advanceDate(nextDate)
      await checkSeasonEnd()
    } finally {
      setSimming(false)
      setSimProgress(null)
    }
  }, [state, simming, simGames, advanceDate, checkSeasonEnd, executeBackgroundTrades])

  const simWeek = useCallback(async () => {
    const db = dbRef.current
    if (!db || !state || simming) return

    setSimming(true)
    try {
      const startDate = state.currentDate
      const endDate = addDays(startDate, 7)

      const allGames = await db.games
        .where('date')
        .between(startDate, endDate, true, true)
        .toArray()

      const unplayed = allGames.filter(g => g.status === 'scheduled')
      if (unplayed.length > 0) {
        await simGames(unplayed)
      }

      try { await executeBackgroundTrades(startDate) } catch (e) { console.warn('Background trades skipped:', e) }

      await advanceDate(endDate)
      await checkSeasonEnd()
    } finally {
      setSimming(false)
      setSimProgress(null)
    }
  }, [state, simming, simGames, advanceDate, checkSeasonEnd, executeBackgroundTrades])

  const simToDate = useCallback(
    async (targetDate: string) => {
      const db = dbRef.current
      if (!db || !state || simming) return

      setSimming(true)
      try {
        const allGames = await db.games
          .where('date')
          .between(state.currentDate, targetDate, true, true)
          .toArray()

        const unplayed = allGames.filter(g => g.status === 'scheduled')
        if (unplayed.length > 0) {
          await simGames(unplayed)
        }

        await advanceDate(targetDate)
      } finally {
        setSimming(false)
        setSimProgress(null)
      }
    },
    [state, simming, simGames, advanceDate],
  )

  const simSeason = useCallback(async () => {
    const db = dbRef.current
    if (!db || !state || simming) return

    setSimming(true)
    try {
      const allGames = await db.games
        .where('date')
        .aboveOrEqual(state.currentDate)
        .toArray()

      const unplayed = allGames
        .filter(g => g.status === 'scheduled' && g.gameType === 'regular_season')
        .sort((a, b) => a.date.localeCompare(b.date))

      if (unplayed.length > 0) {
        let lastTradeDate = ''
        for (let i = 0; i < unplayed.length; i += 15) {
          const batch = unplayed.slice(i, i + 15)
          setSimProgress(`Game ${i + 1}/${unplayed.length}`)
          await simGames(batch)

          const batchDate = batch[batch.length - 1].date
          if (batchDate !== lastTradeDate) {
            try { await executeBackgroundTrades(batchDate) } catch (e) { console.warn('Background trades skipped:', e) }
            lastTradeDate = batchDate
          }
        }

        const lastDate = unplayed[unplayed.length - 1].date
        await advanceDate(addDays(lastDate, 1))
      }

      await checkSeasonEnd()
    } finally {
      setSimming(false)
      setSimProgress(null)
    }
  }, [state, simming, simGames, advanceDate, checkSeasonEnd, executeBackgroundTrades])

  const simPlayoffs = useCallback(async () => {
    const db = dbRef.current
    if (!db || !state || simming) return

    setSimming(true)
    setSimProgress('Simulating playoffs...')
    try {
      const currentTeams = await getAllTeams(db)
      const currentPlayers = await getAllPlayers(db)
      const seed = state.currentSeason * 31337 + currentTeams.reduce((s, t) => s + t.seasonRecord.wins, 0)

      const results = simulateEntirePlayoffs(
        currentTeams,
        currentPlayers,
        state.currentSeason,
        state.currentDate,
        seed,
      )

      updatePlayoffResults(results)

      await updateLeagueState(db, { playoffResults: results })
      await refreshState()
    } finally {
      setSimming(false)
      setSimProgress(null)
    }
  }, [state, simming, refreshState, updatePlayoffResults])

  const executeTrade = useCallback(
    async (
      outPlayerIds: string[],
      inPlayerIds: string[],
      partnerTeamId: string,
    ): Promise<TradeValidationResult & { executed: boolean }> => {
      const db = dbRef.current
      if (!db || !state) return { valid: false, errors: ['No database'], warnings: [], salaryOut: 0, salaryIn: 0, executed: false }

      const userTeamId = state.userTeamId
      const outgoing = players.filter(p => outPlayerIds.includes(p.id))
      const incoming = players.filter(p => inPlayerIds.includes(p.id))
      const userTeamPlayers = players.filter(p => p.teamId === userTeamId)
      const teamPayroll = computeTeamPayroll(userTeamPlayers)

      const validation = validateTrade(outgoing, incoming, teamPayroll)
      if (!validation.valid) {
        return { ...validation, executed: false }
      }

      await db.transaction('rw', [db.players, db.teams, db.transactions], async () => {
        for (const p of outgoing) {
          await db.players.update(p.id, { teamId: partnerTeamId, 'status.teamId': partnerTeamId })
        }
        for (const p of incoming) {
          await db.players.update(p.id, { teamId: userTeamId, 'status.teamId': userTeamId })
        }

        const outNames = outgoing.map(p => `${p.bio.firstName} ${p.bio.lastName}`).join(', ')
        const inNames = incoming.map(p => `${p.bio.firstName} ${p.bio.lastName}`).join(', ')
        const partnerTeam = teams.find(t => t.id === partnerTeamId)
        const userTeam = teams.find(t => t.id === userTeamId)

        const tx: Transaction = {
          id: uuid(),
          date: state.currentDate,
          type: 'trade',
          details: {
            team1: userTeamId,
            team2: partnerTeamId,
            team1PlayersOut: outPlayerIds,
            team1PlayersIn: inPlayerIds,
            salaryOut: validation.salaryOut,
            salaryIn: validation.salaryIn,
          },
          description: `${userTeam?.info.city ?? userTeamId} trades ${outNames} to ${partnerTeam?.info.city ?? partnerTeamId} for ${inNames}`,
          seasonYear: state.currentSeason,
        }
        await addTransaction(db, tx)

        const uTeam = teams.find(t => t.id === userTeamId)
        if (uTeam) {
          uTeam.roster = uTeam.roster
            .filter(r => !outPlayerIds.includes(r.playerId))
            .concat(inPlayerIds.map((id, i) => ({ playerId: id, rosterStatus: 'active' as const, lineupPosition: uTeam.roster.length + i })))
          uTeam.finances.totalPayroll = uTeam.finances.totalPayroll - validation.salaryOut + validation.salaryIn
          uTeam.finances.isOverCap = uTeam.finances.totalPayroll > uTeam.finances.salaryCap
          uTeam.finances.isInLuxuryTax = uTeam.finances.totalPayroll > uTeam.finances.luxuryTaxThreshold
          await db.teams.put(uTeam)
        }

        const pTeam = teams.find(t => t.id === partnerTeamId)
        if (pTeam) {
          pTeam.roster = pTeam.roster
            .filter(r => !inPlayerIds.includes(r.playerId))
            .concat(outPlayerIds.map((id, i) => ({ playerId: id, rosterStatus: 'active' as const, lineupPosition: pTeam.roster.length + i })))
          pTeam.finances.totalPayroll = pTeam.finances.totalPayroll + validation.salaryOut - validation.salaryIn
          pTeam.finances.isOverCap = pTeam.finances.totalPayroll > pTeam.finances.salaryCap
          pTeam.finances.isInLuxuryTax = pTeam.finances.totalPayroll > pTeam.finances.luxuryTaxThreshold
          await db.teams.put(pTeam)
        }
      })

      await refreshTeams()
      await refreshPlayers()

      return { ...validation, executed: true }
    },
    [players, teams, state, refreshTeams, refreshPlayers],
  )

  const signFreeAgent = useCallback(
    async (playerId: string, teamId: string, salary: number, years: number): Promise<boolean> => {
      const db = dbRef.current
      if (!db || !state) return false

      const player = players.find(p => p.id === playerId)
      if (!player) return false

      await db.transaction('rw', [db.players, db.teams, db.transactions], async () => {
        await db.players.update(playerId, {
          teamId,
          'status.teamId': teamId,
          'status.isFreeAgent': false,
          'status.isRestrictedFA': false,
          'contract.annualSalary': salary,
          'contract.yearsRemaining': years,
          'contract.totalYears': years,
          'contract.contractType': 'standard',
        })

        const team = teams.find(t => t.id === teamId)
        if (team) {
          team.roster.push({ playerId, rosterStatus: 'active', lineupPosition: team.roster.length })
          team.finances.totalPayroll += salary
          team.finances.isOverCap = team.finances.totalPayroll > team.finances.salaryCap
          team.finances.isInLuxuryTax = team.finances.totalPayroll > team.finances.luxuryTaxThreshold
          await db.teams.put(team)
        }

        const tx: Transaction = {
          id: uuid(),
          date: state.currentDate,
          type: 'signing',
          details: { playerId, teamId, salary, years },
          description: `${player.bio.firstName} ${player.bio.lastName} signs ${years}-year, $${(salary / 1_000_000).toFixed(1)}M/yr deal with ${team?.info.city ?? teamId}`,
          seasonYear: state.currentSeason,
        }
        await addTransaction(db, tx)
      })

      await refreshTeams()
      await refreshPlayers()
      return true
    },
    [players, teams, state, refreshTeams, refreshPlayers],
  )

  const releasePlayer = useCallback(
    async (playerId: string): Promise<boolean> => {
      const db = dbRef.current
      if (!db || !state) return false

      const player = players.find(p => p.id === playerId)
      if (!player) return false

      const teamId = player.teamId
      const salary = player.contract?.annualSalary ?? 0

      await db.transaction('rw', [db.players, db.teams, db.transactions], async () => {
        await db.players.update(playerId, {
          teamId: '',
          'status.teamId': '',
          'status.isFreeAgent': true,
        })

        const team = teams.find(t => t.id === teamId)
        if (team) {
          team.roster = team.roster.filter(r => r.playerId !== playerId)
          team.finances.totalPayroll -= salary
          team.finances.isOverCap = team.finances.totalPayroll > team.finances.salaryCap
          team.finances.isInLuxuryTax = team.finances.totalPayroll > team.finances.luxuryTaxThreshold
          await db.teams.put(team)
        }

        const tx: Transaction = {
          id: uuid(),
          date: state.currentDate,
          type: 'release',
          details: { playerId, teamId },
          description: `${player.bio.firstName} ${player.bio.lastName} released by ${team?.info.city ?? teamId}`,
          seasonYear: state.currentSeason,
        }
        await addTransaction(db, tx)
      })

      await refreshTeams()
      await refreshPlayers()
      return true
    },
    [players, teams, state, refreshTeams, refreshPlayers],
  )

  const startDraft = useCallback(async () => {
    const db = dbRef.current
    if (!db || !state) return

    setSimming(true)
    setSimProgress('Loading draft class...')
    try {
      let prospects = await loadDraftClassFromJSON(state.currentSeason)
      if (prospects.length === 0) {
        prospects = generateDraftClass(state.currentSeason)
      }

      setSimProgress('Running draft lottery...')
      const currentTeams = await getAllTeams(db)
      const lotteryResults = runDraftLottery(currentTeams)
      const draftOrder = buildDraftOrder(lotteryResults, currentTeams)

      await updateLeagueState(db, { currentPhase: 'draft' })
      if (leagueId) {
        await saveLeagueMeta(leagueId, { currentPhase: 'draft' as SeasonPhase })
      }
      await refreshState()

      updateDraftState({
        prospects,
        draftOrder,
        lotteryResults,
        currentPickIndex: 0,
        completedPicks: [],
        isActive: true,
      })
    } finally {
      setSimming(false)
      setSimProgress(null)
    }
  }, [state, leagueId, refreshState])

  const executeDraftSelection = useCallback(
    async (prospectId: string, isUser: boolean): Promise<{ pick: DraftPick & { analysis?: string }; isUserNext: boolean } | null> => {
      const db = dbRef.current
      const ds = draftStateRef.current
      if (!db || !state || !ds || !ds.isActive) return null

      const { prospects, draftOrder, currentPickIndex, completedPicks } = ds
      if (currentPickIndex >= draftOrder.length) return null

      const currentPick = draftOrder[currentPickIndex]
      const prospect = prospects.find(p => p.id === prospectId)
      if (!prospect) return null

      const team = teams.find(t => t.id === currentPick.teamId)
      const teamPlayers = players.filter(p => p.teamId === currentPick.teamId)

      const analysis = isUser
        ? undefined
        : getCpuPickAnalysis(prospect, team!, teamPlayers)

      const player = convertProspectToPlayer(
        prospect,
        currentPick.teamId,
        currentPick.pickNumber,
        currentPick.round,
        state.currentSeason,
      )

      await db.transaction('rw', [db.players, db.teams, db.transactions], async () => {
        await db.players.put(player)

        const dbTeam = await db.teams.get(currentPick.teamId)
        if (dbTeam) {
          dbTeam.roster.push({
            playerId: player.id,
            rosterStatus: 'active',
            lineupPosition: dbTeam.roster.length,
          })
          dbTeam.finances.totalPayroll += player.contract?.annualSalary ?? 0
          await db.teams.put(dbTeam)
        }

        const tx: Transaction = {
          id: uuid(),
          date: state.currentDate,
          type: 'draft' as Transaction['type'],
          details: {
            pickNumber: currentPick.pickNumber,
            round: currentPick.round,
            prospectName: `${prospect.firstName} ${prospect.lastName}`,
            position: prospect.position,
            school: prospect.school,
          },
          description: `${team?.info.city ?? ''} ${team?.info.name ?? ''} select ${prospect.firstName} ${prospect.lastName} (${prospect.position}, ${prospect.school}) with pick #${currentPick.pickNumber}`,
          seasonYear: state.currentSeason,
        }
        await addTransaction(db, tx)
      })

      const completedPick: DraftPick & { analysis?: string } = {
        ...currentPick,
        prospectId: prospect.id,
        prospectName: `${prospect.firstName} ${prospect.lastName}`,
        analysis,
      }

      const newCompletedPicks = [...completedPicks, completedPick]
      const remainingProspects = prospects.filter(p => p.id !== prospectId)
      const nextPickIndex = currentPickIndex + 1
      const isFinished = nextPickIndex >= draftOrder.length || remainingProspects.length === 0
      const nextPick = isFinished ? null : draftOrder[nextPickIndex]
      const isUserNext = nextPick ? nextPick.teamId === state.userTeamId : false

      updateDraftState({
        ...ds,
        prospects: remainingProspects,
        currentPickIndex: nextPickIndex,
        completedPicks: newCompletedPicks,
        isActive: !isFinished,
      })

      await refreshTeams()
      await refreshPlayers()

      return { pick: completedPick, isUserNext }
    },
    [state, teams, players, refreshTeams, refreshPlayers, updateDraftState],
  )

  const userDraftPick = useCallback(
    async (prospectId: string) => {
      await executeDraftSelection(prospectId, true)
    },
    [executeDraftSelection],
  )

  const advanceDraftPick = useCallback(async (): Promise<{ pick: DraftPick & { analysis?: string }; isUserNext: boolean } | null> => {
    const ds = draftStateRef.current
    if (!ds || !ds.isActive || !state) return null

    const { draftOrder, currentPickIndex, prospects } = ds
    if (currentPickIndex >= draftOrder.length) return null

    const currentPick = draftOrder[currentPickIndex]
    if (currentPick.teamId === state.userTeamId) return null

    const team = teams.find(t => t.id === currentPick.teamId)
    const teamPlayers = players.filter(p => p.teamId === currentPick.teamId)
    const chosen = cpuAutoPick(prospects, team!, teamPlayers)
    if (!chosen) return null

    return executeDraftSelection(chosen.id, false)
  }, [state, teams, players, executeDraftSelection])

  const completeDraft = useCallback(async () => {
    const db = dbRef.current
    if (!db || !state) return

    await updateLeagueState(db, { currentPhase: 'free_agency' })
    if (leagueId) {
      await saveLeagueMeta(leagueId, { currentPhase: 'free_agency' as SeasonPhase })
    }

    updateDraftState(null)
    await refreshState()
    await refreshTeams()
    await refreshPlayers()
  }, [state, leagueId, refreshState, refreshTeams, refreshPlayers])

  const updateSettings = useCallback(async (settings: LeagueSettings) => {
    const db = dbRef.current
    if (!db) return
    await updateLeagueState(db, { settings })
    await refreshState()
  }, [refreshState])

  const advanceToNextSeason = useCallback(async (): Promise<boolean> => {
    const db = dbRef.current
    if (!db || !state) return false

    setSimming(true)
    setSimProgress('Running player development...')

    try {
      const currentPlayers = await getAllPlayers(db)
      const allTeams = await db.teams.toArray()
      const staffMap = new Map<string, import('../types/staff').StaffRoster>()
      for (const t of allTeams) {
        if (t.staff) staffMap.set(t.id, t.staff)
      }
      const { updatedPlayers, retiredPlayerIds } = runPlayerDevelopment(currentPlayers, staffMap)

      setSimProgress('Updating player ratings...')

      setSimProgress('Recording season history...')
      const pr = playoffResultsRef.current
      let championTeamId: string
      let finalistTeamId: string
      if (pr?.championId) {
        championTeamId = pr.championId
        finalistTeamId = pr.finalsLoserId
      } else {
        const sortedByWins = [...allTeams].sort((a, b) => {
          const wpA = a.seasonRecord.wins / Math.max(1, a.seasonRecord.wins + a.seasonRecord.losses)
          const wpB = b.seasonRecord.wins / Math.max(1, b.seasonRecord.wins + b.seasonRecord.losses)
          return wpB - wpA
        })
        championTeamId = sortedByWins[0]?.id ?? ''
        finalistTeamId = sortedByWins[1]?.id ?? ''
      }

      let mvpPlayerId = ''
      let topScorerPlayerId = ''
      let topScorerPPG = 0
      let rotyPlayerId: string | null = null
      for (const p of currentPlayers) {
        const stats = p.careerStats?.[p.careerStats.length - 1]
        if (!stats || stats.gp < 5) continue
        const value = stats.ppg + stats.rpg * 0.8 + stats.apg * 1.2 + stats.spg * 2 + stats.bpg * 2
        if (!mvpPlayerId || value > ((): number => {
          const mp = currentPlayers.find(x => x.id === mvpPlayerId)
          const ms = mp?.careerStats?.[mp.careerStats.length - 1]
          if (!ms) return 0
          return ms.ppg + ms.rpg * 0.8 + ms.apg * 1.2 + ms.spg * 2 + ms.bpg * 2
        })()) {
          mvpPlayerId = p.id
        }
        if (stats.ppg > topScorerPPG) {
          topScorerPPG = stats.ppg
          topScorerPlayerId = p.id
        }
        if (p.bio.yearsInLeague === 0 || p.bio.yearsInLeague === 1) {
          if (!rotyPlayerId) rotyPlayerId = p.id
          else {
            const cur = currentPlayers.find(x => x.id === rotyPlayerId)
            const cs = cur?.careerStats?.[cur.careerStats.length - 1]
            if (cs && stats.ppg + stats.rpg + stats.apg > cs.ppg + cs.rpg + cs.apg) {
              rotyPlayerId = p.id
            }
          }
        }
      }

      let finalsResult: string | undefined
      let playoffMvpId: string | null = null
      if (pr) {
        const finalsSeries = pr.seriesResults[pr.seriesResults.length - 1]
        if (finalsSeries) {
          const champWins = finalsSeries.winnerId === finalsSeries.seriesId
            ? finalsSeries.higherSeedWins : finalsSeries.winnerId === pr.championId
              ? (pr.championId === pr.bracket.series[pr.bracket.series.length - 1]?.higherSeed.teamId
                ? finalsSeries.higherSeedWins : finalsSeries.lowerSeedWins)
              : finalsSeries.higherSeedWins
          const loserWins = finalsSeries.gamesPlayed - champWins
          finalsResult = `${champWins}-${loserWins}`
        }
        playoffMvpId = pr.playoffMvpId
      }

      const seasonSummary: import('../types/league').SeasonSummary = {
        year: state.currentSeason,
        championTeamId,
        finalistTeamId,
        finalsResult,
        playoffMvpId,
        mvpPlayerId,
        rotyPlayerId,
        topScorerPlayerId,
        topScorerPPG,
      }
      const prevHistory = state.seasonHistory ?? []

      setSimProgress('Coaching carousel...')
      const firedList = evaluateCoachesForFiring(allTeams, state.currentSeason)
      const firedTeamIds = new Set(firedList.map(f => f.teamId))
      const marketplace = generateCoachMarketplace(firedList, state.currentSeason, state.currentSeason * 7919)
      const cpuHires = cpuHireCoaches(allTeams, marketplace, firedTeamIds, state.userTeamId)

      await db.transaction('rw', [db.players, db.teams, db.leagueState, db.games, db.transactions, db.staffMarket], async () => {
        for (const retired of retiredPlayerIds) {
          const p = currentPlayers.find(x => x.id === retired)
          if (p) {
            const tx: Transaction = {
              id: uuid(),
              date: state.currentDate,
              type: 'release',
              details: { playerId: retired, reason: 'retirement' },
              description: `${p.bio.firstName} ${p.bio.lastName} has retired`,
              seasonYear: state.currentSeason,
            }
            await addTransaction(db, tx)
          }
          await db.players.delete(retired)
        }

        await db.players.bulkPut(updatedPlayers)

        for (const fired of firedList) {
          const team = allTeams.find(t => t.id === fired.teamId)
          if (team?.staff) {
            const tx: Transaction = {
              id: uuid(),
              date: state.currentDate,
              type: 'staff_fire' as Transaction['type'],
              details: { staffName: fired.coach.name, reason: fired.reason },
              description: `${team.info.city} ${team.info.name} fired head coach ${fired.coach.name}`,
              seasonYear: state.currentSeason,
            }
            await addTransaction(db, tx)
          }
        }

        for (const hire of cpuHires) {
          const team = allTeams.find(t => t.id === hire.teamId)
          const coach = hire.coachEntry.data as HeadCoach
          if (team?.staff) {
            team.staff.headCoach = { ...coach, teamId: team.id, hotSeatLevel: 0 }
            const tx: Transaction = {
              id: uuid(),
              date: state.currentDate,
              type: 'staff_hire' as Transaction['type'],
              details: { staffName: coach.name },
              description: `${team.info.city} ${team.info.name} hired head coach ${coach.name}`,
              seasonYear: state.currentSeason,
            }
            await addTransaction(db, tx)
          }
        }

        await db.staffMarket.clear()
        const availableCoaches = marketplace.filter(e => e.marketStatus === 'available')
        if (availableCoaches.length > 0) {
          await db.staffMarket.bulkAdd(availableCoaches)
        }

        const refreshedTeams = await db.teams.toArray()
        for (const team of refreshedTeams) {
          const hire = cpuHires.find(h => h.teamId === team.id)
          if (hire) {
            const coach = hire.coachEntry.data as HeadCoach
            if (team.staff) {
              team.staff.headCoach = { ...coach, teamId: team.id, hotSeatLevel: 0 }
            }
          }
          team.roster = team.roster.filter(r => !retiredPlayerIds.includes(r.playerId))
          team.seasonRecord = {
            wins: 0, losses: 0,
            conferenceWins: 0, conferenceLosses: 0,
            divisionWins: 0, divisionLosses: 0,
            homeWins: 0, homeLosses: 0,
            awayWins: 0, awayLosses: 0,
            streak: 0, last10Wins: 0, last10Losses: 0,
            pointsFor: 0, pointsAgainst: 0,
          }
          if (team.staff) {
            team.staff.headCoach.hotSeatLevel = 0

            team.staff.headCoach.age += 1
            team.staff.headCoach.contract.yearsRemaining = Math.max(0, team.staff.headCoach.contract.yearsRemaining - 1)
            team.staff.headCoach.experience += 1

            if (team.staff.generalManager) {
              team.staff.generalManager.age += 1
              team.staff.generalManager.yearsAsGM += 1
              team.staff.generalManager.contract.yearsRemaining = Math.max(0, team.staff.generalManager.contract.yearsRemaining - 1)
              if (team.staff.generalManager.age >= 75) {
                team.staff.generalManager = null
              }
            }

            for (const ac of team.staff.assistantCoaches) {
              ac.age += 1
              ac.contract.yearsRemaining = Math.max(0, ac.contract.yearsRemaining - 1)
            }
            team.staff.assistantCoaches = team.staff.assistantCoaches.filter(ac => ac.age < 72)

            for (const scout of team.staff.scouts) {
              scout.age += 1
              scout.contract.yearsRemaining = Math.max(0, scout.contract.yearsRemaining - 1)
            }
            team.staff.scouts = team.staff.scouts.filter(s => s.age < 72)

            for (const trainer of team.staff.trainers) {
              trainer.age += 1
              trainer.contract.yearsRemaining = Math.max(0, trainer.contract.yearsRemaining - 1)
            }
            team.staff.trainers = team.staff.trainers.filter(t => t.age < 72)
          }
          await db.teams.put(team)
        }

        setSimProgress('Generating schedule...')
        const nextSeason = state.currentSeason + 1
        const teamInfos = refreshedTeams.map(t => t.info)
        const newSchedule = generateSeasonSchedule(teamInfos, nextSeason)

        await db.games.clear()
        await db.games.bulkAdd(newSchedule)

        const startDate = newSchedule.length > 0
          ? newSchedule.sort((a, b) => a.date.localeCompare(b.date))[0].date
          : `${nextSeason}-10-22`

        await db.leagueState.update('singleton', {
          currentSeason: nextSeason,
          currentDate: startDate,
          seasonHistory: [...prevHistory, seasonSummary],
          currentPhase: 'regular_season',
          playoffResults: null,
        })
      })

      if (leagueId) {
        await saveLeagueMeta(leagueId, {
          currentSeason: state.currentSeason + 1,
          currentPhase: 'regular_season' as SeasonPhase,
        })
      }

      updatePlayoffResults(null)

      await refreshState()
      await refreshTeams()
      await refreshPlayers()

      return true
    } finally {
      setSimming(false)
      setSimProgress(null)
    }
  }, [state, leagueId, refreshState, refreshTeams, refreshPlayers, updatePlayoffResults])

  return (
    <LeagueContext.Provider
      value={{
        db: dbRef.current,
        state,
        teams,
        players,
        loading,
        error,
        simming,
        simProgress,
        draftState,
        playoffResults,
        simDay,
        simWeek,
        simToDate,
        simSeason,
        simPlayoffs,
        refreshState,
        refreshTeams,
        executeTrade,
        signFreeAgent,
        releasePlayer,
        advanceToNextSeason,
        updateSettings,
        startDraft,
        userDraftPick,
        advanceDraftPick,
        completeDraft,
      }}
    >
      {children}
    </LeagueContext.Provider>
  )
}

export function useLeague(): LeagueContextValue {
  const ctx = useContext(LeagueContext)
  if (!ctx) throw new Error('useLeague must be used within a LeagueProvider')
  return ctx
}

function updateTeamRecord(team: Team, result: GameResult, teamId: string, oppId: string) {
  const won = result.winningTeamId === teamId
  const isHome = result.homeBoxScore.teamId === teamId
  const score = isHome ? result.homeScore : result.awayScore
  const oppScore = isHome ? result.awayScore : result.homeScore
  const r = team.seasonRecord

  if (won) {
    r.wins++
    r.streak = r.streak >= 0 ? r.streak + 1 : 1
  } else {
    r.losses++
    r.streak = r.streak <= 0 ? r.streak - 1 : -1
  }

  r.pointsFor += score
  r.pointsAgainst += oppScore

  if (isHome) {
    if (won) r.homeWins++
    else r.homeLosses++
  } else {
    if (won) r.awayWins++
    else r.awayLosses++
  }

  const sameConf =
    (team.info.conference === 'Eastern' && ['BOS','NYT','PHI','TOR','BKN','CHI','CLE','MIL','IND','DET','MIA','ATL','CHA','WAS','ORL'].includes(oppId)) ||
    (team.info.conference === 'Western' && ['DEN','POR','MIN','OKC','UTA','LAV','GSS','SAC','PHX','LAW','DAL','HOU','SAS','MEM','NOP'].includes(oppId))

  if (sameConf) {
    if (won) r.conferenceWins++
    else r.conferenceLosses++
  }
}

function getNextDate(date: string): string {
  return addDays(date, 1)
}

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00')
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
