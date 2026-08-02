import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageTransition from '../components/layout/PageTransition'
import StepSettings from '../components/league-creation/StepSettings'
import StepTeamSelect from '../components/league-creation/StepTeamSelect'
import StepConfirm from '../components/league-creation/StepConfirm'
import { DEFAULT_LEAGUE_SETTINGS } from '../data'
import type { LeagueSettings } from '../types'

export default function CreateLeaguePage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [leagueName, setLeagueName] = useState('')
  const [settings, setSettings] = useState<LeagueSettings>(DEFAULT_LEAGUE_SETTINGS)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                s === step ? 'bg-accent text-white' : s < step ? 'bg-accent/20 text-accent' : 'bg-white/[0.06] text-gray-600'
              }`}>
                {s}
              </div>
              <span className={`text-sm hidden sm:inline ${s === step ? 'text-white' : 'text-gray-600'}`}>
                {s === 1 ? 'Settings' : s === 2 ? 'Choose Team' : 'Confirm'}
              </span>
              {s < 3 && <div className="w-8 h-px bg-white/[0.08]" />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <StepSettings
            leagueName={leagueName}
            onLeagueNameChange={setLeagueName}
            settings={settings}
            onSettingsChange={setSettings}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <StepTeamSelect
            selectedTeamId={selectedTeamId}
            onSelect={setSelectedTeamId}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <StepConfirm
            leagueName={leagueName}
            settings={settings}
            selectedTeamId={selectedTeamId!}
            onBack={() => setStep(2)}
            onCreated={(leagueId) => navigate(`/league/${leagueId}`)}
          />
        )}
      </div>
    </PageTransition>
  )
}
