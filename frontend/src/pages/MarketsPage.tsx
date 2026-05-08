import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { marketsApi } from '@/api/markets'
import MarketCard from '@/components/markets/MarketCard'
import { Gift, Star, Flame, Gem, ArrowRight, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Tier {
  id: string
  name: string
  stars: number
  format: string
  choiceCount: number
  icon: LucideIcon
  gradient: string
  accentColor: string
  accentBg: string
  accentBorder: string
  glow: string
  badge: string
}

const TIERS: Tier[] = [
  {
    id: 'free',
    name: 'Free',
    stars: 0,
    format: 'True / False',
    choiceCount: 2,
    icon: Gift,
    gradient: 'from-emerald-500 to-teal-400',
    accentColor: 'text-emerald-400',
    accentBg: 'bg-emerald-500/15',
    accentBorder: 'border-emerald-500/40',
    glow: 'shadow-emerald-500/25',
    badge: 'FREE',
  },
  {
    id: 'easy',
    name: 'Easy',
    stars: 20,
    format: 'True / False',
    choiceCount: 2,
    icon: Star,
    gradient: 'from-sky-500 to-cyan-400',
    accentColor: 'text-sky-400',
    accentBg: 'bg-sky-500/15',
    accentBorder: 'border-sky-500/40',
    glow: 'shadow-sky-500/25',
    badge: 'EASY',
  },
  {
    id: 'medium',
    name: 'Medium',
    stars: 50,
    format: '2 choices',
    choiceCount: 2,
    icon: Flame,
    gradient: 'from-orange-500 to-amber-400',
    accentColor: 'text-orange-400',
    accentBg: 'bg-orange-500/15',
    accentBorder: 'border-orange-500/40',
    glow: 'shadow-orange-500/25',
    badge: 'MED',
  },
  {
    id: 'hard',
    name: 'Hard',
    stars: 100,
    format: '4 choices',
    choiceCount: 4,
    icon: Gem,
    gradient: 'from-rose-500 to-purple-500',
    accentColor: 'text-rose-400',
    accentBg: 'bg-rose-500/15',
    accentBorder: 'border-rose-500/40',
    glow: 'shadow-rose-500/25',
    badge: 'HARD',
  },
]

function ChoiceDots({ count, color }: { count: number; color: string }) {
  return (
    <div className="flex gap-1 mt-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`w-2 h-2 rounded-full ${color}`} />
      ))}
    </div>
  )
}

