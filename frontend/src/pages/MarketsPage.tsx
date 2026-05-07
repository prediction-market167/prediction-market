import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { marketsApi } from '@/api/markets'
import MarketCard from '@/components/markets/MarketCard'
import { Search } from 'lucide-react'

const CATEGORY_KEYS = ['all', 'politics', 'sports', 'technology', 'economy', 'other'] as const
type CategoryKey = (typeof CATEGORY_KEYS)[number]

export default function MarketsPage() {
  const { t } = useTranslation()
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all')

  const { data: markets, isLoading } = useQuery({
    queryKey: ['markets'],
    queryFn: () => marketsApi.list({ limit: 50 }),
  })

  const filtered =
    activeCategory === 'all'
      ? markets
      : markets?.filter((m) => m.category.toLowerCase() === activeCategory)

  return (
    <div className="animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-ink-100">{t('markets.title')}</h1>
          <p className="text-sm text-ink-600 mt-1">
            {t('markets.available', { count: markets?.length ?? 0 })}
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-600 pointer-events-none" />
          <input
            className="input-dark pl-10 w-64"
            placeholder={t('markets.searchPlaceholder')}
            readOnly
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORY_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => setActiveCategory(key)}
            className={`text-sm font-semibold px-4 py-1.5 rounded-full border transition-all duration-150 ${
              activeCategory === key
                ? 'bg-gradient-brand text-white border-transparent shadow-glow-cyan'
                : 'border-surface-600 text-ink-400 hover:border-surface-500 hover:text-ink-200 bg-surface-800'
            }`}
          >
            {t(`markets.categories.${key}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="card p-5 h-44 animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="h-3 bg-surface-700 rounded-full mb-4 w-14" />
              <div className="h-4 bg-surface-700 rounded mb-2 w-full" />
              <div className="h-4 bg-surface-700 rounded mb-6 w-3/4" />
              <div className="h-1.5 bg-surface-700 rounded-full" />
            </div>
          ))}
        </div>
      ) : !filtered?.length ? (
        <div className="text-center py-24">
          <p className="text-ink-600 text-lg font-semibold">{t('markets.empty')}</p>
          <p className="text-ink-800 text-sm mt-1">{t('markets.emptyHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((market, i) => (
            <div
              key={market.id}
              className="animate-slide-up"
              style={{ animationDelay: `${Math.min(i * 40, 200)}ms` }}
            >
              <MarketCard market={market} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
