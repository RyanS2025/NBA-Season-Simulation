import { openLeagueDB } from '../db/league-db'
import { metaDB } from '../db/meta-db'
import type { LeagueMeta } from '../types/league'
import { v4 as uuid } from 'uuid'

interface SaveFile {
  version: 1
  exportedAt: string
  leagueMeta: LeagueMeta
  tables: Record<string, unknown[]>
}

const TABLE_NAMES = [
  'leagueState',
  'teams',
  'players',
  'contracts',
  'games',
  'gameResults',
  'playerSeasonStats',
  'draftPicks',
  'transactions',
  'awards',
  'hallOfFame',
  'retiredPlayers',
  'allStarHistory',
  'preseasonProjections',
  'staff',
  'staffMarket',
  'awardsSeasonState',
] as const

export async function exportLeague(leagueId: string): Promise<void> {
  const meta = await metaDB.leagues.get(leagueId)
  if (!meta) throw new Error('League not found')

  const db = openLeagueDB(leagueId)
  const tables: Record<string, unknown[]> = {}

  for (const name of TABLE_NAMES) {
    const table = db.table(name)
    tables[name] = await table.toArray()
  }

  const saveFile: SaveFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    leagueMeta: meta,
    tables,
  }

  const blob = new Blob([JSON.stringify(saveFile)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bbalsim_${meta.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`
  a.click()
  URL.revokeObjectURL(url)
  db.close()
}

export async function importLeague(file: File): Promise<string> {
  const text = await file.text()
  const saveFile: SaveFile = JSON.parse(text)

  if (saveFile.version !== 1) throw new Error('Unsupported save file version')
  if (!saveFile.leagueMeta || !saveFile.tables) throw new Error('Invalid save file')

  const newId = uuid()
  const now = new Date().toISOString()

  const newMeta: LeagueMeta = {
    ...saveFile.leagueMeta,
    id: newId,
    lastSavedAt: now,
  }

  await metaDB.leagues.add(newMeta)

  const db = openLeagueDB(newId)

  for (const name of TABLE_NAMES) {
    const rows = saveFile.tables[name]
    if (!rows || rows.length === 0) continue
    const table = db.table(name)

    if (name === 'leagueState') {
      const stateRows = rows as Array<Record<string, unknown>>
      for (const row of stateRows) {
        row.leagueId = newId
      }
    }

    await table.bulkAdd(rows)
  }

  db.close()
  return newId
}
