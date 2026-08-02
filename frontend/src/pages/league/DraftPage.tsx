import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'
import DataTable from '../../components/common/DataTable'
import SearchInput from '../../components/common/SearchInput'
import Button from '../../components/common/Button'
import type { DraftProspect } from '../../types'

type DraftTab = 'prospects' | 'mock' | 'draft-night'
type PositionFilter = 'ALL' | 'PG' | 'SG' | 'SF' | 'PF' | 'C'

const POSITION_FILTERS: PositionFilter[] = ['ALL', 'PG', 'SG', 'SF', 'PF', 'C']

const USER_TEAM_ID = 'PHI'
const USER_TEAM_NAME = 'Philadelphia Ironworks'

// --- Mock Data ---

const MOCK_PROSPECTS: DraftProspect[] = [
  // Lottery talents (projected 78-88)
  { id: 'd1', name: 'Jalen Crawford', position: 'PG', age: 19, school: 'Duke', projectedOverall: [82, 88], ceiling: 95, floor: 78, strengths: ['Elite court vision', 'Explosive first step', 'Natural leader'], weaknesses: ['Inconsistent jumper', 'Slight frame'], comparison: 'A young Ja Morant with better passing instincts', scoutingLevel: 3 },
  { id: 'd2', name: 'Marcus Webb', position: 'PF', age: 20, school: 'Kentucky', projectedOverall: [80, 86], ceiling: 93, floor: 76, strengths: ['Versatile scorer', 'Elite wingspan', 'Switchable defender'], weaknesses: ['Tunnel vision on offense', 'Free throw concerns'], comparison: 'Reminiscent of a young Jayson Tatum', scoutingLevel: 2 },
  { id: 'd3', name: 'Tobias Adebayo', position: 'C', age: 19, school: 'Overtime Elite', projectedOverall: [79, 85], ceiling: 92, floor: 74, strengths: ['Dominant rim protector', 'Soft touch around basket', 'Elite motor'], weaknesses: ['Limited perimeter game', 'Foul-prone'], comparison: 'A more athletic Rudy Gobert with developing offense', scoutingLevel: 2 },
  { id: 'd4', name: 'Nikolai Petrovic', position: 'SG', age: 20, school: 'Partizan Belgrade', projectedOverall: [78, 84], ceiling: 91, floor: 73, strengths: ['Silky shooting stroke', 'High basketball IQ', 'Crafty finisher'], weaknesses: ['Below-average lateral quickness', 'Passive in big moments'], comparison: 'A taller Bogdan Bogdanovic with more range', scoutingLevel: 1 },

  // First rounders (projected 68-78)
  { id: 'd5', name: 'Devin Okafor', position: 'SF', age: 20, school: 'North Carolina', projectedOverall: [73, 78], ceiling: 86, floor: 70, strengths: ['Elite two-way wing', 'Strong rebounder for position', 'Transition finisher'], weaknesses: ['Inconsistent three-point shot', 'Average playmaking'], comparison: 'Similar mold to Mikal Bridges', scoutingLevel: 3 },
  { id: 'd6', name: 'Jaylen Watkins', position: 'PG', age: 19, school: 'Gonzaga', projectedOverall: [72, 77], ceiling: 85, floor: 68, strengths: ['Lightning-quick handles', 'Pull-up mid-range game', 'Tough competitor'], weaknesses: ['Undersized at 6\'0"', 'Decision-making under pressure'], comparison: 'Plays like a young Mike Conley', scoutingLevel: 2 },
  { id: 'd7', name: 'Andre Baptiste', position: 'PF', age: 21, school: 'Villanova', projectedOverall: [71, 76], ceiling: 84, floor: 69, strengths: ['Stretch-four shooting', 'Strong post moves', 'Physical defender'], weaknesses: ['Limited foot speed', 'Older prospect'], comparison: 'A more versatile Al Horford', scoutingLevel: 1 },
  { id: 'd8', name: 'Kai Tanaka', position: 'SG', age: 19, school: 'Japan B.League', projectedOverall: [70, 78], ceiling: 87, floor: 65, strengths: ['Electric scorer', 'Deep three-point range', 'Fan-favorite energy'], weaknesses: ['Defensive lapses', 'Shot selection issues'], comparison: 'Japanese Anfernee Simons with higher upside', scoutingLevel: 0 },
  { id: 'd9', name: 'Tyrell Jackson', position: 'C', age: 20, school: 'Alabama', projectedOverall: [71, 76], ceiling: 83, floor: 68, strengths: ['Anchor defender', 'Elite screen-setter', 'Bruising rebounder'], weaknesses: ['No perimeter offense', 'Below-average passer'], comparison: 'Cut from the Steven Adams cloth', scoutingLevel: 2 },
  { id: 'd10', name: 'Zion Palmer', position: 'SF', age: 19, school: 'USC', projectedOverall: [70, 76], ceiling: 85, floor: 66, strengths: ['Explosive athlete', 'Lockdown wing defender', 'Transition weapon'], weaknesses: ['Jumper needs work', 'Turnover-prone'], comparison: 'Resembles a young OG Anunoby', scoutingLevel: 1 },
  { id: 'd11', name: 'Emeka Obi', position: 'PF', age: 20, school: 'Michigan State', projectedOverall: [69, 75], ceiling: 82, floor: 67, strengths: ['Physical paint presence', 'Improving jumper', 'High motor'], weaknesses: ['Foul trouble', 'Limited passing'], comparison: 'A more skilled Montrezl Harrell', scoutingLevel: 3 },
  { id: 'd12', name: 'Santiago Reyes', position: 'PG', age: 21, school: 'Real Madrid', projectedOverall: [69, 75], ceiling: 81, floor: 68, strengths: ['Floor general', 'Crafty in pick-and-roll', 'Mature game'], weaknesses: ['Average athlete', 'Struggles against length'], comparison: 'A Spanish Ricky Rubio with better shooting', scoutingLevel: 1 },
  { id: 'd13', name: 'Darnell Brooks', position: 'SG', age: 20, school: 'UCLA', projectedOverall: [68, 74], ceiling: 80, floor: 66, strengths: ['Sharpshooting specialist', 'Disciplined off-ball mover', 'Smart defender'], weaknesses: ['Limited creation ability', 'Average size'], comparison: 'A more athletic Buddy Hield', scoutingLevel: 2 },
  { id: 'd14', name: 'Kwame Mensah', position: 'C', age: 19, school: 'NBA Academy Africa', projectedOverall: [68, 76], ceiling: 86, floor: 62, strengths: ['Raw athleticism', 'Massive 7\'5" wingspan', 'Shot-blocking upside'], weaknesses: ['Very raw offensively', 'Needs strength'], comparison: 'A project like young Giannis at center', scoutingLevel: 0 },

  // Second rounders (projected 62-72)
  { id: 'd15', name: 'Trevor Ellis', position: 'SF', age: 22, school: 'Oregon', projectedOverall: [66, 72], ceiling: 78, floor: 64, strengths: ['3-and-D profile', 'Reliable corner shooter', 'Good length'], weaknesses: ['Limited upside', 'Older prospect'], comparison: 'An affordable P.J. Tucker type', scoutingLevel: 2 },
  { id: 'd16', name: 'Marcus Kim', position: 'PG', age: 21, school: 'Virginia', projectedOverall: [65, 71], ceiling: 77, floor: 63, strengths: ['Turnover-free point guard', 'Solid defender', 'High character'], weaknesses: ['Lacks elite burst', 'Average shooter'], comparison: 'A steadier T.J. McConnell', scoutingLevel: 3 },
  { id: 'd17', name: 'Jamal Foster', position: 'SG', age: 20, school: 'Texas', projectedOverall: [65, 70], ceiling: 76, floor: 62, strengths: ['Good size at 6\'6"', 'Physical perimeter defender', 'Improving handle'], weaknesses: ['Streaky shooter', 'Below-average finisher'], comparison: 'A young Josh Richardson', scoutingLevel: 1 },
  { id: 'd18', name: 'Pierre Dubois', position: 'PF', age: 20, school: 'ASVEL Lyon', projectedOverall: [64, 70], ceiling: 78, floor: 60, strengths: ['Smooth stroke from four', 'Smart cutter', 'Good feel for game'], weaknesses: ['Physically weak', 'Slow laterally'], comparison: 'Gallinari-lite with defensive questions', scoutingLevel: 0 },
  { id: 'd19', name: 'Ricky Torres', position: 'PG', age: 22, school: 'Baylor', projectedOverall: [64, 69], ceiling: 74, floor: 62, strengths: ['Fearless driver', 'Tough-nosed competitor', 'Good free throw rate'], weaknesses: ['Undersized', 'Below-average passer'], comparison: 'A budget Derrick White', scoutingLevel: 2 },
  { id: 'd20', name: 'Damien Frost', position: 'C', age: 21, school: 'Arizona', projectedOverall: [64, 70], ceiling: 76, floor: 61, strengths: ['Mobile big', 'Developing three-point shot', 'Rim runner'], weaknesses: ['Inconsistent motor', 'Skinny frame'], comparison: 'A budget Brook Lopez without the range yet', scoutingLevel: 1 },
  { id: 'd21', name: 'Isaiah Washington', position: 'SF', age: 19, school: 'Auburn', projectedOverall: [63, 71], ceiling: 80, floor: 58, strengths: ['Explosive vertical leap', 'Raw defensive talent', 'Highlight reel dunker'], weaknesses: ['Very raw skill set', 'Poor shot selection'], comparison: 'Needs development -- think Hamidou Diallo', scoutingLevel: 0 },
  { id: 'd22', name: 'Chris Novak', position: 'SG', age: 22, school: 'Butler', projectedOverall: [63, 68], ceiling: 73, floor: 61, strengths: ['Reliable catch-and-shoot', 'Team-first mentality', 'Floor spacer'], weaknesses: ['Limited athleticism', 'Defensive liability'], comparison: 'A depth-chart Joe Harris', scoutingLevel: 2 },
  { id: 'd23', name: 'Omar Williams', position: 'PF', age: 21, school: 'Tennessee', projectedOverall: [63, 69], ceiling: 75, floor: 60, strengths: ['Relentless rebounder', 'Physical screener', 'Good hands'], weaknesses: ['No outside shot', 'Foul-prone'], comparison: 'Similar energy to Ed Davis', scoutingLevel: 1 },
  { id: 'd24', name: 'Luka Marinovic', position: 'PG', age: 19, school: 'Crvena Zvezda', projectedOverall: [62, 70], ceiling: 79, floor: 56, strengths: ['Creative passer', 'Crafty in half-court', 'Good size for position'], weaknesses: ['Questionable motor', 'Gambles on defense'], comparison: 'Boom-or-bust -- a younger Vasilije Micic', scoutingLevel: 0 },
  { id: 'd25', name: 'Derek Anthony', position: 'C', age: 22, school: 'Houston', projectedOverall: [63, 68], ceiling: 73, floor: 61, strengths: ['Strong post defender', 'Smart positioning', 'Veteran-like poise'], weaknesses: ['Below-average athlete', 'Limited offensive bag'], comparison: 'A role-playing Cody Zeller', scoutingLevel: 3 },
  { id: 'd26', name: 'Jaylen Morris', position: 'SG', age: 20, school: 'Arkansas', projectedOverall: [62, 68], ceiling: 74, floor: 59, strengths: ['High-volume scorer', 'Quick release', 'Gets to the line'], weaknesses: ['Shot selection', 'Below-average defender'], comparison: 'A microwave scorer like Lou Williams', scoutingLevel: 1 },
  { id: 'd27', name: 'Aaron Blackwell', position: 'SF', age: 21, school: 'Florida State', projectedOverall: [62, 67], ceiling: 72, floor: 60, strengths: ['Long defender', 'Good transition game', 'Team player'], weaknesses: ['Half-court offense limited', 'Injury history'], comparison: 'A role-player in the Dorian Finney-Smith mold', scoutingLevel: 2 },
  { id: 'd28', name: 'Nate Russell', position: 'PF', age: 20, school: 'Iowa', projectedOverall: [62, 67], ceiling: 73, floor: 60, strengths: ['Stretch-four potential', 'Hard worker', 'Solid rebounder'], weaknesses: ['Tweener size', 'Average athlete'], comparison: 'A developmental Davis Bertans', scoutingLevel: 0 },
  { id: 'd29', name: 'Victor Sousa', position: 'PG', age: 20, school: 'Flamengo', projectedOverall: [62, 68], ceiling: 75, floor: 58, strengths: ['Blazing speed', 'Creative finisher', 'Fearless competitor'], weaknesses: ['Out of control at times', 'Defensive attention span'], comparison: 'A raw Dennis Schroder with more flash', scoutingLevel: 0 },
  { id: 'd30', name: 'Brandon Hunt', position: 'C', age: 21, school: 'Kansas', projectedOverall: [62, 67], ceiling: 72, floor: 60, strengths: ['High IQ screen-and-roll big', 'Disciplined defender', 'Durable'], weaknesses: ['Limited ceiling', 'Not a rim protector'], comparison: 'A career backup center -- think Daniel Theis', scoutingLevel: 1 },
]

