import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Trophy, Medal, Star } from 'lucide-react'
import leaderboardApi from '@/api/leaderboard'
import { useAppSelector } from '@/hooks/useStore'

const TIERS = ['easy', 'medium', 'hard'] as const
type Tier = typeof TIERS[number]

const TIER_STYLES: Record<Tier, { tab: string; badge: string; glow: string }> = {
  easy: {
    tab: 'text-sky-400 border-sky-400 bg-sky-500/10',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    glow: 'shadow-[0_0_12px_rgba(56,189,248,0.25)]',
  },
  medium: {
    tab: 'text-orange-400 border-orange-400 bg-orange-500/10',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    glow: 'shadow-[0_0_12px_rgba(251,146,60,0.25)]',
  },
  hard: {
    tab: 'text-rose-400 border-rose-400 bg-rose-500/10',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    glow: 'shadow-[0_0_12px_rgba(251,113,133,0.25)]',
  },
}

const RANK_ICONS: Record<number, { icon: string; color: string }> = {
  1: { icon: '🥇', color: 'text-yellow-400' },
  2: { icon: '🥈', color: 'text-slate-300' },
  3: { icon: '🥉', color: 'text-orange-400' },
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

  return (
    <div className="max-w-lg mx-auto animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-yellow-500/20 rounded-2xl flex items-center justify-center">
          <Trophy className="w-5 h-5 text-yellow-400" />
        </div>
        <div>
          <h1 className="text-xl font-black text-ink-100">{t('leaderboard.title')}</h1>
          <p className="text-xs text-ink-600">{t('leaderboard.player')} · {t('leaderboard.contests')} · {t('leaderboard.winnings')}</p>
        </div>
      </div>

      {/* Tier tabs */}
      <div className="flex gap-2 mb-5">
        {TIERS.map((tier) => {
          const active = tier === activeTier
          const style = TIER_STYLES[tier]
          return (
            <button
              key={tier}
              onClick={() => setActiveTier(tier)}
              className={`flex-1 py-2 text-sm font-bold rounded-xl border transition-all duration-150 ${
                active
                  ? `${style.tab} ${style.glow}`
                  : 'border-surface-600 text-ink-500 bg-surface-700 hover:text-ink-300'
              }`}
            >
              {t(`leaderboard.${tier}`)}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[2rem_1fr_5rem_6rem] gap-2 px-4 py-2.5 border-b border-surface-700">
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
              return (
                <div
                  key={entry.rank}
                  className={`grid grid-cols-[2rem_1fr_5rem_6rem] gap-2 items-center px-4 py-3 border-b border-surface-700/50 last:border-0 transition-colors ${
                    isYou ? 'bg-brand-cyan/5' : 'hover:bg-surface-700/30'
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
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-sm font-semibold truncate ${isYou ? 'text-brand-cyan' : 'text-ink-200'}`}>
                      @{entry.username}
                    </span>
                    {isYou && (
                      <span className="text-[10px] font-black text-brand-cyan bg-brand-cyan/10 border border-brand-cyan/30 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        {t('leaderboard.you')}
                      </span>
                    )}
                  </div>

                  {/* Contest count */}
                  <div className="text-right">
                    <span className="text-sm font-bold text-ink-200">{entry.contest_count}</span>
                  </div>

                  {/* Winnings */}
                  <div className="flex items-center justify-end gap-1">
                    <Star className="w-3 h-3 text-brand-cyan flex-shrink-0" />
                    <span className="text-sm font-bold text-brand-cyan">
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
