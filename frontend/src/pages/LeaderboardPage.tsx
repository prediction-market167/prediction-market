import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Trophy, Medal, Star } from 'lucide-react'
import leaderboardApi from '@/api/leaderboard'
import { useAppSelector } from '@/hooks/useStore'

const TIERS = ['easy', 'medium', 'hard'] as const
type Tier = typeof TIERS[number]

const TIER_STYLES: Record<Tier, { tab: string; badge: string; glow: string; activeTab: string }> = {
  easy: {
    tab: 'border-sky-500/40 text-sky-400 bg-sky-500/10',
    activeTab: 'border-b-2 border-gold text-gold',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    glow: 'shadow-[0_0_16px_rgba(56,189,248,0.3)]',
  },
  medium: {
    tab: 'border-orange-500/40 text-orange-400 bg-orange-500/10',
    activeTab: 'border-b-2 border-gold text-gold',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    glow: 'shadow-[0_0_16px_rgba(251,146,60,0.3)]',
  },
  hard: {
    tab: 'border-rose-500/40 text-rose-400 bg-rose-500/10',
    activeTab: 'border-b-2 border-gold text-gold',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    glow: 'shadow-[0_0_16px_rgba(251,113,133,0.3)]',
  },
}

const RANK_ICONS: Record<number, { icon: string; color: string }> = {
  1: { icon: '🥇', color: 'text-yellow-400' },
  2: { icon: '🥈', color: 'text-slate-300' },
  3: { icon: '🥉', color: 'text-orange-400' },
}

