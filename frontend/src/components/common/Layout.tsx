import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/hooks/useStore'
import { logout } from '@/store/slices/authSlice'
import { TrendingUp, BarChart2, LogOut, Wallet, Briefcase } from 'lucide-react'
import WalletButton from '@/components/wallet/WalletButton'

export default function Layout() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { token, user } = useAppSelector((s) => s.auth)

  const handleLogout = () => {
    dispatch(logout())
    navigate('/')
  }

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <div className="min-h-screen flex flex-col bg-surface-900">
      <header className="sticky top-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center shadow-glow-cyan">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-black text-gradient tracking-tight">Manifold</span>
            </Link>

            <nav className="flex items-center gap-1">
              <Link
                to="/markets"
                className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl transition-all duration-150 ${
                  isActive('/markets')
                    ? 'bg-surface-700 text-ink-100'
                    : 'text-ink-400 hover:text-ink-100 hover:bg-surface-700'
                }`}
              >
                <BarChart2 className="w-4 h-4" />
                Markets
              </Link>

              {token ? (
                <>
                  <Link
                    to="/portfolio"
                    className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl transition-all duration-150 ${
                      isActive('/portfolio')
                        ? 'bg-surface-700 text-ink-100'
                        : 'text-ink-400 hover:text-ink-100 hover:bg-surface-700'
                    }`}
                  >
                    <Briefcase className="w-4 h-4" />
                    Portfolio
                  </Link>

                  <div className="flex items-center gap-1.5 bg-surface-700 border border-surface-600 px-3 py-1.5 rounded-xl ml-2">
                    <Wallet className="w-3.5 h-3.5 text-brand-cyan" />
                    <span className="text-sm font-bold text-ink-100">
                      ₮{user?.balance?.toLocaleString() ?? '—'}
                    </span>
                  </div>

                  <WalletButton />

                  <button
                    onClick={handleLogout}
                    title="Logout"
                    className="p-2 rounded-xl text-ink-600 hover:text-no hover:bg-no/10 transition-all duration-150 ml-1"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-sm font-medium px-4 py-2 rounded-xl text-ink-400 hover:text-ink-100 hover:bg-surface-700 transition-all duration-150 ml-2"
                  >
                    Log In
                  </Link>
                  <Link to="/register" className="btn-primary text-sm px-5 py-2 ml-1">
                    Get Started
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
        <Outlet />
      </main>

      <footer className="border-t border-surface-600 py-6 text-center">
        <p className="text-xs text-ink-800">© 2026 Manifold · Trade the future</p>
      </footer>
    </div>
  )
}
