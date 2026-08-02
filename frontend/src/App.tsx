import { BrowserRouter, Routes, Route } from 'react-router-dom'
import SiteLayout from './components/layout/SiteLayout'
import LeagueLayout from './components/layout/LeagueLayout'
import HomePage from './pages/HomePage'
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'
import CreateLeaguePage from './pages/CreateLeaguePage'
import LeagueDashboard from './pages/league/LeagueDashboard'
import StandingsPage from './pages/league/StandingsPage'
import SchedulePage from './pages/league/SchedulePage'
import ScoresPage from './pages/league/ScoresPage'
import TradePage from './pages/league/TradePage'
import PlayersPage from './pages/league/PlayersPage'
import MyTeamPage from './pages/league/MyTeamPage'
import DraftPage from './pages/league/DraftPage'
import FreeAgencyPage from './pages/league/FreeAgencyPage'
import AwardsPage from './pages/league/AwardsPage'
import TransactionsPage from './pages/league/TransactionsPage'
import LeagueHistoryPage from './pages/league/LeagueHistoryPage'
import SettingsPage from './pages/league/SettingsPage'
import PlayerDetailPage from './pages/league/PlayerDetailPage'
import PlayoffsPage from './pages/league/PlayoffsPage'
import StaffPage from './pages/league/StaffPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/league/new" element={<CreateLeaguePage />} />
        </Route>

        <Route path="/league/:id" element={<LeagueLayout />}>
          <Route index element={<LeagueDashboard />} />
          <Route path="standings" element={<StandingsPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="scores" element={<ScoresPage />} />
          <Route path="trades" element={<TradePage />} />
          <Route path="players" element={<PlayersPage />} />
          <Route path="players/:playerId" element={<PlayerDetailPage />} />
          <Route path="team" element={<MyTeamPage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="draft" element={<DraftPage />} />
          <Route path="free-agency" element={<FreeAgencyPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="awards" element={<AwardsPage />} />
          <Route path="playoffs" element={<PlayoffsPage />} />
          <Route path="history" element={<LeagueHistoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