function TierCard({
  tier,
  active,
  liveCount,
  onClick,
}: {
  tier: Tier
  active: boolean
  liveCount: number
  onClick: () => void
}) {
  const { t } = useTranslation()
  const Icon = tier.icon
  return (
    <button
      onClick={onClick}
      className={`relative group text-left w-full rounded-3xl p-px transition-all duration-300 ${
        active ? `bg-gradient-to-br ${tier.gradient} shadow-2xl ${tier.glow}` : 'bg-surface-700 hover:bg-surface-600'
      }`}
    >
      <div className={`rounded-[calc(1.5rem-1px)] p-5 h-full transition-all duration-300 ${
        active ? 'bg-surface-900/90' : 'bg-surface-800 group-hover:bg-surface-750'
      }`}>
        <div className="flex items-start justify-between mb-4">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${
            active ? tier.accentBg : 'bg-surface-700'
          }`}>
            <Icon className={`w-5 h-5 transition-colors ${active ? tier.accentColor : 'text-ink-500'}`} />
          </div>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full tracking-wider transition-colors ${
            active
              ? `${tier.accentBg} ${tier.accentColor} border ${tier.accentBorder}`
              : 'bg-surface-700 text-ink-600 border border-surface-600'
          }`}>
            {tier.badge}
          </span>
        </div>

        <p className={`text-xl font-black mb-0.5 transition-colors ${active ? 'text-ink-100' : 'text-ink-400'}`}>
          {tier.name}
        </p>
        <p className={`text-xs font-semibold mb-3 transition-colors ${active ? tier.accentColor : 'text-ink-600'}`}>
          {tier.format}
        </p>
        <ChoiceDots count={tier.choiceCount} color={active ? tier.accentColor.replace('text-', 'bg-') : 'bg-surface-600'} />

        <div className="flex items-end justify-between mt-4">
          <div>
            <p className={`text-2xl font-black leading-none transition-colors ${active ? 'text-ink-100' : 'text-ink-500'}`}>
              {tier.stars === 0 ? 'FREE' : `${tier.stars} ⭐`}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <Users className={`w-3 h-3 ${active ? tier.accentColor : 'text-ink-700'}`} />
              <span className={`text-xs font-medium transition-colors ${active ? 'text-ink-400' : 'text-ink-700'}`}>
                {liveCount} {t('game.live')}
              </span>
            </div>
          </div>
          <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
            active ? `${tier.accentBg} ${tier.accentColor}` : 'text-ink-700'
          }`}>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </button>
  )
}

export default function MarketsPage() {
  const { t } = useTranslation()
  const [activeTier, setActiveTier] = useState<string>('hard')

  const { data: markets = [], isLoading } = useQuery({
    queryKey: ['markets', activeTier],
    queryFn: () => marketsApi.list({ tier: activeTier, limit: 50 }),
  })

  // Count live per tier for the tier card display
  const { data: allMarkets = [] } = useQuery({
    queryKey: ['markets', 'all'],
    queryFn: () => marketsApi.list({ status: 'open', limit: 200 }),
  })

  const liveCountByTier = (tierId: string) =>
    allMarkets.filter(m => m.tier === tierId && m.status === 'open').length

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-black text-ink-100 mb-1">
          {t('game.compete')}
        </h1>
        <p className="text-sm text-ink-600">{t('game.pickTier')}</p>
      </div>

      {/* 4 Tier Cards — 2×2 grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-10">
        {TIERS.map((tier) => (
          <TierCard
            key={tier.id}
            tier={tier}
            active={activeTier === tier.id}
            liveCount={liveCountByTier(tier.id)}
            onClick={() => setActiveTier(tier.id)}
          />
        ))}
      </div>

      {/* Active tier label */}
      <div className="flex items-center gap-3 mb-5">
        {(() => {
          const t_data = TIERS.find((t) => t.id === activeTier)!
          const liveCount = liveCountByTier(activeTier)
          return (
            <>
              <div className={`w-1 h-5 rounded-full bg-gradient-to-b ${t_data.gradient}`} />
              <h2 className="text-lg font-black text-ink-100">{t_data.name} {t('game.markets')}</h2>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t_data.accentBg} ${t_data.accentColor} border ${t_data.accentBorder}`}>
                {liveCount} {t('game.live')}
              </span>
            </>
          )
        })()}
      </div>

      {/* Market list */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-3xl bg-surface-800 p-5 h-44 animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="h-3 bg-surface-700 rounded-full mb-4 w-14" />
              <div className="h-4 bg-surface-700 rounded-2xl mb-2 w-full" />
              <div className="h-4 bg-surface-700 rounded-2xl mb-6 w-3/4" />
              <div className="h-1.5 bg-surface-700 rounded-full" />
            </div>
          ))}
        </div>
      ) : !markets.length ? (
        <div className="text-center py-24 rounded-3xl bg-surface-800/50 border border-surface-700">
          <div className="text-5xl mb-4">🏆</div>
          <p className="text-ink-400 text-lg font-bold">{t('game.noMarkets')}</p>
          <p className="text-ink-700 text-sm mt-1">{t('game.noMarketsHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {markets.map((market, i) => (
            <div
              key={market.id}
              className="animate-slide-up"
              style={{ animationDelay: `${Math.min(i * 40, 200)}ms` }}
            >
              <MarketCard market={market} tier={TIERS.find((t) => t.id === activeTier)!} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
