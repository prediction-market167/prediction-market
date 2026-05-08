import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { marketsApi } from '@/api/markets'
import MarketCard from '@/components/markets/MarketCard'
import { Gift, Star, Flame, Gem, Users } from 'lucide-react'
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
  glowColor: string
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
    glowColor: 'rgba(16,185,129,0.4)',
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
    glowColor: 'rgba(14,165,233,0.4)',
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
    glowColor: 'rgba(249,115,22,0.4)',
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
    glowColor: 'rgba(244,63,94,0.4)',
  },
]

function TierTab({
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
  const Icon = tier.icon
  return (
    <button
      onClick={onClick}
      className={`relative flex-1 py-3 px-2 rounded-xl border-2 transition-all duration-200 text-center ${
        active
          ? `${tier.accentBorder} ${tier.accentBg}`
          : 'border-surface-600 bg-surface-800 hover:border-surface-500'
      }`}
      style={active ? { boxShadow: `0 0 16px ${tier.glowColor}` } : undefined}
    >
      <Icon className={`w-5 h-5 mx-auto mb-1 ${active ? tier.accentColor : 'text-ink-600'}`} />
      <p className={`text-xs font-black ${active ? tier.accentColor : 'text-ink-500'}`}>
        {tier.badge}
      </p>
      {liveCount > 0 && (
        <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center ${
          active ? `${tier.accentBg} ${tier.accentColor} border ${tier.accentBorder}` : 'bg-surface-700 text-ink-500'
        }`}>
          {liveCount}
        </span>
      )}
      {active && (
        <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-3/4 rounded-full bg-gradient-to-r ${tier.gradient}`} />
      )}
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

  const { data: allMarkets = [] } = useQuery({
    queryKey: ['markets', 'all'],
    queryFn: () => marketsApi.list({ status: 'open', limit: 200 }),
  })

  const liveCountByTier = (tierId: string) =>
    allMarkets.filter(m => m.tier === tierId && m.status === 'open').length

  const activeTierData = TIERS.find(t => t.id === activeTier)!

  return (
    <div className="animate-slide-up">
      {/* Purple gradient hero banner */}
      <div className="relative overflow-hidden rounded-2xl mb-6 p-5"
        style={{
          background: 'linear-gradient(135deg, #180d3d 0%, #261960 50%, #180d3d 100%)',
          border: '1px solid rgba(168,85,247,0.3)',
          boxShadow: '0 0 32px rgba(168,85,247,0.15)',
        }}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-purple/10 rounded-full blur-2xl pointer-events-none" />
        <h1 className="text-2xl font-black text-gradient-gold mb-1">
          {t('game.compete')}
        </h1>
        <p className="text-sm text-ink-500">{t('game.pickTier')}</p>
      </div>

      {/* Tier filter tabs */}
      <div className="flex gap-2 mb-6">
        {TIERS.map((tier) => (
          <TierTab
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
        <div className={`w-1 h-5 rounded-full bg-gradient-to-b ${activeTierData.gradient}`} />
        <h2 className="text-lg font-black text-ink-100">{activeTierData.name} {t('game.markets')}</h2>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${activeTierData.accentBg} ${activeTierData.accentColor} border ${activeTierData.accentBorder}`}>
            {liveCountByTier(activeTier)} {t('game.live')}
          </span>
          {activeTierData.stars > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold text-gold">
              <Users className="w-3 h-3" />
              {activeTierData.stars} ⭐
            </span>
          )}
        </div>
      </div>

      {/* Market list */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl h-44 animate-pulse"
              style={{
                background: 'linear-gradient(135deg, #0f0628 0%, #180d3d 100%)',
                border: '1px solid #261960',
                animationDelay: `${i * 60}ms`,
              }}
            >
              <div className="h-1 rounded-t-2xl bg-gradient-to-r from-surface-600 to-surface-500" />
              <div className="p-4">
                <div className="h-3 bg-surface-700 rounded-full mb-4 w-14" />
                <div className="h-4 bg-surface-700 rounded-xl mb-2 w-full" />
                <div className="h-4 bg-surface-700 rounded-xl mb-6 w-3/4" />
                <div className="h-1.5 bg-surface-700 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : !markets.length ? (
        <div className="text-center py-20 rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, #0f0628 0%, #180d3d 100%)',
            border: '1px solid #261960',
          }}
        >
          <div className="text-5xl mb-4">🏆</div>
          <p className="text-ink-400 text-lg font-bold">{t('game.noMarkets')}</p>
          <p className="text-ink-700 text-sm mt-1">{t('game.noMarketsHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
