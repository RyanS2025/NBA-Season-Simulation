import { useState } from 'react'
import { TEAMS } from '../../data'
import { loadPlayers } from '../../data/players'
import { createLeague } from '../../db'
import { generateSeasonSchedule } from '../../utils/schedule-generator'
import Button from '../common/Button'
import SectionLabel from '../common/SectionLabel'
import type { LeagueSettings, Team, CoachingStaff } from '../../types'

const TEAM_UUID_TO_ABBR: Record<string, string> = {
  '60c62382-1d5a-59cb-ab40-076049ba4284': 'BOS',
  'd8527c14-d9ef-5476-86e4-11927ac2f611': 'NYT',
  '1351310f-2614-5bcd-9f50-42ef03946147': 'PHI',
  '6df39fe0-aa15-5fc6-bb41-e1535122b54b': 'TOR',
  '03addb95-7f35-5c89-ab00-f68293b2eeac': 'BKN',
  'cd32f8ce-58f0-5959-a9f9-bf46e16f4f97': 'CHI',
  'eb581ca0-663c-50b8-a4c2-57f559462efa': 'CLE',
  '7c8c473d-2b74-5c0c-9eee-7f8dc76b4bd8': 'MIL',
  '78e2700d-cd87-5a34-9a97-b66fe033c81f': 'IND',
  '46253fad-462c-5619-9c22-d27125e01d6f': 'DET',
  'd0e64e4e-d77d-5e38-9dab-282f03728e43': 'MIA',
  '00c86a41-9d52-597a-83ff-2b1b6b506e3c': 'ATL',
  '2cc46d81-65cc-5f4e-8734-bcb37ae782df': 'CHA',
  '8ae8973e-078e-5869-b4cf-6d0fe2722e13': 'WAS',
  '0604d91d-5bb0-5780-8017-459a745df4d1': 'ORL',
  'abdb42d4-2ba3-5957-a1cd-a32f995e706c': 'DEN',
  '00c7f93a-4687-5690-9880-59ba55447052': 'POR',
  'bf056fd5-7dac-511d-9c12-58f1add4aadf': 'MIN',
  'f971e46d-d78f-5651-974a-b2d497717c62': 'OKC',
  'dc43e2a8-759c-5cac-9b78-d24c5522d760': 'UTA',
  '95f5a64e-5b76-5a2e-bec2-113683e5149e': 'LAV',
  '176f95fa-96b1-5e82-bc8d-d79a049229e7': 'GSS',
  '311c164c-75f8-5eda-a34d-75c9195b649c': 'SAC',
  '772c0a18-fcfb-5a8c-ac49-3a9ca70ee90c': 'PHX',
  'de8bfc98-6fc6-5b93-af1c-6c7cc0d535e1': 'LAW',
  'fb0efc1b-2525-53b4-9f5e-61346f33e66d': 'DAL',
  'e59cc547-ea9b-5492-b0e0-7336e8a5f6ed': 'HOU',
  '413438ba-b3e0-5fd8-85f0-48a2a307905d': 'SAS',
  'b4a6cc87-82f0-5f96-8515-e528c6bff0ec': 'MEM',
  'd6157769-4ad2-52b1-9c3f-0690876c65df': 'NOP',
}

interface Props {
  leagueName: string
  settings: LeagueSettings
  selectedTeamId: string
  onBack: () => void
  onCreated: (leagueId: string) => void
}

export default function StepConfirm({ leagueName, settings, selectedTeamId, onBack, onCreated }: Props) {
  const [creating, setCreating] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)

  const team = TEAMS.find(t => t.abbreviation === selectedTeamId)

  const handleCreate = async () => {
    setCreating(true)
    setError(null)

    try {
      setProgress('Loading players...')
      const rawPlayers = await loadPlayers()

      const players = rawPlayers.map(p => ({
        ...p,
        teamId: TEAM_UUID_TO_ABBR[p.teamId] ?? p.teamId,
      }))

      setProgress('Building teams...')
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

      setProgress('Generating schedule...')
      const seasonYear = 2027
      const schedule = generateSeasonSchedule(TEAMS, seasonYear - 1)

      setProgress('Creating league...')
      const { leagueId, db } = await createLeague({
        name: leagueName,
        userTeamId: selectedTeamId,
        settings,
        teams,
        players,
        contracts: [],
        draftPicks: [],
        startDate: '2026-10-22',
        seasonYear,
      })

      setProgress('Saving schedule...')
      await db.games.bulkAdd(schedule)

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

      {creating && (
        <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 text-accent text-sm">
          {progress}
        </div>
      )}

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
