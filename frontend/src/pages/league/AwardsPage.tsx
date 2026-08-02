import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'

type AwardsTab = 'awards' | 'allstar' | 'all-league'

const USER_TEAM_ABR = 'PHI'

// ── Award types ──

interface AwardCandidate {
  name: string
  team: string
  stat: string
  firstPlaceVotes: number
  totalPoints: number
  playerId?: string
}

interface Award {
  id: string
  name: string
  winner: { name: string; team: string; statLine: string; playerId?: string }
  candidates: AwardCandidate[]
}

// ── All-Star types ──

interface AllStarPlayer {
  name: string
  team: string
  overall: number
  ppg: number
  rpg: number
  apg: number
  starter: boolean
  playerId: string
}

interface ContestParticipant {
  name: string
  team: string
  score: number
  playerId: string
}

interface Contest {
  name: string
  winner: string
  winnerTeam: string
  winnerScore: number
  winnerPlayerId: string
  participants: ContestParticipant[]
}

// ── All-League types ──

interface AllLeaguePlayer {
  name: string
  team: string
  overall: number
  keyStats: string
  playerId: string
}

interface AllLeagueTeam {
  tier: string
  players: AllLeaguePlayer[]
}

interface AllLeagueCategory {
  name: string
  teams: AllLeagueTeam[]
}

// ── Mock Data: Awards ──

