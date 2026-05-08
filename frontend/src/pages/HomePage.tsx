import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import { Zap, Shield, ArrowRight, Brain, Trophy } from 'lucide-react'
import referralApi from '@/api/referral'
import leaderboardApi from '@/api/leaderboard'

function useCountUp(target: number) {
  const [val, setVal] = useState(0)
  const prevRef = useRef(0)
  useEffect(() => {
    const from = prevRef.current
    if (from === target) return
    const dur = 1200
    const start = Date.now()
    const tick = () => {
      const p = Math.min((Date.now() - start) / dur, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(from + (target - from) * eased))
      if (p < 1) requestAnimationFrame(tick)
      else prevRef.current = target
    }
    requestAnimationFrame(tick)
  }, [target])
  return val
}

function useContestClock() {
  const [label, setLabel] = useState('')
  const [phase, setPhase] = useState<'results' | 'next'>('results')
  const [urgent, setUrgent] = useState(false)
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const min = now.getMinutes()
      const sec = now.getSeconds()
      let totalSecs: number
      let ph: 'results' | 'next'
      if (min < 55) {
        totalSecs = (54 - min) * 60 + (60 - sec)
        ph = 'results'
      } else {
        totalSecs = (59 - min) * 60 + (60 - sec)
        ph = 'next'
      }
      const m = Math.floor(totalSecs / 60)
      const s = totalSecs % 60
      setLabel(`${m}:${s.toString().padStart(2, '0')}`)
      setPhase(ph)
      setUrgent(totalSecs < 60)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return { label, phase, urgent }
}

function useActivityFeed(jackpotAmount: number) {
  const { t } = useTranslation()
  const [idx, setIdx] = useState(0)
  const messages = [
    t('home.act1', { count: 48 }),
    t('home.act2'),
    t('home.act3'),
    t('home.act4'),
    t('home.act5', { amount: Number(jackpotAmount).toLocaleString() }),
  ]
  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % messages.length), 3500)
    return () => clearInterval(id)
  }, [messages.length])
  return messages[idx]
}

