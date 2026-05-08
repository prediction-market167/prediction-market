import { Outlet, Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppSelector } from '@/hooks/useStore'
import { TrendingUp, Swords, Briefcase, ShieldCheck, UserCircle, Star, Loader2 } from 'lucide-react'
import WalletButton from '@/components/wallet/WalletButton'
import LanguageSwitcher from './LanguageSwitcher'

interface Props {
  loading: boolean
  isTelegram: boolean
}

function NotInTelegram() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-900 px-6">
      <div className="text-center max-w-sm animate-slide-up">
        <div className="w-16 h-16 bg-gradient-brand rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-glow-cyan">
          <TrendingUp className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-black text-ink-100 mb-3">{t('auth.telegramOnly')}</h1>
        <p className="text-ink-500 text-sm leading-relaxed">{t('auth.telegramOnlyDesc')}</p>
      </div>
    </div>
  )
}

function AuthLoading() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-900">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <Loader2 className="w-8 h-8 text-brand-cyan animate-spin" />
        <p className="text-sm text-ink-500 font-medium">{t('auth.connecting')}</p>
      </div>
    </div>
  )
}

export default function Layout({ loading, isTelegram }: Props) {
  const { t } = useTranslation()
  const location = useLocation()
  const { user } = useAppSelector((s) => s.auth)

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  // While auto-auth is in progress, show spinner
  if (loading) return <AuthLoading />

  // Outside Telegram — show friendly gate
  if (!isTelegram) return <NotInTelegram />

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
                className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl transition-all duration-150 ${
                  isActive('/markets')
                    ? 'bg-surface-700 text-ink-100'
                    : 'text-ink-400 hover:text-ink-100 hover:bg-surface-700'
                }`}
              >
                <Swords className="w-4 h-4" />
                <span className="hidden sm:inline">{t('nav.markets')}</span>
              </Link>

              <Link
                to="/portfolio"
                className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl transition-all duration-150 ${
                  isActive('/portfolio')
                    ? 'bg-surface-700 text-ink-100'
                    : 'text-ink-400 hover:text-ink-100 hover:bg-surface-700'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                <span className="hidden sm:inline">{t('nav.portfolio')}</span>
              </Link>

              <Link
                to="/profile"
                className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl transition-all duration-150 ${
                  isActive('/profile')
                    ? 'bg-surface-700 text-ink-100'
                    : 'text-ink-400 hover:text-ink-100 hover:bg-surface-700'
                }`}
              >
                <UserCircle className="w-4 h-4" />
                <span className="hidden sm:inline">{t('nav.profile')}</span>
              </Link>

              {user?.is_superuser && (
                <Link
                  to="/admin"
                  className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl transition-all duration-150 ${
                    isActive('/admin')
                      ? 'bg-surface-700 text-ink-100'
                      : 'text-ink-400 hover:text-ink-100 hover:bg-surface-700'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('nav.admin')}</span>
                </Link>
              )}

              {user && (
                <div className="flex items-center gap-1.5 bg-surface-700 border border-surface-600 px-3 py-1.5 rounded-xl ml-1">
                  <Star className="w-3.5 h-3.5 text-brand-cyan" />
                  <span className="text-sm font-bold text-ink-100">
                    {Number(user.balance).toLocaleString()}
                  </span>
                </div>
              )}

              <WalletButton />
              <LanguageSwitcher />
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
        <Outlet />
      </main>

      <footer className="border-t border-surface-600 py-6 text-center">
        <p className="text-xs text-ink-800">{t('nav.footer')}</p>
      </footer>
    </div>
  )
}
