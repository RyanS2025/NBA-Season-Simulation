import { useState } from 'react'
import { TEAMS } from '../../data'
import { createLeague } from '../../db'
import Button from '../common/Button'
import SectionLabel from '../common/SectionLabel'
import type { LeagueSettings, Team, CoachingStaff } from '../../types'

interface Props {
  leagueName: string
  settings: LeagueSettings
  selectedTeamId: string
  onBack: () => void
  onCreated: (leagueId: string) => void
}

export default function StepConfirm({ leagueName, settings, selectedTeamId, onBack, onCreated }: Props) {
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const team = TEAMS.find(t => t.abbreviation === selectedTeamId)

  const handleCreate = async () => {
    setCreating(true)
    setError(null)

    try {
      const teams: Team[] = TEAMS.map(t => ({
        id: t.abbreviation,
        info: t,
        roster: [],
        coaching: null as unknown as CoachingStaff,
        finances: {
          salaryCap: 0, totalPayroll: 0, luxuryTaxThreshold: 0,
          firstApronThreshold: 0, secondApronThreshold: 0,
          isOverCap: false, isInLuxuryTax: false,
          isAboveFirstApron: false, isAboveSecondApron: false,
          taxBill: 0, tradeExceptions: [], capHolds: [], draftPicks: [],
        },
        chemistry: 50,
        homeCourtAdvantage: 5,
        seasonRecord: {
          wins: 0, losses: 0, conferenceWins: 0, conferenceLosses: 0,
          divisionWins: 0, divisionLosses: 0, homeWins: 0, homeLosses: 0,
          awayWins: 0, awayLosses: 0, streak: 0, last10Wins: 0,
          last10Losses: 0, pointsFor: 0, pointsAgainst: 0,
        },
        history: [],
      }))

      const { leagueId } = await createLeague({
        name: leagueName,
        userTeamId: selectedTeamId,
        settings,
        teams,
        players: [],
        contracts: [],
        draftPicks: [],
        startDate: '2026-10-22',
        seasonYear: 2027,
      })

      onCreated(leagueId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create league')
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl tracking-wide text-white">Confirm League</h1>

      <div
        className="rounded-xl p-6 relative overflow-hidden"
        style={{
          background: team ? `${team.primaryColor}15` : 'rgba(255,255,255,0.04)',
          border: `1px solid ${team ? `${team.primaryColor}30` : 'rgba(255,255,255,0.08)'}`,
        }}
      >
        {team && (
          <div
            className="absolute -top-10 -right-10 w-44 h-44 rounded-full blur-[60px] opacity-25"
            style={{ background: team.primaryColor }}
          />
        )}
        <div className="relative z-10">
          <SectionLabel>Your Team</SectionLabel>
          <div className="text-3xl font-display tracking-wide text-white">
            {team ? `${team.city} ${team.name}` : 'None selected'}
          </div>
          {team && (
            <div className="text-sm text-gray-400 mt-1">{team.arenaName} — {team.conference} Conference, {team.division} Division</div>
          )}
        </div>
      </div>

      <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-6">
        <SectionLabel>League Details</SectionLabel>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">League Name</span>
            <div className="text-white">{leagueName}</div>
          </div>
          <div>
            <span className="text-gray-600">Season</span>
            <div className="text-white">2026-27</div>
          </div>
          <div>
            <span className="text-gray-600">Games</span>
            <div className="text-white">{settings.gamesPerSeason} per team</div>
          </div>
          <div>
            <span className="text-gray-600">Difficulty</span>
            <div className="text-white capitalize">{settings.difficulty}</div>
          </div>
          <div>
            <span className="text-gray-600">Playoff Format</span>
            <div className="text-white">{settings.playoffFormat === 'play_in' ? 'Play-In Tournament' : 'Traditional 16'}</div>
          </div>
          <div>
            <span className="text-gray-600">CBA Rules</span>
            <div className="text-white">{settings.cbaRulesEnabled ? 'Enabled' : 'Disabled'}</div>
          </div>
        </div>
      </div>

      <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-6">
        <SectionLabel>Active Features</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {settings.injuriesEnabled && <FeatureTag>Injuries</FeatureTag>}
          {settings.fatigueEnabled && <FeatureTag>Fatigue</FeatureTag>}
          {settings.moraleEnabled && <FeatureTag>Morale</FeatureTag>}
          {settings.playerDevelopmentEnabled && <FeatureTag>Development</FeatureTag>}
          {settings.storylinesEnabled && <FeatureTag>Storylines</FeatureTag>}
          {settings.tradeDeadlineEnabled && <FeatureTag>Trade Deadline</FeatureTag>}
          {settings.backgroundTradesEnabled && <FeatureTag>CPU Trades</FeatureTag>}
          {settings.draftLotteryEnabled && <FeatureTag>Draft Lottery</FeatureTag>}
          {settings.allStarWeekendEnabled && <FeatureTag>All-Star Weekend</FeatureTag>}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack} disabled={creating}>Back</Button>
        <Button onClick={handleCreate} disabled={creating} size="lg">
          {creating ? 'Creating...' : 'Create League'}
        </Button>
      </div>
    </div>
  )
}

function FeatureTag({ children }: { children: string }) {
  return (
    <span className="px-3 py-1 rounded-lg text-xs font-medium bg-accent/10 text-accent border border-accent/20">
      {children}
    </span>
  )
}