const MOCK_AWARDS: Award[] = [
  {
    id: 'mvp',
    name: 'Most Valuable Player',
    winner: { name: 'Damian Rhodes', team: 'CHI', statLine: '28.4 PPG / 5.1 RPG / 10.2 APG', playerId: 'fa1' },
    candidates: [
      { name: 'Damian Rhodes', team: 'CHI', stat: '28.4 PPG', firstPlaceVotes: 72, totalPoints: 918, playerId: 'fa1' },
      { name: 'Karl-Anthony Reed', team: 'MIL', stat: '25.1 PPG', firstPlaceVotes: 18, totalPoints: 612, playerId: 'fa2' },
      { name: 'Jayson Williams', team: 'BOS', stat: '26.8 PPG', firstPlaceVotes: 9, totalPoints: 430, playerId: 'fa3' },
      { name: 'Marcus Webb', team: 'PHI', stat: '24.2 PPG', firstPlaceVotes: 1, totalPoints: 188, playerId: 'd2' },
      { name: 'Nikolai Petrovic', team: 'DAL', stat: '23.9 PPG', firstPlaceVotes: 0, totalPoints: 104, playerId: 'd4' },
    ],
  },
  {
    id: 'dpoy',
    name: 'Defensive Player of the Year',
    winner: { name: 'Tobias Adebayo', team: 'MIA', statLine: '2.8 BPG / 1.4 SPG / 10.7 RPG', playerId: 'd3' },
    candidates: [
      { name: 'Tobias Adebayo', team: 'MIA', stat: '2.8 BPG', firstPlaceVotes: 56, totalPoints: 744, playerId: 'd3' },
      { name: 'Devin Okafor', team: 'CLE', stat: '1.9 SPG', firstPlaceVotes: 24, totalPoints: 510, playerId: 'd5' },
      { name: 'Zion Palmer', team: 'GSW', stat: '2.1 BPG', firstPlaceVotes: 14, totalPoints: 388, playerId: 'd10' },
      { name: 'Andre Baptiste', team: 'DEN', stat: '1.7 SPG', firstPlaceVotes: 4, totalPoints: 202, playerId: 'd7' },
      { name: 'Tyrell Jackson', team: 'ATL', stat: '2.4 BPG', firstPlaceVotes: 2, totalPoints: 156, playerId: 'd9' },
    ],
  },
  {
    id: 'roy',
    name: 'Rookie of the Year',
    winner: { name: 'Jalen Crawford', team: 'MIN', statLine: '19.4 PPG / 3.8 RPG / 7.1 APG', playerId: 'd1' },
    candidates: [
      { name: 'Jalen Crawford', team: 'MIN', stat: '19.4 PPG', firstPlaceVotes: 82, totalPoints: 960, playerId: 'd1' },
      { name: 'Kai Tanaka', team: 'LAV', stat: '17.8 PPG', firstPlaceVotes: 12, totalPoints: 490, playerId: 'd8' },
      { name: 'Kwame Mensah', team: 'TOR', stat: '12.1 RPG', firstPlaceVotes: 4, totalPoints: 280, playerId: 'd14' },
      { name: 'Isaiah Washington', team: 'PHX', stat: '14.2 PPG', firstPlaceVotes: 2, totalPoints: 164, playerId: 'd21' },
      { name: 'Luka Marinovic', team: 'NYT', stat: '6.8 APG', firstPlaceVotes: 0, totalPoints: 88, playerId: 'd24' },
    ],
  },
  {
    id: '6moty',
    name: 'Sixth Man of the Year',
    winner: { name: 'Gary Trent IV', team: 'PHI', statLine: '16.2 PPG / 3.1 RPG / 2.4 APG', playerId: 'fa14' },
    candidates: [
      { name: 'Gary Trent IV', team: 'PHI', stat: '16.2 PPG', firstPlaceVotes: 48, totalPoints: 620, playerId: 'fa14' },
      { name: 'Jaylen Morris', team: 'PHX', stat: '15.4 PPG', firstPlaceVotes: 28, totalPoints: 488, playerId: 'd26' },
      { name: 'Bobby Portis III', team: 'GSW', stat: '13.8 PPG', firstPlaceVotes: 14, totalPoints: 310, playerId: 'fa12' },
      { name: 'Ish Smith III', team: 'BOS', stat: '8.2 APG', firstPlaceVotes: 6, totalPoints: 178, playerId: 'fa16' },
      { name: 'Chris Novak', team: 'DEN', stat: '11.9 PPG', firstPlaceVotes: 4, totalPoints: 122, playerId: 'd22' },
    ],
  },
  {
    id: 'mip',
    name: 'Most Improved Player',
    winner: { name: 'Darnell Brooks', team: 'DAL', statLine: '18.7 PPG / 4.2 RPG / 2.8 APG', playerId: 'd13' },
    candidates: [
      { name: 'Darnell Brooks', team: 'DAL', stat: '+8.5 PPG', firstPlaceVotes: 60, totalPoints: 780, playerId: 'd13' },
      { name: 'Emeka Obi', team: 'TOR', stat: '+6.2 PPG', firstPlaceVotes: 20, totalPoints: 420, playerId: 'd11' },
      { name: 'Santiago Reyes', team: 'CLE', stat: '+4.8 APG', firstPlaceVotes: 12, totalPoints: 314, playerId: 'd12' },
      { name: 'Jamal Foster', team: 'ATL', stat: '+5.1 PPG', firstPlaceVotes: 6, totalPoints: 196, playerId: 'd17' },
      { name: 'Damien Frost', team: 'MIL', stat: '+7.3 PPG', firstPlaceVotes: 2, totalPoints: 108, playerId: 'd20' },
    ],
  },
  {
    id: 'clutch',
    name: 'Clutch Player of the Year',
    winner: { name: 'Nikolai Petrovic', team: 'DAL', statLine: '6.4 Clutch PPG / 52% FG / 44% 3PT', playerId: 'd4' },
    candidates: [
      { name: 'Nikolai Petrovic', team: 'DAL', stat: '6.4 Clutch PPG', firstPlaceVotes: 44, totalPoints: 590, playerId: 'd4' },
      { name: 'Damian Rhodes', team: 'CHI', stat: '5.9 Clutch PPG', firstPlaceVotes: 30, totalPoints: 502, playerId: 'fa1' },
      { name: 'Jaylen Watkins', team: 'DEN', stat: '5.2 Clutch PPG', firstPlaceVotes: 16, totalPoints: 344, playerId: 'd6' },
      { name: 'Marcus Webb', team: 'PHI', stat: '4.8 Clutch PPG', firstPlaceVotes: 8, totalPoints: 218, playerId: 'd2' },
      { name: 'Jalen Suggs Jr.', team: 'GSW', stat: '4.5 Clutch PPG', firstPlaceVotes: 2, totalPoints: 142, playerId: 'fa6' },
    ],
  },
  {
    id: 'coty',
    name: 'Coach of the Year',
    winner: { name: 'Marcus Thompson', team: 'CHI', statLine: '58-24 / 1st Seed / +6.8 Net Rtg' },
    candidates: [
      { name: 'Marcus Thompson', team: 'CHI', stat: '58-24', firstPlaceVotes: 52, totalPoints: 698 },
      { name: 'Sarah Mitchell', team: 'BOS', stat: '56-26', firstPlaceVotes: 24, totalPoints: 480 },
      { name: 'David Park', team: 'MIN', stat: '54-28', firstPlaceVotes: 14, totalPoints: 368 },
      { name: 'Antonio Reyes', team: 'DAL', stat: '52-30', firstPlaceVotes: 8, totalPoints: 244 },
      { name: 'James O\'Brien', team: 'PHI', stat: '50-32', firstPlaceVotes: 2, totalPoints: 158 },
    ],
  },
  {
    id: 'eoty',
    name: 'Executive of the Year',
    winner: { name: 'Rachel Kim', team: 'MIN', statLine: 'Built contender via draft + trades' },
    candidates: [
      { name: 'Rachel Kim', team: 'MIN', stat: 'Draft haul', firstPlaceVotes: 40, totalPoints: 560 },
      { name: 'Michael Torres', team: 'MIA', stat: 'Key trades', firstPlaceVotes: 28, totalPoints: 448 },
      { name: 'Jonathan Blake', team: 'CHI', stat: 'Cap mastery', firstPlaceVotes: 18, totalPoints: 344 },
      { name: 'Priya Patel', team: 'CLE', stat: 'Rebuild', firstPlaceVotes: 10, totalPoints: 230 },
      { name: 'Derek Lawson', team: 'DAL', stat: 'FA signings', firstPlaceVotes: 4, totalPoints: 142 },
    ],
  },
]

