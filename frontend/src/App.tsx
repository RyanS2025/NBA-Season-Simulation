import { BrowserRouter, Routes, Route } from 'react-router-dom'
import SiteLayout from './components/layout/SiteLayout'
import LeagueLayout from './components/layout/LeagueLayout'
import HomePage from './pages/HomePage'
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'
import CreateLeaguePage from './pages/CreateLeaguePage'
import LeagueDashboard from './pages/league/LeagueDashboard'

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
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