const MOCK_DRAFT_TEAMS = [
  'Minnesota Blizzard', 'Toronto Raptides', 'Cleveland Ironclad',
  'Atlanta Phoenixes', 'Milwaukee Stags', USER_TEAM_NAME,
  'Dallas Mustangs', 'Denver Altitude', 'Phoenix Scorchers',
  'Chicago Forge', 'Miami Tides', 'Golden State Samurai',
  'Los Angeles Vipers', 'Boston Minutemen', 'New York Titans',
  'Minnesota Blizzard', 'Toronto Raptides', 'Cleveland Ironclad',
  'Atlanta Phoenixes', 'Milwaukee Stags', 'Dallas Mustangs',
  'Denver Altitude', 'Phoenix Scorchers', 'Chicago Forge',
  'Miami Tides', 'Golden State Samurai', 'Los Angeles Vipers',
  'Boston Minutemen', 'New York Titans', USER_TEAM_NAME,
  // Round 2
  'Minnesota Blizzard', 'Toronto Raptides', 'Cleveland Ironclad',
  'Atlanta Phoenixes', 'Milwaukee Stags', USER_TEAM_NAME,
  'Dallas Mustangs', 'Denver Altitude', 'Phoenix Scorchers',
  'Chicago Forge', 'Miami Tides', 'Golden State Samurai',
  'Los Angeles Vipers', 'Boston Minutemen', 'New York Titans',
  'Minnesota Blizzard', 'Toronto Raptides', 'Cleveland Ironclad',
  'Atlanta Phoenixes', 'Milwaukee Stags', 'Dallas Mustangs',
  'Denver Altitude', 'Phoenix Scorchers', 'Chicago Forge',
  'Miami Tides', 'Golden State Samurai', 'Los Angeles Vipers',
  'Boston Minutemen', 'New York Titans', USER_TEAM_NAME,
]