// ── Mock Data: All-Star Weekend ──

const EAST_ALL_STARS: AllStarPlayer[] = [
  { name: 'Damian Rhodes', team: 'CHI', overall: 96, ppg: 28.4, rpg: 5.1, apg: 10.2, starter: true, playerId: 'fa1' },
  { name: 'Marcus Webb', team: 'PHI', overall: 93, ppg: 24.2, rpg: 8.8, apg: 4.1, starter: true, playerId: 'd2' },
  { name: 'Jayson Williams', team: 'BOS', overall: 92, ppg: 26.8, rpg: 7.2, apg: 4.6, starter: true, playerId: 'fa3' },
  { name: 'Tobias Adebayo', team: 'MIA', overall: 91, ppg: 16.4, rpg: 12.1, apg: 2.8, starter: true, playerId: 'd3' },
  { name: 'Devin Okafor', team: 'CLE', overall: 89, ppg: 20.1, rpg: 6.4, apg: 3.2, starter: true, playerId: 'd5' },
  { name: 'Santiago Reyes', team: 'CLE', overall: 86, ppg: 14.8, rpg: 3.2, apg: 9.1, starter: false, playerId: 'd12' },
  { name: 'Terrence Mann Jr.', team: 'ATL', overall: 85, ppg: 19.6, rpg: 4.8, apg: 4.0, starter: false, playerId: 'fa4' },
  { name: 'Pascal Okafor', team: 'TOR', overall: 84, ppg: 18.2, rpg: 9.4, apg: 2.6, starter: false, playerId: 'fa5' },
  { name: 'Wendell Carter IV', team: 'MIL', overall: 83, ppg: 15.1, rpg: 10.2, apg: 2.2, starter: false, playerId: 'fa8' },
  { name: 'Gary Trent IV', team: 'PHI', overall: 82, ppg: 16.2, rpg: 3.1, apg: 2.4, starter: false, playerId: 'fa14' },
  { name: 'Marcus Smart II', team: 'BOS', overall: 82, ppg: 13.8, rpg: 4.0, apg: 5.6, starter: false, playerId: 'fa7' },
  { name: 'Emeka Obi', team: 'TOR', overall: 81, ppg: 14.4, rpg: 8.8, apg: 1.8, starter: false, playerId: 'd11' },
]

const WEST_ALL_STARS: AllStarPlayer[] = [
  { name: 'Karl-Anthony Reed', team: 'MIL', overall: 95, ppg: 25.1, rpg: 12.4, apg: 3.4, starter: true, playerId: 'fa2' },
  { name: 'Nikolai Petrovic', team: 'DAL', overall: 93, ppg: 23.9, rpg: 4.6, apg: 5.8, starter: true, playerId: 'd4' },
  { name: 'Jalen Crawford', team: 'MIN', overall: 90, ppg: 19.4, rpg: 3.8, apg: 7.1, starter: true, playerId: 'd1' },
  { name: 'Zion Palmer', team: 'GSW', overall: 88, ppg: 18.6, rpg: 6.8, apg: 2.4, starter: true, playerId: 'd10' },
  { name: 'Jaylen Watkins', team: 'DEN', overall: 87, ppg: 17.2, rpg: 3.4, apg: 8.4, starter: true, playerId: 'd6' },
  { name: 'Darnell Brooks', team: 'DAL', overall: 85, ppg: 18.7, rpg: 4.2, apg: 2.8, starter: false, playerId: 'd13' },
  { name: 'Andre Baptiste', team: 'DEN', overall: 84, ppg: 15.8, rpg: 8.6, apg: 2.8, starter: false, playerId: 'd7' },
  { name: 'Tyrell Jackson', team: 'ATL', overall: 83, ppg: 12.4, rpg: 11.2, apg: 1.6, starter: false, playerId: 'd9' },
  { name: 'Jalen Suggs Jr.', team: 'GSW', overall: 83, ppg: 16.8, rpg: 3.2, apg: 7.6, starter: false, playerId: 'fa6' },
  { name: 'Kai Tanaka', team: 'LAV', overall: 82, ppg: 17.8, rpg: 2.8, apg: 3.2, starter: false, playerId: 'd8' },
  { name: 'Kentavious Pope', team: 'PHX', overall: 81, ppg: 14.6, rpg: 3.6, apg: 2.0, starter: false, playerId: 'fa9' },
  { name: 'Larry Nance IV', team: 'DAL', overall: 80, ppg: 12.8, rpg: 8.4, apg: 2.6, starter: false, playerId: 'fa10' },
]

