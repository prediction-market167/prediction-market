import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAppSelector } from '@/hooks/useStore'
import { useTelegramAuth } from '@/hooks/useTelegramAuth'
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import MarketsPage from '@/pages/MarketsPage'
import MarketDetailPage from '@/pages/MarketDetailPage'
import PortfolioPage from '@/pages/PortfolioPage'
import Layout from '@/components/common/Layout'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAppSelector((s) => s.auth.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  useTelegramAuth()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="markets" element={<MarketsPage />} />
          <Route path="markets/:id" element={<MarketDetailPage />} />
          <Route
            path="portfolio"
            element={
              <PrivateRoute>
                <PortfolioPage />
              </PrivateRoute>
            }
          />
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Routes>
    </BrowserRouter>
  )
}