export default function HomePage() {
  const { t } = useTranslation()

  const { data: jackpot } = useQuery({
    queryKey: ['jackpot'],
    queryFn: referralApi.jackpot,
    refetchInterval: 30_000,
  })

  const jackpotAmount = jackpot?.jackpot_balance ?? 0
  const animatedJackpot = useCountUp(Number(jackpotAmount))
  const { label: clockLabel, phase, urgent } = useContestClock()
  const activityMsg = useActivityFeed(Number(jackpotAmount))

  const { data: weeklyEasy = [] } = useQuery({ queryKey: ['leaderboard', 'weekly', 'easy'], queryFn: () => leaderboardApi.weekly('easy'), staleTime: 120_000 })
  const { data: weeklyMedium = [] } = useQuery({ queryKey: ['leaderboard', 'weekly', 'medium'], queryFn: () => leaderboardApi.weekly('medium'), staleTime: 120_000 })
  const { data: weeklyHard = [] } = useQuery({ queryKey: ['leaderboard', 'weekly', 'hard'], queryFn: () => leaderboardApi.weekly('hard'), staleTime: 120_000 })

  const champions = [
    { tier: 'easy', player: weeklyEasy[0], accentClass: 'text-sky-400', borderClass: 'border-sky-500/40', bgClass: 'bg-sky-500/10', emoji: '🥇' },
    { tier: 'medium', player: weeklyMedium[0], accentClass: 'text-orange-400', borderClass: 'border-orange-500/40', bgClass: 'bg-orange-500/10', emoji: '🔥' },
    { tier: 'hard', player: weeklyHard[0], accentClass: 'text-rose-400', borderClass: 'border-rose-500/40', bgClass: 'bg-rose-500/10', emoji: '⚡' },
  ]

  const STATS = [
    { label: t('home.stats.activeMarkets'), value: '1,200+' },
    { label: t('home.stats.totalVolume'), value: '$48M' },
    { label: t('home.stats.traders'), value: '32K' },
    { label: t('home.stats.avgRoi'), value: '48%' },
  ]

  const FEATURES = [
    {
      icon: Brain,
      title: t('home.features.realtimeOdds.title'),
      subtitle: t('home.features.realtimeOdds.subtitle'),
      desc: t('home.features.realtimeOdds.desc'),
    },
    {
      icon: Zap,
      title: t('home.features.instantSettlement.title'),
      subtitle: t('home.features.instantSettlement.subtitle'),
      desc: t('home.features.instantSettlement.desc'),
    },
    {
      icon: Shield,
      title: t('home.features.transparent.title'),
      subtitle: t('home.features.transparent.subtitle'),
      desc: t('home.features.transparent.desc'),
    },
  ]

  return (
    <div className="animate-fade-in">
      {/* Jackpot Hero */}
      <div className="relative overflow-hidden rounded-3xl mb-6 p-6 text-center"
        style={{
          background: 'linear-gradient(135deg, #0f0628 0%, #180d3d 50%, #0f0628 100%)',
          border: '1px solid rgba(245,197,24,0.3)',
          boxShadow: '0 0 40px rgba(245,197,24,0.15), inset 0 1px 0 rgba(245,197,24,0.1)',
        }}
      >
        {/* Background glow blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-gold/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-32 h-24 bg-brand-purple/15 rounded-full blur-2xl" />
          <div className="absolute bottom-0 right-1/4 w-32 h-24 bg-brand-blue/15 rounded-full blur-2xl" />
        </div>

        {/* Lightning bolt decorations */}
        <div className="absolute top-4 left-6 text-gold/20 text-4xl select-none">⚡</div>
        <div className="absolute top-4 right-6 text-gold/20 text-4xl select-none">⚡</div>

        <div className="relative">
          {/* Live badge */}
          <div className="inline-flex items-center gap-2 bg-surface-700 border border-gold/30 text-xs text-gold font-semibold px-3 py-1.5 rounded-full mb-4">
            <span className="w-1.5 h-1.5 bg-yes rounded-full animate-pulse" />
            {t('home.badge')}
          </div>

          {/* JACKPOT label */}
          <p className="text-xs font-black text-gradient-purple uppercase tracking-widest mb-2">
            {t('home.jackpotLabel')}
          </p>

          {/* Animated counter */}
          <p
            className="text-5xl sm:text-6xl font-black text-gradient-gold text-glow-gold mb-1 tabular-nums"
            style={{ animation: animatedJackpot > 0 ? 'pulseGold 2s ease-in-out infinite' : undefined }}
          >
            {animatedJackpot > 0
              ? `${animatedJackpot.toLocaleString()} ⭐`
              : t('home.jackpotEmpty')}
          </p>

          <p className="text-xs text-ink-500 mb-5">{t('home.jackpotDesc')}</p>

          {/* Countdown timer pill */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold ${
              urgent
                ? 'border-rose-500/50 bg-rose-500/10 text-rose-400'
                : 'border-gold/30 bg-gold/10 text-gold'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${urgent ? 'bg-rose-400' : 'bg-gold'}`} />
              {phase === 'results' ? t('home.resultsIn') : t('home.nextContest')}
              <span className="tabular-nums font-black">{clockLabel}</span>
            </div>
            <div className="px-4 py-2 rounded-full border border-surface-500 bg-surface-700 text-xs text-ink-400 max-w-[220px] truncate">
              {activityMsg}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-6">
            <Link
              to="/markets"
              className="btn-primary gap-2 text-base px-7 py-3.5 shadow-glow-gold"
            >
              {t('home.exploreMarkets')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Weekly Champions */}
      <div className="mb-6">
        <h2 className="text-xs font-black text-ink-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Trophy className="w-3.5 h-3.5 text-gold" />
          {t('home.weeklyChampions')}
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {champions.map(({ tier, player, accentClass, borderClass, bgClass, emoji }) => (
            <div
              key={tier}
              className={`rounded-2xl p-4 text-center border ${bgClass} ${borderClass}`}
              style={{ background: 'linear-gradient(135deg, #0f0628 0%, #180d3d 100%)' }}
            >
              <p className="text-xl mb-1">{emoji}</p>
              <p className={`text-[10px] font-black uppercase tracking-widest ${accentClass} mb-1`}>
                {tier}
              </p>
              {player ? (
                <p className="text-xs font-bold text-ink-200 truncate">@{player.username}</p>
              ) : (
                <p className="text-xs text-ink-700">{t('home.weeklyEmpty')}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {STATS.map((stat) => (
          <div key={stat.label} className="card text-center">
            <p className="text-3xl font-black text-gradient-gold">{stat.value}</p>
            <p className="text-xs text-ink-600 mt-1.5 font-semibold uppercase tracking-widest">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        {FEATURES.map(({ icon: Icon, title, subtitle, desc }) => (
          <div key={title} className="card card-hover group">
            <div className="w-11 h-11 bg-gradient-gold rounded-xl flex items-center justify-center mb-4 shadow-glow-gold group-hover:shadow-glow-gold transition-shadow duration-300">
              <Icon className="w-5 h-5 text-surface-900" />
            </div>
            <h3 className="font-black text-ink-100 mb-0.5 text-base">{title}</h3>
            <p className="text-xs font-semibold text-gradient-gold mb-2 uppercase tracking-wide">{subtitle}</p>
            <p className="text-sm text-ink-500 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