const MOCK_CONTESTS: Contest[] = [
  {
    name: '3-Point Contest',
    winner: 'Nikolai Petrovic',
    winnerTeam: 'DAL',
    winnerScore: 28,
    winnerPlayerId: 'd4',
    participants: [
      { name: 'Nikolai Petrovic', team: 'DAL', score: 28, playerId: 'd4' },
      { name: 'Darnell Brooks', team: 'DAL', score: 25, playerId: 'd13' },
      { name: 'Gary Trent IV', team: 'PHI', score: 23, playerId: 'fa14' },
      { name: 'Kai Tanaka', team: 'LAV', score: 21, playerId: 'd8' },
      { name: 'Chris Novak', team: 'DEN', score: 19, playerId: 'd22' },
      { name: 'Jaylen Morris', team: 'PHX', score: 17, playerId: 'd26' },
    ],
  },
  {
    name: 'Dunk Contest',
    winner: 'Jalen Crawford',
    winnerTeam: 'MIN',
    winnerScore: 48,
    winnerPlayerId: 'd1',
    participants: [
      { name: 'Jalen Crawford', team: 'MIN', score: 48, playerId: 'd1' },
      { name: 'Zion Palmer', team: 'GSW', score: 45, playerId: 'd10' },
      { name: 'Isaiah Washington', team: 'PHX', score: 44, playerId: 'd21' },
      { name: 'Kwame Mensah', team: 'TOR', score: 40, playerId: 'd14' },
    ],
  },
  {
    name: 'Skills Challenge',
    winner: 'Jaylen Watkins',
    winnerTeam: 'DEN',
    winnerScore: 1,
    winnerPlayerId: 'd6',
    participants: [
      { name: 'Jaylen Watkins', team: 'DEN', score: 1, playerId: 'd6' },
      { name: 'Damian Rhodes', team: 'CHI', score: 2, playerId: 'fa1' },
      { name: 'Santiago Reyes', team: 'CLE', score: 3, playerId: 'd12' },
      { name: 'Jalen Suggs Jr.', team: 'GSW', score: 4, playerId: 'fa6' },
      { name: 'Marcus Smart II', team: 'BOS', score: 5, playerId: 'fa7' },
      { name: 'Tyus Jones Jr.', team: 'MIA', score: 6, playerId: 'fa11' },
    ],
  },
]

const ALL_STAR_GAME = {
  eastScore: 142,
  westScore: 148,
  mvp: { name: 'Karl-Anthony Reed', team: 'MIL', statLine: '34 PTS / 14 REB / 5 AST', playerId: 'fa2' },
}

// ── Mock Data: All-League Teams ──

