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
import { openLeagueDB } from '../db/league-db'
import type { LeagueDB, LeagueState } from '../db/league-db'
import {
  getLeagueState,
  updateLeagueState,
  getAllTeams,
  getAllPlayers,
  saveLeagueMeta,
  addGameResult,
} from '../db/league-manager'
import { quickSimGame } from '../utils/quick-sim'
import type { Team, Game, GameResult, Player } from '../types'
import type { SeasonPhase } from '../types'

export interface LeagueContextValue {
  db: LeagueDB | null
  state: LeagueState | null
  teams: Team[]
  players: Player[]
  loading: boolean
  error: string | null
  simming: boolean
  simProgress: string | null

  simDay: () => Promise<void>
  simWeek: () => Promise<void>
  simToDate: (targetDate: string) => Promise<void>
  refreshState: () => Promise<void>
  refreshTeams: () => Promise<void>
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

      for (let i = 0; i < games.length; i++) {
        const game = games[i]
        setSimProgress(`Game ${i + 1}/${games.length}`)

        const homePlayers = getTeamPlayers(game.homeTeamId)
        const awayPlayers = getTeamPlayers(game.awayTeamId)

        const result = quickSimGame(game, homePlayers, awayPlayers)

        await addGameResult(db, game.id, game.date, state.currentSeason, result)

        const homeTeam = teamMap.get(game.homeTeamId)
        const awayTeam = teamMap.get(game.awayTeamId)

        if (homeTeam) {
          updateTeamRecord(homeTeam, result, game.homeTeamId, game.awayTeamId)
          await db.teams.put(homeTeam)
        }
        if (awayTeam) {
          updateTeamRecord(awayTeam, result, game.awayTeamId, game.homeTeamId)
          await db.teams.put(awayTeam)
        }
      }
    },
    [teams, state, getTeamPlayers],
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

      const nextDate = getNextDate(currentDate)
      await advanceDate(nextDate)
    } finally {
      setSimming(false)
      setSimProgress(null)
    }
  }, [state, simming, simGames, advanceDate])

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

      await advanceDate(endDate)
    } finally {
      setSimming(false)
      setSimProgress(null)
    }
  }, [state, simming, simGames, advanceDate])

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
        simDay,
        simWeek,
        simToDate,
        refreshState,
        refreshTeams,
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
