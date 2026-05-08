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
    { tier: 'easy', player: weeklyEasy[0], color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30', emoji: '🥇' },
    { tier: 'medium', player: weeklyMedium[0], color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', emoji: '🔥' },
    { tier: 'hard', player: weeklyHard[0], color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30', emoji: '⚡' },
  ]

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
      <div className="text-center pt-16 pb-10 relative">
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

        {/* Clock + Activity Feed */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold ${urgent ? 'border-rose-500/50 bg-rose-500/10 text-rose-400' : 'border-surface-500 bg-surface-700 text-ink-300'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${urgent ? 'bg-rose-400 animate-pulse' : 'bg-brand-cyan animate-pulse'}`} />
            {phase === 'results' ? t('home.resultsIn') : t('home.nextContest')}
            <span className="tabular-nums font-black">{clockLabel}</span>
          </div>
          <div className="px-4 py-2 rounded-full border border-surface-500 bg-surface-700 text-xs text-ink-400 max-w-[220px] truncate">
            {activityMsg}
          </div>
        </div>
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
              <p
                className="text-3xl font-black text-amber-400"
                style={{ animation: animatedJackpot > 0 ? 'countPulse 1.2s ease-in-out' : undefined }}
              >
                {animatedJackpot > 0
                  ? `${animatedJackpot.toLocaleString()} ⭐`
                  : t('home.jackpotEmpty')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Champions */}
      <div className="mb-8">
        <h2 className="text-sm font-black text-ink-500 uppercase tracking-widest mb-3">
          {t('home.weeklyChampions')}
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {champions.map(({ tier, player, color, bg, border, emoji }) => (
            <div key={tier} className={`card p-4 text-center ${bg} ${border} border`}>
              <p className="text-xl mb-1">{emoji}</p>
              <p className={`text-[10px] font-black uppercase tracking-widest ${color} mb-1`}>
                {tier}
              </p>
              {player ? (
                <p className="text-xs font-bold text-ink-200 truncate">@{player.username}</p>
              ) : (
                <p className="text-xs text-ink-600">{t('home.weeklyEmpty')}</p>
              )}
            </div>
          ))}
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