const ALL_LEAGUE_CATEGORIES: AllLeagueCategory[] = [
  {
    name: 'All-NBA Teams',
    teams: [
      {
        tier: '1st Team',
        players: [
          { name: 'Damian Rhodes', team: 'CHI', overall: 96, keyStats: '28.4 PPG / 10.2 APG', playerId: 'fa1' },
          { name: 'Nikolai Petrovic', team: 'DAL', overall: 93, keyStats: '23.9 PPG / 5.8 APG', playerId: 'd4' },
          { name: 'Jayson Williams', team: 'BOS', overall: 92, keyStats: '26.8 PPG / 7.2 RPG', playerId: 'fa3' },
          { name: 'Marcus Webb', team: 'PHI', overall: 93, keyStats: '24.2 PPG / 8.8 RPG', playerId: 'd2' },
          { name: 'Karl-Anthony Reed', team: 'MIL', overall: 95, keyStats: '25.1 PPG / 12.4 RPG', playerId: 'fa2' },
        ],
      },
      {
        tier: '2nd Team',
        players: [
          { name: 'Jaylen Watkins', team: 'DEN', overall: 87, keyStats: '17.2 PPG / 8.4 APG', playerId: 'd6' },
          { name: 'Devin Okafor', team: 'CLE', overall: 89, keyStats: '20.1 PPG / 6.4 RPG', playerId: 'd5' },
          { name: 'Zion Palmer', team: 'GSW', overall: 88, keyStats: '18.6 PPG / 6.8 RPG', playerId: 'd10' },
          { name: 'Andre Baptiste', team: 'DEN', overall: 84, keyStats: '15.8 PPG / 8.6 RPG', playerId: 'd7' },
          { name: 'Tobias Adebayo', team: 'MIA', overall: 91, keyStats: '16.4 PPG / 12.1 RPG', playerId: 'd3' },
        ],
      },
      {
        tier: '3rd Team',
        players: [
          { name: 'Jalen Crawford', team: 'MIN', overall: 90, keyStats: '19.4 PPG / 7.1 APG', playerId: 'd1' },
          { name: 'Darnell Brooks', team: 'DAL', overall: 85, keyStats: '18.7 PPG / 4.2 RPG', playerId: 'd13' },
          { name: 'Terrence Mann Jr.', team: 'ATL', overall: 85, keyStats: '19.6 PPG / 4.8 RPG', playerId: 'fa4' },
          { name: 'Pascal Okafor', team: 'TOR', overall: 84, keyStats: '18.2 PPG / 9.4 RPG', playerId: 'fa5' },
          { name: 'Wendell Carter IV', team: 'MIL', overall: 83, keyStats: '15.1 PPG / 10.2 RPG', playerId: 'fa8' },
        ],
      },
    ],
  },
  {
    name: 'All-Defensive Teams',
    teams: [
      {
        tier: '1st Team',
        players: [
          { name: 'Marcus Smart II', team: 'BOS', overall: 82, keyStats: '1.8 SPG / 4.2 DWS', playerId: 'fa7' },
          { name: 'Devin Okafor', team: 'CLE', overall: 89, keyStats: '1.9 SPG / 5.1 DWS', playerId: 'd5' },
          { name: 'Zion Palmer', team: 'GSW', overall: 88, keyStats: '1.6 SPG / 2.1 BPG', playerId: 'd10' },
          { name: 'Andre Baptiste', team: 'DEN', overall: 84, keyStats: '1.4 SPG / 1.8 BPG', playerId: 'd7' },
          { name: 'Tobias Adebayo', team: 'MIA', overall: 91, keyStats: '2.8 BPG / 1.4 SPG', playerId: 'd3' },
        ],
      },
      {
        tier: '2nd Team',
        players: [
          { name: 'Santiago Reyes', team: 'CLE', overall: 86, keyStats: '1.4 SPG / 3.8 DWS', playerId: 'd12' },
          { name: 'Kentavious Pope', team: 'PHX', overall: 81, keyStats: '1.6 SPG / 3.4 DWS', playerId: 'fa9' },
          { name: 'Jayson Williams', team: 'BOS', overall: 92, keyStats: '1.2 SPG / 1.0 BPG', playerId: 'fa3' },
          { name: 'Emeka Obi', team: 'TOR', overall: 81, keyStats: '1.1 SPG / 1.6 BPG', playerId: 'd11' },
          { name: 'Karl-Anthony Reed', team: 'MIL', overall: 95, keyStats: '2.2 BPG / 0.8 SPG', playerId: 'fa2' },
        ],
      },
    ],
  },
  {
    name: 'All-Rookie Teams',
    teams: [
      {
        tier: '1st Team',
        players: [
          { name: 'Jalen Crawford', team: 'MIN', overall: 90, keyStats: '19.4 PPG / 7.1 APG', playerId: 'd1' },
          { name: 'Kai Tanaka', team: 'LAV', overall: 82, keyStats: '17.8 PPG / 3.2 APG', playerId: 'd8' },
          { name: 'Kwame Mensah', team: 'TOR', overall: 78, keyStats: '10.2 PPG / 12.1 RPG', playerId: 'd14' },
          { name: 'Isaiah Washington', team: 'PHX', overall: 76, keyStats: '14.2 PPG / 4.8 RPG', playerId: 'd21' },
          { name: 'Luka Marinovic', team: 'NYT', overall: 74, keyStats: '8.4 PPG / 6.8 APG', playerId: 'd24' },
        ],
      },
      {
        tier: '2nd Team',
        players: [
          { name: 'Victor Sousa', team: 'DAL', overall: 72, keyStats: '9.8 PPG / 4.2 APG', playerId: 'd29' },
          { name: 'Pierre Dubois', team: 'ATL', overall: 71, keyStats: '8.6 PPG / 4.4 RPG', playerId: 'd18' },
          { name: 'Trevor Ellis', team: 'DEN', overall: 73, keyStats: '7.2 PPG / 1.8 SPG', playerId: 'd15' },
          { name: 'Nate Russell', team: 'MIL', overall: 70, keyStats: '6.8 PPG / 5.2 RPG', playerId: 'd28' },
          { name: 'Damien Frost', team: 'GSW', overall: 72, keyStats: '8.1 PPG / 6.4 RPG', playerId: 'd20' },
        ],
      },
    ],
  },
]

// ── Component ──

