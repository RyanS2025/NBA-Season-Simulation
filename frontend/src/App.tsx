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
          <Route path="team" element={<MyTeamPage />} />
          <Route path="draft" element={<DraftPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
