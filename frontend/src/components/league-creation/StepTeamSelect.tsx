import { useState } from 'react'
import { TEAMS } from '../../data'
import Button from '../common/Button'
import SectionLabel from '../common/SectionLabel'
import SearchInput from '../common/SearchInput'
import type { TeamInfo } from '../../types'

interface Props {
  selectedTeamId: string | null
  onSelect: (teamId: string) => void
  onBack: () => void
  onNext: () => void
}

const CONFERENCES = ['Eastern', 'Western'] as const
const DIVISIONS: Record<string, string[]> = {
  Eastern: ['Atlantic', 'Central', 'Southeast'],
  Western: ['Northwest', 'Pacific', 'Southwest'],
}

export default function StepTeamSelect({ selectedTeamId, onSelect, onBack, onNext }: Props) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? TEAMS.filter(t =>
        `${t.city} ${t.name} ${t.abbreviation}`.toLowerCase().includes(search.toLowerCase())
      )
    : TEAMS

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl tracking-wide text-white">Choose Your Team</h1>

      <SearchInput
        placeholder="Search teams..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {search ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {filtered.map(team => (
            <TeamCard
              key={team.abbreviation}
              team={team}
              selected={selectedTeamId === team.abbreviation}
              onClick={() => onSelect(team.abbreviation)}
            />
          ))}
        </div>
      ) : (
        CONFERENCES.map(conf => (
          <div key={conf}>
            <h2 className="font-display text-2xl text-white mb-4">{conf} Conference</h2>
            {DIVISIONS[conf].map(div => (
              <div key={div} className="mb-6">
                <SectionLabel>{div} Division</SectionLabel>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {TEAMS.filter(t => t.conference === conf && t.division === div).map(team => (
                    <TeamCard
                      key={team.abbreviation}
                      team={team}
                      selected={selectedTeamId === team.abbreviation}
                      onClick={() => onSelect(team.abbreviation)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button onClick={onNext} disabled={!selectedTeamId} size="lg">
          Next: Confirm
        </Button>
      </div>
    </div>
  )
}

function TeamCard({ team, selected, onClick }: { team: TeamInfo; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-xl p-4 text-left transition-all overflow-hidden ${
        selected
          ? 'ring-2 ring-accent scale-[1.02]'
          : 'hover:scale-[1.02]'
      }`}
      style={{
        background: `${team.primaryColor}15`,
        border: `1px solid ${selected ? 'oklch(64.6% 0.222 41.116)' : `${team.primaryColor}30`}`,
      }}
    >
      <div
        className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-3xl opacity-20"
        style={{ background: team.primaryColor }}
      />
      <div className="relative z-10">
        <div className="text-xs font-semibold text-gray-500 mb-1">{team.abbreviation}</div>
        <div className="text-sm font-semibold text-white">{team.city}</div>
        <div className="text-sm" style={{ color: team.primaryColor }}>{team.name}</div>
      </div>
    </button>
  )
}