export default function AwardsPage() {
  const { id: leagueId } = useParams()
  const [activeTab, setActiveTab] = useState<AwardsTab>('awards')
  const [expandedAward, setExpandedAward] = useState<string | null>(null)

  const tabs: { id: AwardsTab; label: string }[] = [
    { id: 'awards', label: 'Awards' },
    { id: 'allstar', label: 'All-Star Weekend' },
    { id: 'all-league', label: 'All-League Teams' },
  ]

  return (
    <PageTransition>
      <div>
        <h1 className="font-display text-4xl tracking-wide text-white mb-6">Season Awards</h1>

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

        {/* ── Tab 1: Awards ── */}
        {activeTab === 'awards' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {MOCK_AWARDS.map(award => {
              const isExpanded = expandedAward === award.id
              const winner = award.candidates[0]
              const runnerUp = award.candidates[1]
              const isUserTeam = award.winner.team === USER_TEAM_ABR

              return (
                <GlassCard
                  key={award.id}
                  className={`cursor-pointer transition-all duration-200 ${
                    isExpanded ? 'md:col-span-2 xl:col-span-3' : ''
                  }`}
                  onClick={() => setExpandedAward(isExpanded ? null : award.id)}
                >
                  {/* Gold top border accent */}
                  <div className="h-0.5 rounded-t-xl bg-gradient-to-r from-amber-500/60 via-yellow-400/80 to-amber-500/60" />

                  <div className="p-5">
                    {/* Award Name */}
                    <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">
                      {award.name}
                    </div>

                    {/* Winner */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className={`text-xl font-display tracking-wide ${isUserTeam ? 'text-[oklch(64.6%_0.222_41.116)]' : 'text-white'}`}>
                          {award.winner.playerId ? (
                            <Link to={`/league/${leagueId}/players/${award.winner.playerId}`} className="hover:text-[oklch(64.6%_0.222_41.116)] transition-colors">
                              {award.winner.name}
                            </Link>
                          ) : award.winner.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{award.winner.team}</div>
                      </div>
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0">
                        <span className="text-amber-400 text-lg">&#9733;</span>
                      </div>
                    </div>

                    {/* Stat Line */}
                    <div className="text-sm text-gray-300 mb-4">{award.winner.statLine}</div>

                    {/* Vote Summary */}
                    <div className="flex gap-4 text-xs text-gray-500 mb-1">
                      <span>
                        <span className="text-gray-300 font-medium">{winner.firstPlaceVotes}</span> 1st votes
                      </span>
                      <span>
                        <span className="text-gray-300 font-medium">{winner.totalPoints}</span> pts
                      </span>
                      <span>
                        Runner-up: {runnerUp.playerId ? (
                          <Link to={`/league/${leagueId}/players/${runnerUp.playerId}`} className="text-gray-400 hover:text-[oklch(64.6%_0.222_41.116)] transition-colors">{runnerUp.name}</Link>
                        ) : <span className="text-gray-400">{runnerUp.name}</span>}
                      </span>
                    </div>

                    {/* Expanded: Full Voting */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-white/[0.06]">
                        <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">
                          Full Voting Results
                        </div>
                        <div className="space-y-2">
                          {award.candidates.map((c, i) => {
                            const barWidth = winner.totalPoints > 0
                              ? (c.totalPoints / winner.totalPoints) * 100
                              : 0
                            const isCandidateUser = c.team === USER_TEAM_ABR
                            return (
                              <div key={c.name} className="flex items-center gap-3">
                                <div className="w-5 text-right">
                                  <span className={`text-xs font-medium ${i === 0 ? 'text-amber-400' : 'text-gray-500'}`}>
                                    {i + 1}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      {c.playerId ? (
                                        <Link to={`/league/${leagueId}/players/${c.playerId}`} className={`text-sm font-medium ${isCandidateUser ? 'text-[oklch(64.6%_0.222_41.116)]' : 'text-gray-300'} hover:text-[oklch(64.6%_0.222_41.116)] transition-colors`}>
                                          {c.name}
                                        </Link>
                                      ) : (
                                        <span className={`text-sm font-medium ${isCandidateUser ? 'text-[oklch(64.6%_0.222_41.116)]' : 'text-gray-300'}`}>
                                          {c.name}
                                        </span>
                                      )}
                                      <span className="text-xs text-gray-600">{c.team}</span>
                                      <span className="text-xs text-gray-500">{c.stat}</span>
                                    </div>
                                    <div className="flex gap-3 text-xs text-gray-500 shrink-0">
                                      <span>{c.firstPlaceVotes} 1st</span>
                                      <span className="text-gray-300 font-medium">{c.totalPoints} pts</span>
                                    </div>
                                  </div>
                                  <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        i === 0 ? 'bg-amber-400' : 'bg-gray-600'
                                      }`}
                                      style={{ width: `${barWidth}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Expand hint */}
                    <div className="text-center mt-3">
                      <span className="text-[10px] uppercase tracking-[2px] text-gray-600">
                        {isExpanded ? 'Click to collapse' : 'Click for full results'}
                      </span>
                    </div>
                  </div>
                </GlassCard>
              )
            })}
          </div>
        )}

        {/* ── Tab 2: All-Star Weekend ── */}
        {activeTab === 'allstar' && (
          <div>
            {/* All-Star Teams */}
            <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">All-Star Rosters</div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
              {/* East */}
              <GlassCard className="overflow-hidden" variant="medium">
                <div className="px-5 py-3 border-b border-white/[0.06]">
                  <span className="font-display text-lg tracking-wide text-white">Eastern Conference</span>
                </div>
                <div>
                  {EAST_ALL_STARS.map((p, i) => {
                    const isUser = p.team === USER_TEAM_ABR
                    const isFirstReserve = !p.starter && (i === 0 || EAST_ALL_STARS[i - 1].starter)
                    return (
                      <div key={p.name}>
                        {isFirstReserve && (
                          <div className="px-5 py-2 border-t border-white/[0.06] bg-white/[0.02]">
                            <span className="text-[10px] uppercase tracking-[2px] text-gray-600">Reserves</span>
                          </div>
                        )}
                        <div
                          className={`flex items-center gap-4 px-5 py-3 border-b border-white/[0.03] ${
                            isUser ? 'bg-[oklch(64.6%_0.222_41.116)]/[0.06]' : ''
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <Link
                              to={`/league/${leagueId}/players/${p.playerId}`}
                              className={`text-sm ${p.starter ? 'font-semibold' : 'font-normal'} ${isUser ? 'text-[oklch(64.6%_0.222_41.116)]' : 'text-white'} hover:text-[oklch(64.6%_0.222_41.116)] transition-colors`}
                            >
                              {p.name}
                            </Link>
                            <span className="text-xs text-gray-500 ml-2">{p.team}</span>
                          </div>
                          <div className="flex gap-3 text-xs text-gray-400 shrink-0">
                            <span className={p.overall >= 90 ? 'text-[oklch(64.6%_0.222_41.116)] font-semibold' : p.overall >= 85 ? 'text-green-400' : ''}>{p.overall} OVR</span>
                            <span className="w-12 text-right">{p.ppg} PPG</span>
                            <span className="w-12 text-right">{p.rpg} RPG</span>
                            <span className="w-12 text-right">{p.apg} APG</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </GlassCard>

              {/* West */}
              <GlassCard className="overflow-hidden" variant="medium">
                <div className="px-5 py-3 border-b border-white/[0.06]">
                  <span className="font-display text-lg tracking-wide text-white">Western Conference</span>
                </div>
                <div>
                  {WEST_ALL_STARS.map((p, i) => {
                    const isUser = p.team === USER_TEAM_ABR
                    const isFirstReserve = !p.starter && (i === 0 || WEST_ALL_STARS[i - 1].starter)
                    return (
                      <div key={p.name}>
                        {isFirstReserve && (
                          <div className="px-5 py-2 border-t border-white/[0.06] bg-white/[0.02]">
                            <span className="text-[10px] uppercase tracking-[2px] text-gray-600">Reserves</span>
                          </div>
                        )}
                        <div
                          className={`flex items-center gap-4 px-5 py-3 border-b border-white/[0.03] ${
                            isUser ? 'bg-[oklch(64.6%_0.222_41.116)]/[0.06]' : ''
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <Link
                              to={`/league/${leagueId}/players/${p.playerId}`}
                              className={`text-sm ${p.starter ? 'font-semibold' : 'font-normal'} ${isUser ? 'text-[oklch(64.6%_0.222_41.116)]' : 'text-white'} hover:text-[oklch(64.6%_0.222_41.116)] transition-colors`}
                            >
                              {p.name}
                            </Link>
                            <span className="text-xs text-gray-500 ml-2">{p.team}</span>
                          </div>
                          <div className="flex gap-3 text-xs text-gray-400 shrink-0">
                            <span className={p.overall >= 90 ? 'text-[oklch(64.6%_0.222_41.116)] font-semibold' : p.overall >= 85 ? 'text-green-400' : ''}>{p.overall} OVR</span>
                            <span className="w-12 text-right">{p.ppg} PPG</span>
                            <span className="w-12 text-right">{p.rpg} RPG</span>
                            <span className="w-12 text-right">{p.apg} APG</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </GlassCard>
            </div>

            {/* Contest Results */}
            <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Contest Results</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {MOCK_CONTESTS.map(contest => (
                <GlassCard key={contest.name} className="p-5" variant="medium">
                  <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">{contest.name}</div>

                  {/* Winner */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <span className="text-amber-400 text-lg">&#9733;</span>
                    </div>
                    <div>
                      <Link to={`/league/${leagueId}/players/${contest.winnerPlayerId}`} className="text-white font-display tracking-wide hover:text-[oklch(64.6%_0.222_41.116)] transition-colors">{contest.winner}</Link>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{contest.winnerTeam}</span>
                        {contest.name !== 'Skills Challenge' && (
                          <span>Score: <span className="text-amber-400 font-medium">{contest.winnerScore}</span></span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* All Participants */}
                  <div className="space-y-1.5">
                    {contest.participants.map((p, i) => {
                      const isUser = p.team === USER_TEAM_ABR
                      return (
                        <div key={p.name} className={`flex items-center gap-2 text-sm ${i === 0 ? 'text-amber-400' : isUser ? 'text-[oklch(64.6%_0.222_41.116)]' : 'text-gray-400'}`}>
                          <span className="w-4 text-right text-xs text-gray-600">{i + 1}</span>
                          <Link to={`/league/${leagueId}/players/${p.playerId}`} className="flex-1 hover:text-[oklch(64.6%_0.222_41.116)] transition-colors">{p.name}</Link>
                          <span className="text-xs text-gray-500">{p.team}</span>
                          <span className="text-xs font-medium w-8 text-right">
                            {contest.name === 'Skills Challenge' ? '' : p.score}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </GlassCard>
              ))}
            </div>

            {/* All-Star Game Result */}
            <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">All-Star Game</div>
            <GlassCard className="p-6" variant="medium">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10">
                {/* East */}
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-1">East</div>
                  <div className={`text-4xl font-display ${ALL_STAR_GAME.eastScore > ALL_STAR_GAME.westScore ? 'text-[oklch(64.6%_0.222_41.116)]' : 'text-gray-400'}`}>
                    {ALL_STAR_GAME.eastScore}
                  </div>
                </div>

                {/* Divider */}
                <div className="text-gray-600 text-2xl font-display">VS</div>

                {/* West */}
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-1">West</div>
                  <div className={`text-4xl font-display ${ALL_STAR_GAME.westScore > ALL_STAR_GAME.eastScore ? 'text-[oklch(64.6%_0.222_41.116)]' : 'text-gray-400'}`}>
                    {ALL_STAR_GAME.westScore}
                  </div>
                </div>
              </div>

              {/* All-Star Game MVP */}
              <div className="mt-5 pt-4 border-t border-white/[0.06] text-center">
                <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-2">All-Star Game MVP</div>
                <Link to={`/league/${leagueId}/players/${ALL_STAR_GAME.mvp.playerId}`} className="text-lg font-display tracking-wide text-amber-400 hover:text-[oklch(64.6%_0.222_41.116)] transition-colors">{ALL_STAR_GAME.mvp.name}</Link>
                <div className="text-xs text-gray-500 mt-0.5">{ALL_STAR_GAME.mvp.team}</div>
                <div className="text-sm text-gray-300 mt-1">{ALL_STAR_GAME.mvp.statLine}</div>
              </div>
            </GlassCard>
          </div>
        )}

        {/* ── Tab 3: All-League Teams ── */}
        {activeTab === 'all-league' && (
          <div className="space-y-8">
            {ALL_LEAGUE_CATEGORIES.map(category => (
              <div key={category.name}>
                <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">{category.name}</div>
                <div className="space-y-4">
                  {category.teams.map(team => (
                    <GlassCard key={team.tier} className="overflow-hidden" variant="medium">
                      <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-3">
                        <span className="font-display text-lg tracking-wide text-white">{team.tier}</span>
                        {team.tier === '1st Team' && (
                          <div className="h-0.5 flex-1 bg-gradient-to-r from-amber-500/40 to-transparent rounded" />
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 divide-x divide-white/[0.03]">
                        {team.players.map(player => {
                          const isUser = player.team === USER_TEAM_ABR
                          return (
                            <div
                              key={player.name}
                              className={`px-4 py-4 text-center ${isUser ? 'bg-[oklch(64.6%_0.222_41.116)]/[0.06]' : ''}`}
                            >
                              <Link
                                to={`/league/${leagueId}/players/${player.playerId}`}
                                className={`text-sm font-medium mb-0.5 block ${isUser ? 'text-[oklch(64.6%_0.222_41.116)]' : 'text-white'} hover:text-[oklch(64.6%_0.222_41.116)] transition-colors`}
                              >
                                {player.name}
                              </Link>
                              <div className="text-xs text-gray-500 mb-2">{player.team}</div>
                              <div className={`text-lg font-display mb-1 ${
                                player.overall >= 90 ? 'text-[oklch(64.6%_0.222_41.116)]' : player.overall >= 85 ? 'text-green-400' : 'text-gray-300'
                              }`}>
                                {player.overall}
                              </div>
                              <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-0.5">OVR</div>
                              <div className="text-xs text-gray-400 mt-2">{player.keyStats}</div>
                            </div>
                          )
                        })}
                      </div>
                    </GlassCard>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  )
}
