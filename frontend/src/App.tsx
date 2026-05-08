import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAppSelector } from '@/hooks/useStore'
import { useTelegramAuth } from '@/hooks/useTelegramAuth'
import HomePage from '@/pages/HomePage'
import MarketsPage from '@/pages/MarketsPage'
import MarketDetailPage from '@/pages/MarketDetailPage'
import PortfolioPage from '@/pages/PortfolioPage'
import ProfilePage from '@/pages/ProfilePage'
import LeaderboardPage from '@/pages/LeaderboardPage'
import AdminPage from '@/pages/AdminPage'
import Layout from '@/components/common/Layout'

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAppSelector((s) => s.auth)
  if (user && !user.is_superuser) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  const { loading, isTelegram } = useTelegramAuth()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout loading={loading} isTelegram={isTelegram} />}>
          <Route index element={<HomePage />} />
          <Route path="markets" element={<MarketsPage />} />
          <Route path="markets/:id" element={<MarketDetailPage />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route
            path="admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />
        </Route>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/register" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
