import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import SiteLayout from './components/layout/SiteLayout'
import LeagueLayout from './components/layout/LeagueLayout'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import ErrorBoundary from './components/common/ErrorBoundary'
import LoadingSpinner from './components/common/LoadingSpinner'

const AboutPage = lazy(() => import('./pages/AboutPage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const CreateLeaguePage = lazy(() => import('./pages/CreateLeaguePage'))
const LeagueDashboard = lazy(() => import('./pages/league/LeagueDashboard'))
const StandingsPage = lazy(() => import('./pages/league/StandingsPage'))
const SchedulePage = lazy(() => import('./pages/league/SchedulePage'))
const ScoresPage = lazy(() => import('./pages/league/ScoresPage'))
const TradePage = lazy(() => import('./pages/league/TradePage'))
const PlayersPage = lazy(() => import('./pages/league/PlayersPage'))
const MyTeamPage = lazy(() => import('./pages/league/MyTeamPage'))
const DraftPage = lazy(() => import('./pages/league/DraftPage'))
const FreeAgencyPage = lazy(() => import('./pages/league/FreeAgencyPage'))
const AwardsPage = lazy(() => import('./pages/league/AwardsPage'))
const TransactionsPage = lazy(() => import('./pages/league/TransactionsPage'))
const LeagueHistoryPage = lazy(() => import('./pages/league/LeagueHistoryPage'))
const SettingsPage = lazy(() => import('./pages/league/SettingsPage'))
const PlayerDetailPage = lazy(() => import('./pages/league/PlayerDetailPage'))
const PlayoffsPage = lazy(() => import('./pages/league/PlayoffsPage'))
const StaffPage = lazy(() => import('./pages/league/StaffPage'))
const CoachingPage = lazy(() => import('./pages/league/CoachingPage'))
const AllStarPage = lazy(() => import('./pages/league/AllStarPage'))
const TradeDeadlinePage = lazy(() => import('./pages/league/TradeDeadlinePage'))

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner message="Loading..." />}>
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
          <Route path="coaching" element={<CoachingPage />} />
          <Route path="draft" element={<DraftPage />} />
          <Route path="free-agency" element={<FreeAgencyPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="awards" element={<AwardsPage />} />
          <Route path="playoffs" element={<PlayoffsPage />} />
          <Route path="all-star" element={<AllStarPage />} />
          <Route path="trade-deadline" element={<TradeDeadlinePage />} />
          <Route path="history" element={<LeagueHistoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
