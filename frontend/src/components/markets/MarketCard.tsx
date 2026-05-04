import { Link } from 'react-router-dom'
import type { Market } from '@/types'
import { TrendingUp, Clock } from 'lucide-react'

interface Props {
  market: Market
}

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: 'LIVE', className: 'bg-yes/20 text-yes border-yes/30' },
  closed: { label: 'CLOSED', className: 'bg-surface-700 text-ink-400 border-surface-500' },
  resolved: {
    label: 'RESOLVED',
    className: 'bg-brand-blue/20 text-brand-cyan border-brand-cyan/30',
  },
  cancelled: {
    label: 'CANCELLED',
    className: 'bg-surface-700 text-ink-600 border-surface-600',
  },
}

export default function MarketCard({ market }: Props) {
  const yesPercent = Math.round(market.yes_probability * 100)
  const noPercent = 100 - yesPercent
  const status = statusConfig[market.status] ?? statusConfig.open

  return (
    <Link to={`/markets/${market.id}`} className="card card-hover block p-5 group h-full">
      <div className="flex items-center justify-between gap-2 mb-4">
        <span className={`badge border ${status.className}`}>{status.label}</span>
        <span className="text-xs text-ink-600 font-medium">{market.category}</span>
      </div>

      <h3 className="font-semibold text-ink-200 text-sm leading-snug mb-5 line-clamp-2 group-hover:text-ink-100 transition-colors duration-150">
        {market.title}
      </h3>

      <div className="mb-4">
        <div className="flex justify-between text-xs font-bold mb-2">
          <span className="text-yes">YES {yesPercent}%</span>
          <span className="text-no">NO {noPercent}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-no/25 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-yes transition-all duration-500"
            style={{ width: `${yesPercent}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-ink-600">
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          <span>₮{Number(market.total_volume).toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>
            {new Date(market.close_date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>
    </Link>
  )
}
