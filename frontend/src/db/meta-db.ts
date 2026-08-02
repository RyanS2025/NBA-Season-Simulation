import Dexie, { type EntityTable } from 'dexie'
import type { LeagueMeta } from '../types'

class MetaDB extends Dexie {
  leagues!: EntityTable<LeagueMeta, 'id'>

  constructor() {
    super('bbalsim_meta')
    this.version(1).stores({
      leagues: 'id, name, lastSavedAt',
    })
  }
}

export const metaDB = new MetaDB()
