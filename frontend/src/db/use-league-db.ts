import { useRef, useEffect, useState, useCallback } from 'react'
import { openLeagueDB } from './league-db'
import type { LeagueDB, LeagueState } from './league-db'
import { getLeagueState, saveLeagueMeta } from './league-manager'

export function useLeagueDB(leagueId: string | undefined) {
  const dbRef = useRef<LeagueDB | null>(null)
  const [state, setState] = useState<LeagueState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!leagueId) {
      setLoading(false)
      return
    }

    const db = openLeagueDB(leagueId)
    dbRef.current = db

    getLeagueState(db)
      .then(s => {
        setState(s)
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

  const save = useCallback(async () => {
    if (!dbRef.current || !leagueId || !state) return
    await saveLeagueMeta(leagueId, {
      currentSeason: state.currentSeason,
      currentPhase: state.currentPhase as import('../types').SeasonPhase,
    })
  }, [leagueId, state])

  return { db: dbRef.current, state, loading, error, save }
}
