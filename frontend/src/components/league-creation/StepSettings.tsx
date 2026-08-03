import type { LeagueSettings } from '../../types'
import SectionLabel from '../common/SectionLabel'
import SearchInput from '../common/SearchInput'
import Button from '../common/Button'

interface Props {
  leagueName: string
  onLeagueNameChange: (name: string) => void
  settings: LeagueSettings
  onSettingsChange: (settings: LeagueSettings) => void
  onNext: () => void
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer group">
      <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-white/[0.08]'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </label>
  )
}

function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-300">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-white/[0.15]"
      >
        {options.map(o => (
          <option key={o.value} value={o.value} className="bg-slate-900">{o.label}</option>
        ))}
      </select>
    </div>
  )
}

export default function StepSettings({ leagueName, onLeagueNameChange, settings, onSettingsChange, onNext }: Props) {
  const update = (partial: Partial<LeagueSettings>) => {
    onSettingsChange({ ...settings, ...partial })
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl tracking-wide text-white">Create League</h1>

      <div className="panel p-6">
        <SectionLabel>League Name</SectionLabel>
        <SearchInput
          placeholder="My League"
          value={leagueName}
          onChange={e => onLeagueNameChange(e.target.value)}
        />
      </div>

      <div className="panel p-6 space-y-1">
        <SectionLabel>Gameplay</SectionLabel>
        <Toggle label="Injuries" checked={settings.injuriesEnabled} onChange={v => update({ injuriesEnabled: v })} />
        <Toggle label="Fatigue" checked={settings.fatigueEnabled} onChange={v => update({ fatigueEnabled: v })} />
        <Toggle label="Player Morale" checked={settings.moraleEnabled} onChange={v => update({ moraleEnabled: v })} />
        <Toggle label="Player Development" checked={settings.playerDevelopmentEnabled} onChange={v => update({ playerDevelopmentEnabled: v })} />
        <Toggle label="Storylines" checked={settings.storylinesEnabled} onChange={v => update({ storylinesEnabled: v })} />
      </div>

      <div className="panel p-6 space-y-1">
        <SectionLabel>League Rules</SectionLabel>
        <Toggle label="CBA Rules (Salary Cap)" checked={settings.cbaRulesEnabled} onChange={v => update({ cbaRulesEnabled: v })} />
        <Toggle label="Trade Deadline" checked={settings.tradeDeadlineEnabled} onChange={v => update({ tradeDeadlineEnabled: v })} />
        <Toggle label="Background CPU Trades" checked={settings.backgroundTradesEnabled} onChange={v => update({ backgroundTradesEnabled: v })} />
        <Toggle label="Draft Lottery" checked={settings.draftLotteryEnabled} onChange={v => update({ draftLotteryEnabled: v })} />
        <Toggle label="All-Star Weekend" checked={settings.allStarWeekendEnabled} onChange={v => update({ allStarWeekendEnabled: v })} />
      </div>

      <div className="panel p-6 space-y-1">
        <SectionLabel>Simulation</SectionLabel>
        <Select label="Difficulty" value={settings.difficulty} onChange={v => update({ difficulty: v })} options={[
          { value: 'easy', label: 'Easy' }, { value: 'normal', label: 'Normal' },
          { value: 'hard', label: 'Hard' }, { value: 'legendary', label: 'Legendary' },
        ]} />
        <Select label="Sim Speed" value={settings.simulationSpeed} onChange={v => update({ simulationSpeed: v })} options={[
          { value: 'instant', label: 'Instant' }, { value: 'fast', label: 'Fast' }, { value: 'detailed', label: 'Detailed' },
        ]} />
        <Select label="Season Length" value={String(settings.gamesPerSeason)} onChange={v => update({ gamesPerSeason: Number(v) as 82 | 72 | 58 })} options={[
          { value: '82', label: '82 Games' }, { value: '72', label: '72 Games' }, { value: '58', label: '58 Games' },
        ]} />
        <Select label="Playoff Format" value={settings.playoffFormat} onChange={v => update({ playoffFormat: v })} options={[
          { value: 'play_in', label: 'Play-In Tournament' }, { value: 'traditional_16', label: 'Traditional 16' },
        ]} />
        <Select label="Injury Frequency" value={settings.injuryFrequency} onChange={v => update({ injuryFrequency: v })} options={[
          { value: 'rare', label: 'Rare' }, { value: 'normal', label: 'Normal' },
          { value: 'frequent', label: 'Frequent' }, { value: 'brutal', label: 'Brutal' },
        ]} />
        <Select label="Trade Frequency" value={settings.tradeFrequency} onChange={v => update({ tradeFrequency: v })} options={[
          { value: 'rare', label: 'Rare' }, { value: 'normal', label: 'Normal' }, { value: 'frequent', label: 'Frequent' },
        ]} />
      </div>

      <div className="panel p-6 space-y-1">
        <SectionLabel>Auto-Stop Points</SectionLabel>
        <p className="text-xs text-gray-600 mb-2">Simulation pauses at these events so you can take action</p>
        <Toggle label="Extension Deadline" checked={settings.autoStopPoints.extensionDeadline} onChange={v => update({ autoStopPoints: { ...settings.autoStopPoints, extensionDeadline: v } })} />
        <Toggle label="Trade Deadline" checked={settings.autoStopPoints.tradeDeadline} onChange={v => update({ autoStopPoints: { ...settings.autoStopPoints, tradeDeadline: v } })} />
        <Toggle label="All-Star Break" checked={settings.autoStopPoints.allStarBreak} onChange={v => update({ autoStopPoints: { ...settings.autoStopPoints, allStarBreak: v } })} />
        <Toggle label="Playoffs Start" checked={settings.autoStopPoints.playoffsStart} onChange={v => update({ autoStopPoints: { ...settings.autoStopPoints, playoffsStart: v } })} />
        <Toggle label="Draft Lottery" checked={settings.autoStopPoints.draftLottery} onChange={v => update({ autoStopPoints: { ...settings.autoStopPoints, draftLottery: v } })} />
        <Toggle label="Draft Night" checked={settings.autoStopPoints.draftNight} onChange={v => update({ autoStopPoints: { ...settings.autoStopPoints, draftNight: v } })} />
        <Toggle label="Free Agency" checked={settings.autoStopPoints.freeAgency} onChange={v => update({ autoStopPoints: { ...settings.autoStopPoints, freeAgency: v } })} />
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!leagueName.trim()} size="lg">
          Next: Choose Team
        </Button>
      </div>
    </div>
  )
}
