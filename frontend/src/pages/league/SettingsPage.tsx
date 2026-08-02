import { useState, useEffect } from 'react'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'
import Button from '../../components/common/Button'
import { useLeague } from '../../hooks/useLeague'
import type { LeagueSettings, AutoStopConfig } from '../../types/league'

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

function Selector<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: T[]
  value: T
  onChange: (v: T) => void
  labels?: Partial<Record<T, string>>
}) {
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
          {labels?.[opt] ?? opt}
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

const DIFFICULTY_LABELS: Record<LeagueSettings['difficulty'], string> = {
  easy: 'Rookie',
  normal: 'Pro',
  hard: 'All-Star',
  legendary: 'Hall of Fame',
}

const TRADE_FREQ_LABELS: Record<LeagueSettings['tradeFrequency'], string> = {
  rare: 'Low',
  normal: 'Normal',
  frequent: 'High',
}

const INJURY_FREQ_LABELS: Record<LeagueSettings['injuryFrequency'], string> = {
  rare: 'Low',
  normal: 'Normal',
  frequent: 'High',
  brutal: 'Brutal',
}

const PLAYOFF_FORMAT_LABELS: Record<LeagueSettings['playoffFormat'], string> = {
  traditional_16: '16-team',
  play_in: '20-team-play-in',
}

export default function SettingsPage() {
  const { state, updateSettings } = useLeague()
  const [localSettings, setLocalSettings] = useState<LeagueSettings | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (state?.settings && !localSettings) {
      setLocalSettings({ ...state.settings })
    }
  }, [state, localSettings])

  if (!localSettings) {
    return (
      <PageTransition>
        <div className="text-gray-500">Loading settings...</div>
      </PageTransition>
    )
  }

  const update = <K extends keyof LeagueSettings>(key: K, value: LeagueSettings[K]) => {
    setLocalSettings(prev => (prev ? { ...prev, [key]: value } : prev))
    setSaved(false)
  }

  const updateAutoStop = <K extends keyof AutoStopConfig>(key: K, value: boolean) => {
    setLocalSettings(prev =>
      prev ? { ...prev, autoStopPoints: { ...prev.autoStopPoints, [key]: value } } : prev,
    )
    setSaved(false)
  }

  const handleSave = async () => {
    if (!localSettings) return
    await updateSettings(localSettings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
                <Toggle checked={localSettings.injuriesEnabled} onChange={(v) => update('injuriesEnabled', v)} />
              </SettingRow>
              <SettingRow label="Fatigue">
                <Toggle checked={localSettings.fatigueEnabled} onChange={(v) => update('fatigueEnabled', v)} />
              </SettingRow>
              <SettingRow label="Difficulty">
                <Selector
                  options={(['easy', 'normal', 'hard', 'legendary'] as const).slice()}
                  value={localSettings.difficulty}
                  onChange={(v) => update('difficulty', v)}
                  labels={DIFFICULTY_LABELS}
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
                  options={['82', '72', '58']}
                  value={String(localSettings.gamesPerSeason)}
                  onChange={(v) => update('gamesPerSeason', Number(v) as LeagueSettings['gamesPerSeason'])}
                />
              </SettingRow>
              <SettingRow label="Playoff Format">
                <Selector
                  options={(['traditional_16', 'play_in'] as const).slice()}
                  value={localSettings.playoffFormat}
                  onChange={(v) => update('playoffFormat', v)}
                  labels={PLAYOFF_FORMAT_LABELS}
                />
              </SettingRow>
              <SettingRow label="Quarter Length (min)">
                <Selector
                  options={['6', '8', '10', '12']}
                  value={String(localSettings.quarterLengthMinutes)}
                  onChange={(v) => update('quarterLengthMinutes', Number(v))}
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
                  options={(['rare', 'normal', 'frequent'] as const).slice()}
                  value={localSettings.tradeFrequency}
                  onChange={(v) => update('tradeFrequency', v)}
                  labels={TRADE_FREQ_LABELS}
                />
              </SettingRow>
              <SettingRow label="Injury Frequency">
                <Selector
                  options={(['rare', 'normal', 'frequent', 'brutal'] as const).slice()}
                  value={localSettings.injuryFrequency}
                  onChange={(v) => update('injuryFrequency', v)}
                  labels={INJURY_FREQ_LABELS}
                />
              </SettingRow>
              <SettingRow label="Background Trades">
                <Toggle checked={localSettings.backgroundTradesEnabled} onChange={(v) => update('backgroundTradesEnabled', v)} />
              </SettingRow>
            </div>
          </GlassCard>

          {/* Auto-Stop Points */}
          <GlassCard className="p-6">
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-4">Auto-Stop Points</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              <Checkbox
                checked={localSettings.autoStopPoints.extensionDeadline}
                onChange={(v) => updateAutoStop('extensionDeadline', v)}
                label="Extension Deadline"
              />
              <Checkbox
                checked={localSettings.autoStopPoints.tradeDeadline}
                onChange={(v) => updateAutoStop('tradeDeadline', v)}
                label="Trade Deadline"
              />
              <Checkbox
                checked={localSettings.autoStopPoints.allStarBreak}
                onChange={(v) => updateAutoStop('allStarBreak', v)}
                label="All-Star Break"
              />
              <Checkbox
                checked={localSettings.autoStopPoints.playoffsStart}
                onChange={(v) => updateAutoStop('playoffsStart', v)}
                label="Before Playoffs"
              />
              <Checkbox
                checked={localSettings.autoStopPoints.draftLottery}
                onChange={(v) => updateAutoStop('draftLottery', v)}
                label="Draft Lottery"
              />
              <Checkbox
                checked={localSettings.autoStopPoints.draftNight}
                onChange={(v) => updateAutoStop('draftNight', v)}
                label="Draft Night"
              />
              <Checkbox
                checked={localSettings.autoStopPoints.freeAgency}
                onChange={(v) => updateAutoStop('freeAgency', v)}
                label="Free Agency"
              />
            </div>
          </GlassCard>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button variant="primary" size="md" onClick={handleSave}>
              {saved ? 'Saved!' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