function getTier(low: number, high: number): 'lottery' | 'first' | 'second' {
  const mid = (low + high) / 2
  if (mid >= 78) return 'lottery'
  if (mid >= 68) return 'first'
  return 'second'
}

function tierColor(tier: 'lottery' | 'first' | 'second'): string {
  if (tier === 'lottery') return 'text-[oklch(64.6%_0.222_41.116)]'
  if (tier === 'first') return 'text-green-400'
  return 'text-gray-400'
}

function tierBadge(tier: 'lottery' | 'first' | 'second'): string {
  if (tier === 'lottery') return 'bg-[oklch(64.6%_0.222_41.116)]/15 text-[oklch(64.6%_0.222_41.116)] border-[oklch(64.6%_0.222_41.116)]/30'
  if (tier === 'first') return 'bg-green-400/15 text-green-400 border-green-400/30'
  return 'bg-gray-500/15 text-gray-500 border-gray-500/30'
}

export default function DraftPage() {
  const { id: _leagueId } = useParams()
  const [activeTab, setActiveTab] = useState<DraftTab>('prospects')
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState<PositionFilter>('ALL')
  const [expandedProspect, setExpandedProspect] = useState<string | null>(null)

  // Draft Night state
  const [draftActive] = useState(true)
  const [currentPick, setCurrentPick] = useState(1)
  const [draftedPlayers, setDraftedPlayers] = useState<{ pick: number; team: string; prospect: DraftProspect }[]>([])

  const availableProspects = useMemo(() => {
    const draftedIds = new Set(draftedPlayers.map(d => d.prospect.id))
    return MOCK_PROSPECTS.filter(p => !draftedIds.has(p.id))
  }, [draftedPlayers])

  // Prospect Board filtering
  const filteredProspects = useMemo(() => {
    return MOCK_PROSPECTS.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.school.toLowerCase().includes(search.toLowerCase())
      const matchesPos = posFilter === 'ALL' || p.position === posFilter
      return matchesSearch && matchesPos
    })
  }, [search, posFilter])

  const columns: {
    key: string
    label: string
    sortable?: boolean
    align?: 'left' | 'center' | 'right'
    render?: (row: DraftProspect, index: number) => React.ReactNode
  }[] = [
    {
      key: 'rank',
      label: '#',
      align: 'center',
      width: '48px',
      render: (_row, index) => <span className="text-gray-500 font-medium">{index + 1}</span>,
    } as typeof columns[number] & { width?: string },
    {
      key: 'name',
      label: 'Player',
      sortable: true,
      render: (row) => {
        const tier = getTier(row.projectedOverall[0], row.projectedOverall[1])
        return <span className={`font-medium ${tierColor(tier)}`}>{row.name}</span>
      },
    },
    {
      key: 'position',
      label: 'Pos',
      align: 'center',
      render: (row) => <span className="text-gray-400">{row.position}</span>,
    },
    { key: 'age', label: 'Age', sortable: true, align: 'center' },
    {
      key: 'school',
      label: 'School',
      render: (row) => <span className="text-gray-400">{row.school}</span>,
    },
    {
      key: 'projectedOverall',
      label: 'Proj OVR',
      sortable: true,
      align: 'center',
      render: (row) => {
        const tier = getTier(row.projectedOverall[0], row.projectedOverall[1])
        return (
          <span className={`px-2 py-0.5 rounded text-xs border ${tierBadge(tier)}`}>
            {row.projectedOverall[0]}--{row.projectedOverall[1]}
          </span>
        )
      },
    },
    {
      key: 'ceiling',
      label: 'Ceil',
      sortable: true,
      align: 'center',
      render: (row) => (
        <span className={row.ceiling >= 90 ? 'text-[oklch(64.6%_0.222_41.116)] font-semibold' : row.ceiling >= 80 ? 'text-green-400' : 'text-gray-300'}>
          {row.ceiling}
        </span>
      ),
    },
    {
      key: 'floor',
      label: 'Floor',
      sortable: true,
      align: 'center',
      render: (row) => (
        <span className={row.floor >= 70 ? 'text-green-400' : row.floor >= 60 ? 'text-gray-300' : 'text-red-400'}>
          {row.floor}
        </span>
      ),
    },
  ]

  const handleDraftPlayer = (prospect: DraftProspect) => {
    const team = MOCK_DRAFT_TEAMS[currentPick - 1] || 'Unknown'
    setDraftedPlayers(prev => [...prev, { pick: currentPick, team, prospect }])
    setCurrentPick(prev => prev + 1)
  }

  const simulatePick = () => {
    if (currentPick > 60 || availableProspects.length === 0) return
    const team = MOCK_DRAFT_TEAMS[currentPick - 1] || 'Unknown'
    // CPU picks the best available prospect
    const bestAvailable = availableProspects[0]
    setDraftedPlayers(prev => [...prev, { pick: currentPick, team, prospect: bestAvailable }])
    setCurrentPick(prev => prev + 1)
  }

  const isUserPick = draftActive && currentPick <= 60 && MOCK_DRAFT_TEAMS[currentPick - 1] === USER_TEAM_NAME
  const currentTeamOnClock = currentPick <= 60 ? MOCK_DRAFT_TEAMS[currentPick - 1] : null

  const tabs: { id: DraftTab; label: string }[] = [
    { id: 'prospects', label: 'Prospect Board' },
    { id: 'mock', label: 'Mock Draft' },
    { id: 'draft-night', label: 'Draft Night' },
  ]

  return (
    <PageTransition>
      <div>
        <h1 className="font-display text-4xl tracking-wide text-white mb-6">Draft Center</h1>

        {/* Tab Bar */}
        <div className="flex gap-1 mb-6 bg-white/[0.03] rounded-xl p-1 w-fit border border-white/[0.06]">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-[oklch(64.6%_0.222_41.116)]/15 text-[oklch(64.6%_0.222_41.116)]'
                  : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* --- Tab 1: Prospect Board --- */}
        {activeTab === 'prospects' && (
          <div>
            {/* Search + Position Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <SearchInput
                placeholder="Search prospects or schools..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="sm:max-w-sm"
              />
              <div className="flex gap-1">
                {POSITION_FILTERS.map(pos => (
                  <button
                    key={pos}
                    onClick={() => setPosFilter(pos)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      posFilter === pos
                        ? 'text-[oklch(64.6%_0.222_41.116)] bg-[oklch(64.6%_0.222_41.116)]/10'
                        : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            {/* Prospect Table */}
            <DataTable
              columns={columns}
              data={filteredProspects}
              keyExtractor={(row) => row.id}
              onRowClick={(row) => setExpandedProspect(expandedProspect === row.id ? null : row.id)}
              emptyMessage="No prospects match your search"
            />

            {/* Expanded Scouting Report */}
            {expandedProspect && (() => {
              const prospect = MOCK_PROSPECTS.find(p => p.id === expandedProspect)
              if (!prospect) return null
              const tier = getTier(prospect.projectedOverall[0], prospect.projectedOverall[1])
              return (
                <GlassCard className="p-6 mt-4" variant="medium">
                  <div className="flex flex-col lg:flex-row gap-6">
                    {/* Left: Header + Comparison */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <h3 className={`text-xl font-display tracking-wide ${tierColor(tier)}`}>
                          {prospect.name}
                        </h3>
                        <span className={`px-2 py-0.5 rounded text-xs border ${tierBadge(tier)}`}>
                          {tier === 'lottery' ? 'Lottery' : tier === 'first' ? '1st Round' : '2nd Round'}
                        </span>
                      </div>
                      <div className="flex gap-4 text-sm text-gray-400 mb-4">
                        <span>{prospect.position}</span>
                        <span>{prospect.age} yrs</span>
                        <span>{prospect.school}</span>
                      </div>

                      <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-2">Player Comparison</div>
                      <p className="text-sm text-gray-300 mb-4 italic">&quot;{prospect.comparison}&quot;</p>

                      <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-2">Scouting Level</div>
                      <div className="flex gap-1.5 mb-4">
                        {[0, 1, 2, 3].map(level => (
                          <div
                            key={level}
                            className={`w-3 h-3 rounded-full transition-colors ${
                              level < prospect.scoutingLevel
                                ? 'bg-[oklch(64.6%_0.222_41.116)]'
                                : 'bg-white/[0.08]'
                            }`}
                          />
                        ))}
                        <span className="text-xs text-gray-500 ml-2">
                          {prospect.scoutingLevel === 0 && 'Unscouted'}
                          {prospect.scoutingLevel === 1 && 'Basic Report'}
                          {prospect.scoutingLevel === 2 && 'Detailed'}
                          {prospect.scoutingLevel === 3 && 'Full Profile'}
                        </span>
                      </div>
                    </div>

                    {/* Right: Strengths / Weaknesses + Action */}
                    <div className="lg:w-72">
                      <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-2">Strengths</div>
                      <div className="space-y-1.5 mb-4">
                        {prospect.strengths.map((s, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                            <span className="text-gray-300">{s}</span>
                          </div>
                        ))}
                      </div>

                      <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-2">Weaknesses</div>
                      <div className="space-y-1.5 mb-5">
                        {prospect.weaknesses.map((w, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                            <span className="text-gray-300">{w}</span>
                          </div>
                        ))}
                      </div>

                      <Button variant="primary" size="sm" className="w-full">
                        Assign Scout
                      </Button>
                    </div>
                  </div>
                </GlassCard>
              )
            })()}
          </div>
        )}

        {/* --- Tab 2: Mock Draft --- */}
        {activeTab === 'mock' && (
          <div>
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Projected Selections</h2>
            <div className="space-y-2">
              {MOCK_DRAFT_TEAMS.slice(0, 60).map((team, i) => {
                const prospect = MOCK_PROSPECTS[i] || null
                const isUser = team === USER_TEAM_NAME
                const round = i < 30 ? 1 : 2
                const pickInRound = i < 30 ? i + 1 : i - 29
                return (
                  <GlassCard
                    key={i}
                    className={`px-5 py-3 ${isUser ? 'border-[oklch(64.6%_0.222_41.116)]/30 bg-[oklch(64.6%_0.222_41.116)]/[0.06]' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 text-center">
                        <span className={`text-lg font-display ${isUser ? 'text-[oklch(64.6%_0.222_41.116)]' : 'text-gray-500'}`}>
                          {i + 1}
                        </span>
                      </div>
                      <div className="w-px h-8 bg-white/[0.06]" />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${isUser ? 'text-[oklch(64.6%_0.222_41.116)]' : 'text-white'}`}>
                          {team}
                        </div>
                        <div className="text-[10px] uppercase tracking-[2px] text-gray-600">
                          Round {round}, Pick {pickInRound}
                        </div>
                      </div>
                      {prospect && (
                        <div className="flex items-center gap-3 text-right">
                          <div>
                            <div className="text-sm text-gray-300">{prospect.name}</div>
                            <div className="text-xs text-gray-500">{prospect.position} -- {prospect.school}</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs border ${tierBadge(getTier(prospect.projectedOverall[0], prospect.projectedOverall[1]))}`}>
                            {prospect.projectedOverall[0]}--{prospect.projectedOverall[1]}
                          </span>
                        </div>
                      )}
                    </div>
                  </GlassCard>
                )
              })}
            </div>
          </div>
        )}

        {/* --- Tab 3: Draft Night --- */}
        {activeTab === 'draft-night' && (
          <div>
            {/* Current Pick Indicator */}
            {currentPick <= 60 && currentTeamOnClock ? (
              <GlassCard className="p-5 mb-6" variant="medium">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-[oklch(64.6%_0.222_41.116)]/15 border border-[oklch(64.6%_0.222_41.116)]/30">
                      <span className="text-xl font-display text-[oklch(64.6%_0.222_41.116)]">{currentPick}</span>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[2px] text-gray-600">On The Clock</div>
                      <div className={`text-lg font-display tracking-wide ${isUserPick ? 'text-[oklch(64.6%_0.222_41.116)]' : 'text-white'}`}>
                        {currentTeamOnClock}
                      </div>
                    </div>
                  </div>
                  {!isUserPick && (
                    <Button variant="secondary" size="sm" onClick={simulatePick}>
                      Simulate Pick
                    </Button>
                  )}
                </div>
              </GlassCard>
            ) : (
              <GlassCard className="p-5 mb-6" variant="medium">
                <div className="text-center py-4">
                  <div className="text-lg font-display text-[oklch(64.6%_0.222_41.116)] mb-1">Draft Complete</div>
                  <div className="text-sm text-gray-500">All 60 picks have been made</div>
                </div>
              </GlassCard>
            )}

            {/* User Pick: Show available prospects */}
            {isUserPick && (
              <div className="mb-6">
                <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Make Your Selection</h2>
                <div className="space-y-2">
                  {availableProspects.slice(0, 15).map(prospect => {
                    const tier = getTier(prospect.projectedOverall[0], prospect.projectedOverall[1])
                    return (
                      <GlassCard key={prospect.id} className="px-5 py-3">
                        <div className="flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${tierColor(tier)}`}>{prospect.name}</div>
                            <div className="text-xs text-gray-500">{prospect.position} -- {prospect.school}</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs border ${tierBadge(tier)}`}>
                            {prospect.projectedOverall[0]}--{prospect.projectedOverall[1]}
                          </span>
                          <div className="text-xs text-gray-500 w-16 text-center">
                            Ceil {prospect.ceiling}
                          </div>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleDraftPlayer(prospect)}
                          >
                            Draft
                          </Button>
                        </div>
                      </GlassCard>
                    )
                  })}
                </div>
              </div>
            )}

            {/* CPU Pick Announcement */}
            {!isUserPick && draftedPlayers.length > 0 && currentPick <= 61 && (() => {
              const lastPick = draftedPlayers[draftedPlayers.length - 1]
              return (
                <GlassCard className="p-5 mb-6">
                  <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-2">Latest Selection</div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/[0.06]">
                      <span className="text-sm font-display text-gray-400">{lastPick.pick}</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-medium">
                        {lastPick.team} selects{' '}
                        <span className="text-[oklch(64.6%_0.222_41.116)]">{lastPick.prospect.name}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {lastPick.prospect.position} from {lastPick.prospect.school} -- Projected {lastPick.prospect.projectedOverall[0]}--{lastPick.prospect.projectedOverall[1]} OVR
                      </div>
                    </div>
                  </div>
                </GlassCard>
              )
            })()}

            {/* Draft History */}
            {draftedPlayers.length > 0 && (
              <div>
                <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Draft History</h2>
                <GlassCard className="overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    {[...draftedPlayers].reverse().map(entry => {
                      const isUser = entry.team === USER_TEAM_NAME
                      const tier = getTier(entry.prospect.projectedOverall[0], entry.prospect.projectedOverall[1])
                      return (
                        <div
                          key={entry.pick}
                          className={`flex items-center gap-4 px-5 py-3 border-b border-white/[0.03] ${
                            isUser ? 'bg-[oklch(64.6%_0.222_41.116)]/[0.04]' : ''
                          }`}
                        >
                          <div className="w-10 text-center">
                            <span className={`text-sm font-display ${isUser ? 'text-[oklch(64.6%_0.222_41.116)]' : 'text-gray-500'}`}>
                              {entry.pick}
                            </span>
                          </div>
                          <div className="w-px h-6 bg-white/[0.06]" />
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm ${isUser ? 'text-[oklch(64.6%_0.222_41.116)]' : 'text-gray-400'}`}>
                              {entry.team}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-medium ${tierColor(tier)}`}>{entry.prospect.name}</div>
                            <div className="text-xs text-gray-500">
                              {entry.prospect.position} -- {entry.prospect.school}
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs border ${tierBadge(tier)} shrink-0`}>
                            {entry.prospect.projectedOverall[0]}--{entry.prospect.projectedOverall[1]}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </GlassCard>
              </div>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  )
}