const WEEKLY_BADGES: Record<number, { emoji: string; labelKey: string; color: string }> = {
  1: { emoji: '🥇', labelKey: 'leaderboard.badgeChampion', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  2: { emoji: '🔥', labelKey: 'leaderboard.badgeStreak',   color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
  3: { emoji: '⚡', labelKey: 'leaderboard.badgeSpeed',    color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
}

export default function LeaderboardPage() {
  const { t } = useTranslation()
  const [activeTier, setActiveTier] = useState<Tier>('easy')
  const { user } = useAppSelector((s) => s.auth)

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['leaderboard', activeTier],
    queryFn: () => leaderboardApi.get(activeTier),
    staleTime: 30_000,
  })

  const { data: weeklyTop = [] } = useQuery({
    queryKey: ['leaderboard', 'weekly', activeTier],
    queryFn: () => leaderboardApi.weekly(activeTier),
    staleTime: 60_000,
  })

  const weeklyRank = (username: string) =>
    weeklyTop.findIndex(e => e.username === username) + 1

  return (
    <div className="max-w-lg mx-auto animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-gold/15 rounded-2xl flex items-center justify-center shadow-glow-gold">
          <Trophy className="w-6 h-6 text-gold" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gradient-gold">{t('leaderboard.title')}</h1>
          <p className="text-xs text-ink-600">{t('leaderboard.player')} · {t('leaderboard.contests')} · {t('leaderboard.winnings')}</p>
        </div>
      </div>

      {/* Tier tabs — gold underline style */}
      <div className="flex gap-1 mb-5 border-b border-surface-600">
        {TIERS.map((tier) => {
          const active = tier === activeTier
          const style = TIER_STYLES[tier]
          return (
            <button
              key={tier}
              onClick={() => setActiveTier(tier)}
              className={`flex-1 py-2.5 text-sm font-bold transition-all duration-150 capitalize ${
                active
                  ? `text-gold border-b-2 border-gold -mb-px`
                  : `text-ink-500 hover:text-ink-300 border-b-2 border-transparent -mb-px`
              } ${active ? style.glow : ''}`}
            >
              {t(`leaderboard.${tier}`)}
            </button>
          )
        })}
      </div>

      {/* Weekly Top 3 summary card */}
      {weeklyTop.length > 0 && (
        <div className="card-glow mb-5">
          <p className="text-[10px] font-black text-ink-600 uppercase tracking-widest mb-3">
            {t('leaderboard.thisWeek')}
          </p>
          <div className="flex gap-2 justify-around">
            {weeklyTop.slice(0, 3).map((entry, i) => {
              const rank = i + 1
              const b = WEEKLY_BADGES[rank]
              return b ? (
                <div key={entry.username} className="flex flex-col items-center gap-1">
                  <span className={`text-[10px] font-black px-2 py-1 rounded-full border ${b.color}`}>
                    {b.emoji} {t(b.labelKey)}
                  </span>
                  <span className="text-xs text-ink-400 truncate max-w-[70px] text-center">@{entry.username}</span>
                </div>
              ) : null
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, #0f0628 0%, #180d3d 100%)',
          border: '1px solid #261960',
          boxShadow: '0 2px 8px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.15)',
        }}
      >
        {/* Header row */}
        <div className="grid grid-cols-[2rem_1fr_5rem_6rem] gap-2 px-4 py-2.5 border-b border-surface-600">
          <span className="text-[10px] font-black text-ink-600 uppercase tracking-widest">{t('leaderboard.rank')}</span>
          <span className="text-[10px] font-black text-ink-600 uppercase tracking-widest">{t('leaderboard.player')}</span>
          <span className="text-[10px] font-black text-ink-600 uppercase tracking-widest text-right">{t('leaderboard.contests')}</span>
          <span className="text-[10px] font-black text-ink-600 uppercase tracking-widest text-right">{t('leaderboard.winnings')}</span>
        </div>

        {isLoading ? (
          <div className="space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 px-4 flex items-center gap-3 border-b border-surface-700/50 animate-pulse">
                <div className="w-6 h-4 bg-surface-700 rounded" />
                <div className="flex-1 h-4 bg-surface-700 rounded" />
                <div className="w-10 h-4 bg-surface-700 rounded" />
                <div className="w-16 h-4 bg-surface-700 rounded" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center">
            <Medal className="w-10 h-10 text-ink-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-ink-500">{t('leaderboard.empty')}</p>
            <p className="text-xs text-ink-700 mt-1">{t('leaderboard.emptyHint')}</p>
          </div>
        ) : (
          <div>
            {entries.map((entry) => {
              const isYou = user?.username === entry.username
              const rankMeta = RANK_ICONS[entry.rank]
              const wRank = weeklyRank(entry.username)
              return (
                <div
                  key={entry.rank}
                  className={`grid grid-cols-[2rem_1fr_5rem_6rem] gap-2 items-center px-4 py-3 border-b border-surface-700/50 last:border-0 transition-colors ${
                    isYou ? 'bg-gold/5' : 'hover:bg-surface-700/30'
                  }`}
                >
                  {/* Rank */}
                  <div className="text-sm font-black">
                    {rankMeta ? (
                      <span>{rankMeta.icon}</span>
                    ) : (
                      <span className="text-ink-500">{entry.rank}</span>
                    )}
                  </div>

                  {/* Username */}
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <span className={`text-sm font-semibold truncate ${isYou ? 'text-gold' : 'text-ink-200'}`}>
                      @{entry.username}
                    </span>
                    {isYou && (
                      <span className="text-[10px] font-black text-gold bg-gold/10 border border-gold/30 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        {t('leaderboard.you')}
                      </span>
                    )}
                    {wRank > 0 && (() => {
                      const b = WEEKLY_BADGES[wRank]
                      return b ? (
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border flex-shrink-0 ${b.color}`}>
                          {b.emoji} {t(b.labelKey)}
                        </span>
                      ) : null
                    })()}
                  </div>

                  {/* Contest count */}
                  <div className="text-right">
                    <span className="text-sm font-bold text-ink-200">{entry.contest_count}</span>
                  </div>

                  {/* Winnings */}
                  <div className="flex items-center justify-end gap-1">
                    <Star className="w-3 h-3 text-gold flex-shrink-0" />
                    <span className="text-sm font-bold text-gold">
                      {Number(entry.total_winnings).toLocaleString()}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
