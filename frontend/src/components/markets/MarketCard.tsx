import { Link } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Market } from '@/types'
import { Timer, Users, Eye, Loader2, Zap } from 'lucide-react'
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

const REVEAL_AFTER_MINUTES = 55
const REVEAL_MS = REVEAL_AFTER_MINUTES * 60 * 1000

const TIER_GLOW: Record<string, string> = {
  free:   'rgba(16,185,129,0.4)',
  easy:   'rgba(14,165,233,0.4)',
  medium: 'rgba(249,115,22,0.4)',
  hard:   'rgba(244,63,94,0.4)',
}

const TIER_BORDER: Record<string, string> = {
  free:   'rgba(16,185,129,0.35)',
  easy:   'rgba(14,165,233,0.35)',
  medium: 'rgba(249,115,22,0.35)',
  hard:   'rgba(244,63,94,0.35)',
}

const defaultStatusStyle: Record<string, { dot: string; label: string; bg: string }> = {
  open:      { dot: 'bg-emerald-400', label: 'LIVE',      bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  closed:    { dot: 'bg-ink-600',     label: 'CLOSED',    bg: 'bg-surface-700 text-ink-500 border-surface-600' },
  resolved:  { dot: 'bg-gold',        label: 'RESOLVED',  bg: 'bg-gold/15 text-gold border-gold/30' },
  cancelled: { dot: 'bg-no/60',       label: 'CANCELLED', bg: 'bg-no/10 text-no/60 border-no/20' },
}

function RevealCountdown({ createdAt }: { createdAt: string }) {
  const { t } = useTranslation()
  const deadline = useMemo(
    () => new Date(createdAt).getTime() + REVEAL_MS,
    [createdAt],
  )
  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - Date.now()))

  useEffect(() => {
    const id = setInterval(() => setRemaining(Math.max(0, deadline - Date.now())), 1000)
    return () => clearInterval(id)
  }, [deadline])

  if (remaining === 0)
    return (
      <span className="flex items-center gap-1 text-gold text-[11px] font-bold">
        <Eye className="w-3 h-3" />{t('game.revealing')}
      </span>
    )

  const totalSecs = Math.floor(remaining / 1000)
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  const display = mins >= 60
    ? `${Math.floor(mins / 60)}h ${mins % 60}m`
    : `${mins}:${secs.toString().padStart(2, '0')}`

  return (
    <span className="flex items-center gap-1 text-gold text-[11px] font-bold">
      <Timer className="w-3 h-3" />{t('game.revealIn', { time: display })}
    </span>
  )
}

export default function MarketCard({ market, tier }: Props) {
  const { t, i18n } = useTranslation()

  const yesPercent = Math.round(market.yes_probability * 100)
  const noPercent = 100 - yesPercent
  const st = defaultStatusStyle[market.status] ?? defaultStatusStyle.open
  const isQuiz = !!market.tier

  const isDarkPool = isQuiz && market.status === 'open' && !market.is_revealed

  const lang = i18n.language.split('-')[0]
  const localizedTitle = isQuiz
    ? (lang === 'ru' ? market.title_ru : lang === 'hi' ? market.title_hi : market.title_en) || market.title_en || market.title
    : market.title

  const tierId = tier?.id ?? market.tier ?? ''
  const glowColor = TIER_GLOW[tierId] ?? 'rgba(168,85,247,0.3)'
  const borderColor = TIER_BORDER[tierId] ?? 'rgba(168,85,247,0.3)'

  const gradientLine = tier
    ? `bg-gradient-to-r ${tier.gradient}`
    : 'bg-gradient-purple'

  return (
    <Link
      to={`/markets/${market.id}`}
      className="group relative flex flex-col rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-1"
      style={{
        background: 'linear-gradient(135deg, #0f0628 0%, #180d3d 100%)',
        border: `1px solid ${borderColor}`,
        boxShadow: `0 2px 8px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.15)`,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px rgba(0,0,0,0.7), 0 0 20px ${glowColor}, 0 0 0 1px ${borderColor}`
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 8px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.15)`
      }}
    >
      {/* Colored top accent line */}
      <div className={`h-1 w-full ${gradientLine}`} />

      <div className="flex flex-col flex-1 p-4">
        {/* Status + tier badge */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className={`flex items-center gap-1.5 text-[10px] font-black px-2 py-0.5 rounded-full border ${st.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot} ${market.status === 'open' ? 'animate-pulse' : ''}`} />
            {st.label}
          </span>
          {tier && (
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${tier.accentBg} ${tier.accentColor} ${tier.accentBorder}`}>
              {tier.id.toUpperCase()}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-bold text-ink-200 text-sm leading-snug mb-3 line-clamp-2 group-hover:text-ink-100 transition-colors">
          {localizedTitle}
        </h3>

        {/* Prize pool if quiz tier — show total volume as prize */}
        {isQuiz && Number(market.total_volume) > 0 && (
          <div className="flex items-center gap-1.5 mb-3">
            <Zap className="w-3.5 h-3.5 text-gold flex-shrink-0" />
            <span className="text-base font-black text-gold">
              {Number(market.total_volume).toLocaleString()} ⭐
            </span>
          </div>
        )}

        {/* Dark pool OR probability bar */}
        {isDarkPool ? (
          <div className="mb-3">
            <div className="h-2 rounded-full bg-surface-700 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-surface-600 to-surface-500 animate-pulse" style={{ width: '50%' }} />
            </div>
          </div>
        ) : (
          <div className="mb-3">
            <div className="flex justify-between text-xs font-black mb-1.5">
              <span className="text-emerald-400">YES {yesPercent}%</span>
              <span className="text-rose-400">NO {noPercent}%</span>
            </div>
            <div className="h-2 rounded-full bg-rose-500/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-yes transition-all duration-500"
                style={{ width: `${yesPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-1">
          {isDarkPool ? (
            <span className={`flex items-center gap-1 text-xs font-semibold ${
              market.pool_status === 'threshold_met' ? 'text-emerald-400' : 'text-gold'
            }`}>
              {market.pool_status === 'threshold_met' ? (
                <><Users className="w-3 h-3" />{t('game.thresholdMet')}</>
              ) : (
                <><Loader2 className="w-3 h-3 animate-spin" />{t('game.gathering')}</>
              )}
            </span>
          ) : (
            <div className="flex items-center gap-1.5 text-ink-600">
              <Users className="w-3 h-3" />
              <span className="text-xs font-semibold">
                {market.participant_count}
                {market.participant_count >= 20 && <span className="text-emerald-400 ml-0.5">✓</span>}
              </span>
            </div>
          )}

          {isDarkPool ? (
            <RevealCountdown createdAt={market.created_at} />
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
