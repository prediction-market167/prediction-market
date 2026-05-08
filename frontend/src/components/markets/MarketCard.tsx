import { Link } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import type { Market } from '@/types'
import { Timer, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Tier {
  id: string
  name: string
  stars: number
  gradient: string
  accentColor: string
  accentBg: string
  accentBorder: string
  icon: LucideIcon
}

interface Props {
  market: Market
  tier?: Tier
}

const MIN_PARTICIPANTS = 20
const AUTO_CANCEL_MS = 60 * 60 * 1000

const defaultStatusStyle: Record<string, { dot: string; label: string; bg: string }> = {
  open:      { dot: 'bg-emerald-400', label: 'LIVE',      bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  closed:    { dot: 'bg-ink-600',     label: 'CLOSED',    bg: 'bg-surface-700 text-ink-500 border-surface-600' },
  resolved:  { dot: 'bg-brand-cyan',  label: 'RESOLVED',  bg: 'bg-brand-cyan/15 text-brand-cyan border-brand-cyan/30' },
  cancelled: { dot: 'bg-no/60',       label: 'CANCELLED', bg: 'bg-no/10 text-no/60 border-no/20' },
}

function Countdown({ createdAt }: { createdAt: string }) {
  const deadline = useMemo(
    () => new Date(createdAt).getTime() + AUTO_CANCEL_MS,
    [createdAt],
  )
  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - Date.now()))

  useEffect(() => {
    const id = setInterval(() => setRemaining(Math.max(0, deadline - Date.now())), 1000)
    return () => clearInterval(id)
  }, [deadline])

  if (remaining === 0)
    return <span className="flex items-center gap-1 text-no text-[11px] font-bold"><Timer className="w-3 h-3" />Closing…</span>

  const totalSecs = Math.floor(remaining / 1000)
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  const display = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}:${secs.toString().padStart(2, '0')}`

  return (
    <span className="flex items-center gap-1 text-amber-400 text-[11px] font-bold">
      <Timer className="w-3 h-3" />{display}
    </span>
  )
}

export default function MarketCard({ market, tier }: Props) {
  const yesPercent = Math.round(market.yes_probability * 100)
  const noPercent = 100 - yesPercent
  const st = defaultStatusStyle[market.status] ?? defaultStatusStyle.open
  const participantCount = market.participant_count ?? 0
  const isPoolActive = participantCount >= MIN_PARTICIPANTS
  const showCountdown = market.status === 'open' && !isPoolActive

  const gradientLine = tier
    ? `bg-gradient-to-r ${tier.gradient}`
    : 'bg-gradient-to-r from-brand-cyan to-brand-purple'

  return (
    <Link
      to={`/markets/${market.id}`}
      className="group relative flex flex-col rounded-3xl bg-surface-800 border border-surface-700 hover:border-surface-500 overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30"
    >
      {/* Colored top accent line */}
      <div className={`h-1 w-full ${gradientLine}`} />

      <div className="flex flex-col flex-1 p-5">
        {/* Status + Category */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className={`flex items-center gap-1.5 text-[10px] font-black px-2 py-0.5 rounded-full border ${st.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot} ${market.status === 'open' ? 'animate-pulse' : ''}`} />
            {st.label}
          </span>
          <span className="text-[10px] text-ink-600 font-semibold uppercase tracking-wide">
            {market.category}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-bold text-ink-200 text-sm leading-snug mb-4 line-clamp-2 group-hover:text-ink-100 transition-colors">
          {market.title}
        </h3>

        {/* Probability bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs font-black mb-1.5">
            <span className="text-emerald-400">YES {yesPercent}%</span>
            <span className="text-rose-400">NO {noPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-rose-500/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${yesPercent}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-1">
          <div className="flex items-center gap-1.5 text-ink-600">
            <Users className="w-3 h-3" />
            <span className="text-xs font-semibold">
              {participantCount}
              {isPoolActive && <span className="text-emerald-400 ml-0.5">✓</span>}
            </span>
          </div>

          {showCountdown ? (
            <Countdown createdAt={market.created_at} />
          ) : (
            <span className="text-[11px] text-ink-600 font-medium">
              {new Date(market.close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
