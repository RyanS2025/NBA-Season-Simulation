import { useState } from 'react'
import { useParams } from 'react-router-dom'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'
import Button from '../../components/common/Button'

interface Settings {
  // Gameplay
  injuries: boolean
  fatigue: boolean
  difficulty: 'Rookie' | 'Pro' | 'All-Star' | 'Hall of Fame'
  // Season
  gamesPerSeason: 82 | 58 | 41 | 28
  playoffFormat: '16-team' | '20-team-play-in'
  quarterLength: 6 | 8 | 10 | 12
  // Simulation
  tradeFrequency: 'Low' | 'Normal' | 'High'
  injuryFrequency: 'Low' | 'Normal' | 'High'
  backgroundTrades: boolean
  // Auto-Stop
  stopBeforeDraft: boolean
  stopBeforeFreeAgency: boolean
  stopBeforePlayoffs: boolean
  stopBeforeTradeDeadline: boolean
  stopEndOfSeason: boolean
  stopOnInjury: boolean
}

const DEFAULT_SETTINGS: Settings = {
  injuries: true,
  fatigue: true,
  difficulty: 'Pro',
  gamesPerSeason: 82,
  playoffFormat: '16-team',
  quarterLength: 12,
  tradeFrequency: 'Normal',
  injuryFrequency: 'Normal',
  backgroundTrades: true,
  stopBeforeDraft: true,
  stopBeforeFreeAgency: true,
  stopBeforePlayoffs: true,
  stopBeforeTradeDeadline: false,
  stopEndOfSeason: true,
  stopOnInjury: false,
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
        checked ? 'bg-[oklch(64.6%_0.222_41.116)]' : 'bg-white/[0.10]'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function Selector<T extends string>({ options, value, onChange }: { options: T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            value === opt
              ? 'bg-[oklch(64.6%_0.222_41.116)]/15 text-[oklch(64.6%_0.222_41.116)] border border-[oklch(64.6%_0.222_41.116)]/30'
              : 'bg-white/[0.04] text-gray-500 border border-white/[0.06] hover:text-white'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0">
      <span className="text-sm text-gray-300">{label}</span>
      {children}
    </div>
  )
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 py-2 cursor-pointer group">
      <div
        onClick={() => onChange(!checked)}
        className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${
          checked
            ? 'bg-[oklch(64.6%_0.222_41.116)] border-[oklch(64.6%_0.222_41.116)]'
            : 'bg-white/[0.04] border-white/[0.15] group-hover:border-white/[0.25]'
        }`}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{label}</span>
    </label>
  )
}

export default function SettingsPage() {
  const { id: _leagueId } = useParams()
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <PageTransition>
      <div>
        <h1 className="font-display text-4xl tracking-wide text-white mb-6">League Settings</h1>

        <div className="space-y-6">
          {/* Gameplay */}
          <GlassCard className="p-6">
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-4">Gameplay</h2>
            <div className="space-y-0">
              <SettingRow label="Injuries">
                <Toggle checked={settings.injuries} onChange={(v) => update('injuries', v)} />
              </SettingRow>
              <SettingRow label="Fatigue">
                <Toggle checked={settings.fatigue} onChange={(v) => update('fatigue', v)} />
              </SettingRow>
              <SettingRow label="Difficulty">
                <Selector
                  options={['Rookie', 'Pro', 'All-Star', 'Hall of Fame']}
                  value={settings.difficulty}
                  onChange={(v) => update('difficulty', v)}
                />
              </SettingRow>
            </div>
          </GlassCard>

          {/* Season */}
          <GlassCard className="p-6">
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-4">Season</h2>
            <div className="space-y-0">
              <SettingRow label="Games Per Season">
                <Selector
                  options={['82', '58', '41', '28']}
                  value={String(settings.gamesPerSeason)}
                  onChange={(v) => update('gamesPerSeason', Number(v) as Settings['gamesPerSeason'])}
                />
              </SettingRow>
              <SettingRow label="Playoff Format">
                <Selector
                  options={['16-team', '20-team-play-in']}
                  value={settings.playoffFormat}
                  onChange={(v) => update('playoffFormat', v)}
                />
              </SettingRow>
              <SettingRow label="Quarter Length (min)">
                <Selector
                  options={['6', '8', '10', '12']}
                  value={String(settings.quarterLength)}
                  onChange={(v) => update('quarterLength', Number(v) as Settings['quarterLength'])}
                />
              </SettingRow>
            </div>
          </GlassCard>

          {/* Simulation */}
          <GlassCard className="p-6">
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-4">Simulation</h2>
            <div className="space-y-0">
              <SettingRow label="Trade Frequency">
                <Selector
                  options={['Low', 'Normal', 'High']}
                  value={settings.tradeFrequency}
                  onChange={(v) => update('tradeFrequency', v)}
                />
              </SettingRow>
              <SettingRow label="Injury Frequency">
                <Selector
                  options={['Low', 'Normal', 'High']}
                  value={settings.injuryFrequency}
                  onChange={(v) => update('injuryFrequency', v)}
                />
              </SettingRow>
              <SettingRow label="Background Trades">
                <Toggle checked={settings.backgroundTrades} onChange={(v) => update('backgroundTrades', v)} />
              </SettingRow>
            </div>
          </GlassCard>

          {/* Auto-Stop Points */}
          <GlassCard className="p-6">
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-4">Auto-Stop Points</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              <Checkbox
                checked={settings.stopBeforeDraft}
                onChange={(v) => update('stopBeforeDraft', v)}
                label="Before Draft"
              />
              <Checkbox
                checked={settings.stopBeforeFreeAgency}
                onChange={(v) => update('stopBeforeFreeAgency', v)}
                label="Before Free Agency"
              />
              <Checkbox
                checked={settings.stopBeforePlayoffs}
                onChange={(v) => update('stopBeforePlayoffs', v)}
                label="Before Playoffs"
              />
              <Checkbox
                checked={settings.stopBeforeTradeDeadline}
                onChange={(v) => update('stopBeforeTradeDeadline', v)}
                label="Before Trade Deadline"
              />
              <Checkbox
                checked={settings.stopEndOfSeason}
                onChange={(v) => update('stopEndOfSeason', v)}
                label="End of Season"
              />
              <Checkbox
                checked={settings.stopOnInjury}
                onChange={(v) => update('stopOnInjury', v)}
                label="On Star Injury"
              />
            </div>
          </GlassCard>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button variant="primary" size="md">
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
