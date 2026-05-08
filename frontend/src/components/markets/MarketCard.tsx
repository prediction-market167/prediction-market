import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useState, useEffect, useMemo } from 'react'
import type { Market } from '@/types'
import { TrendingUp, Clock, Timer } from 'lucide-react'

interface Props {
  market: Market
}

const statusStyle: Record<string, string> = {
  open: 'bg-yes/20 text-yes border-yes/30',
  closed: 'bg-surface-700 text-ink-400 border-surface-500',
  resolved: 'bg-brand-blue/20 text-brand-cyan border-brand-cyan/30',
  cancelled: 'bg-surface-700 text-ink-600 border-surface-600',
}

const MIN_PARTICIPANTS = 20
const AUTO_CANCEL_MS = 60 * 60 * 1000 // 1 hour

function Countdown({ createdAt }: { createdAt: string }) {
  const deadline = useMemo(
    () => new Date(createdAt).getTime() + AUTO_CANCEL_MS,
    [createdAt],
  )
  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - Date.now()))

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, deadline - Date.now()))
    }, 1000)
    return () => clearInterval(id)
  }, [deadline])

  if (remaining === 0) {
    return (
      <span className="flex items-center gap-1 text-no text-xs font-semibold">
        <Timer className="w-3 h-3" />
        Auto-closing…
      </span>
    )
  }

  const totalSecs = Math.floor(remaining / 1000)
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  const display = mins >= 60
    ? `${Math.floor(mins / 60)}h ${mins % 60}m`
    : `${mins}:${secs.toString().padStart(2, '0')}`

  return (
    <span className="flex items-center gap-1 text-ink-500 text-xs font-medium">
      <Timer className="w-3 h-3" />
      {display} to fill
    </span>
  )
}

export default function MarketCard({ market }: Props) {
  const { t } = useTranslation()
  const yesPercent = Math.round(market.yes_probability * 100)
  const noPercent = 100 - yesPercent
  const style = statusStyle[market.status] ?? statusStyle.open

  const showCountdown =
    market.status === 'open' &&
    (market.participant_count ?? 0) < MIN_PARTICIPANTS

  return (
    <Link to={`/markets/${market.id}`} className="card card-hover block p-5 group h-full">
      <div className="flex items-center justify-between gap-2 mb-4">
        <span className={`badge border ${style}`}>
          {t(`markets.status.${market.status}`)}
        </span>
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
          <span>${Number(market.total_volume).toLocaleString()}</span>
        </div>
        {showCountdown ? (
          <Countdown createdAt={market.created_at} />
        ) : (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>
              {new Date(market.close_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
