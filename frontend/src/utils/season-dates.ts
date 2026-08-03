export type MilestoneType = 'extension_deadline' | 'trade_deadline' | 'all_star'

export interface SeasonMilestone {
  date: string
  type: MilestoneType
  label: string
  shortLabel: string
}

/**
 * Fixed calendar milestones for a season. The season runs Oct 22 of
 * `seasonYear` through mid-April of the following year, so the trade
 * deadline and All-Star break land in `seasonYear + 1`.
 */
export function getSeasonMilestones(seasonYear: number): SeasonMilestone[] {
  const next = seasonYear + 1
  return [
    {
      date: `${seasonYear}-12-15`,
      type: 'extension_deadline',
      label: 'Contract Extension Deadline',
      shortLabel: 'Ext DL',
    },
    {
      date: `${next}-02-06`,
      type: 'trade_deadline',
      label: 'Trade Deadline',
      shortLabel: 'Trade DL',
    },
    {
      date: `${next}-02-14`,
      type: 'all_star',
      label: 'All-Star Break (Feb 14–16)',
      shortLabel: 'All-Star',
    },
    {
      date: `${next}-02-15`,
      type: 'all_star',
      label: 'All-Star Game',
      shortLabel: 'All-Star',
    },
    {
      date: `${next}-02-16`,
      type: 'all_star',
      label: 'All-Star Break (Feb 14–16)',
      shortLabel: 'All-Star',
    },
  ]
}

export function getTradeDeadlineDate(seasonYear: number): string {
  return `${seasonYear + 1}-02-06`
}
