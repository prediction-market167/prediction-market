import { Outlet, Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppSelector } from '@/hooks/useStore'
import { Swords, Briefcase, Trophy, UserCircle, ShieldCheck, Zap, Star } from 'lucide-react'
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
        <div className="w-20 h-20 rounded-3xl bg-gradient-gold flex items-center justify-center mx-auto mb-6 shadow-glow-gold animate-float">
          <Zap className="w-10 h-10 text-surface-900" />
        </div>
        <h1 className="text-2xl font-black text-white mb-3">{t('auth.telegramOnly')}</h1>
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
        <div className="w-16 h-16 rounded-2xl bg-gradient-gold flex items-center justify-center shadow-glow-gold animate-pulse">
          <Zap className="w-8 h-8 text-surface-900" />
        </div>
        <p className="text-sm text-ink-400 font-semibold tracking-widest uppercase">{t('auth.connecting')}</p>
      </div>
    </div>
  )
}

export default function Layout({ loading, isTelegram }: Props) {
  const { t } = useTranslation()
  const location = useLocation()
  const { user } = useAppSelector((s) => s.auth)

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  if (loading) return <AuthLoading />
  if (!isTelegram) return <NotInTelegram />

  const navItems = [
    { to: '/markets', icon: Swords, label: t('nav.markets') },
    { to: '/leaderboard', icon: Trophy, label: t('leaderboard.navLabel') },
    { to: '/', icon: Zap, label: t('nav.home'), isHome: true },
    { to: '/portfolio', icon: Briefcase, label: t('nav.portfolio') },
    { to: '/profile', icon: UserCircle, label: t('nav.profile') },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-surface-900">
      {/* Top bar — logo + balance + admin */}
      <header className="sticky top-0 z-50 glass">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-gold flex items-center justify-center shadow-glow-gold">
                <Zap className="w-4 h-4 text-surface-900" />
              </div>
              <span className="text-sm font-black text-gradient-gold tracking-tight uppercase">{t('nav.brandName')}</span>
            </Link>

            <div className="flex items-center gap-2">
              {/* Balance chip */}
              {user && (
                <div className="flex items-center gap-1.5 bg-surface-700 border border-gold/30 px-3 py-1.5 rounded-xl shadow-glow-gold/20">
                  <Star className="w-3.5 h-3.5 text-gold" />
                  <span className="text-sm font-black text-gold">{Number(user.balance).toLocaleString()}</span>
                </div>
              )}
              {user?.is_superuser && (
                <Link to="/admin" className={`p-2 rounded-xl transition-all ${isActive('/admin') ? 'bg-surface-600 text-gold' : 'text-ink-500 hover:text-ink-200'}`}>
                  <ShieldCheck className="w-4 h-4" />
                </Link>
              )}
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </header>

      {/* Main content — padded bottom for nav bar */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 pb-28 animate-fade-in">
        <Outlet />
      </main>

      {/* Bottom tab navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-surface-600/50">
        <div className="max-w-2xl mx-auto px-2">
          <div className="flex items-center justify-around h-16">
            {navItems.map(({ to, icon: Icon, label, isHome }) => {
              const active = isActive(to)
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-2xl transition-all duration-200 ${
                    active ? 'scale-110' : 'opacity-50 hover:opacity-75'
                  }`}
                >
                  {isHome ? (
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                      active
                        ? 'bg-gradient-gold shadow-glow-gold'
                        : 'bg-surface-700 border border-surface-600'
                    }`}>
                      <Icon className={`w-6 h-6 ${active ? 'text-surface-900' : 'text-ink-400'}`} />
                    </div>
                  ) : (
                    <>
                      <div className={`relative w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                        active ? 'bg-gold/15' : ''
                      }`}>
                        <Icon className={`w-5 h-5 transition-all ${active ? 'text-gold' : 'text-ink-500'}`} />
                        {active && (
                          <div className="absolute w-5 h-5 bg-gold/20 rounded-full blur-md" />
                        )}
                      </div>
                      <span className={`text-[10px] font-bold transition-all ${active ? 'text-gold' : 'text-ink-600'}`}>
                        {label}
                      </span>
                    </>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
    </div>
  )
}
