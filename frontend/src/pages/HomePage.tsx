import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Zap, Shield, ArrowRight, Brain, Trophy } from 'lucide-react'
import referralApi from '@/api/referral'

export default function HomePage() {
  const { t } = useTranslation()

  const { data: jackpot } = useQuery({
    queryKey: ['jackpot'],
    queryFn: referralApi.jackpot,
    refetchInterval: 30_000,
  })

  const jackpotAmount = jackpot?.jackpot_balance ?? 0

  const STATS = [
    { label: t('home.stats.activeMarkets'), value: '1,200+' },
    { label: t('home.stats.totalVolume'), value: '$48M' },
    { label: t('home.stats.traders'), value: '32K' },
    { label: t('home.stats.avgRoi'), value: '+22%' },
  ]

  const FEATURES = [
    {
      icon: Brain,
      title: t('home.features.realtimeOdds.title'),
      desc: t('home.features.realtimeOdds.desc'),
    },
    {
      icon: Zap,
      title: t('home.features.instantSettlement.title'),
      desc: t('home.features.instantSettlement.desc'),
    },
    {
      icon: Shield,
      title: t('home.features.transparent.title'),
      desc: t('home.features.transparent.desc'),
    },
  ]

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <div className="text-center pt-16 pb-20 relative">
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand-cyan/8 rounded-full blur-[120px]" />
          <div className="absolute top-10 left-1/2 translate-x-8 w-[400px] h-[300px] bg-brand-purple/8 rounded-full blur-[100px]" />
        </div>

        <div className="inline-flex items-center gap-2 bg-surface-700 border border-surface-500 text-xs text-brand-cyan font-semibold px-3 py-1.5 rounded-full mb-8">
          <span className="w-1.5 h-1.5 bg-yes rounded-full animate-pulse" />
          {t('home.badge')}
        </div>

        <h1 className="text-6xl sm:text-7xl font-black tracking-tight leading-none mb-6">
          <span className="text-ink-100">{t('home.headline1')}</span>
          <br />
          <span className="text-gradient">{t('home.headline2')}</span>
        </h1>

        <p className="text-lg text-ink-400 max-w-md mx-auto mb-10 leading-relaxed">
          {t('home.tagline')}
        </p>

        <Link
          to="/markets"
          className="btn-primary gap-2 text-base px-7 py-3.5 shadow-glow-cyan"
        >
          {t('home.exploreMarkets')}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Jackpot Banner */}
      <div className="mb-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-600/20 via-yellow-500/15 to-amber-600/20 border border-amber-500/30 p-6">
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[100px] bg-amber-500/10 rounded-full blur-[60px]" />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center">
                <Trophy className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-black text-amber-400 uppercase tracking-widest mb-0.5">
                  {t('home.jackpotLabel')}
                </p>
                <p className="text-sm text-ink-500">{t('home.jackpotDesc')}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-amber-400">
                {jackpotAmount > 0
                  ? `${Number(jackpotAmount).toLocaleString()} ⭐`
                  : t('home.jackpotEmpty')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-20">
        {STATS.map((stat) => (
          <div key={stat.label} className="card p-5 text-center">
            <p className="text-3xl font-black text-ink-100">{stat.value}</p>
            <p className="text-xs text-ink-600 mt-1.5 font-semibold uppercase tracking-widest">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="card card-hover p-6 group">
            <div className="w-11 h-11 bg-gradient-brand rounded-xl flex items-center justify-center mb-5 shadow-glow-cyan group-hover:shadow-glow-cyan transition-shadow duration-300">
              <Icon className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-bold text-ink-100 mb-2 text-base">{title}</h3>
            <p className="text-sm text-ink-400 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
