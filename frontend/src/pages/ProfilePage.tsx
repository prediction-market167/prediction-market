import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { authApi } from '@/api/auth'
import referralApi from '@/api/referral'
import { useAppSelector } from '@/hooks/useStore'
import {
  User as UserIcon, Star, Copy, Check, Ticket, CheckCircle, Gift, Users,
} from 'lucide-react'

const TIER_COLORS: Record<string, string> = {
  easy: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
  medium: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  hard: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
}

const MILESTONES = [
  { count: 3, tier: 'easy' },
  { count: 5, tier: 'medium' },
  { count: 10, tier: 'hard' },
]

export default function ProfilePage() {
  const { t } = useTranslation()
  const token = useAppSelector((s) => s.auth.token)
  const [copied, setCopied] = useState(false)

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    enabled: !!token,
  })

  const { data: referral } = useQuery({
    queryKey: ['referral-info'],
    queryFn: referralApi.info,
    enabled: !!token,
  })

  const tgUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id
  const referralLink = tgUserId
    ? `https://t.me/predictmarketa_bot?start=ref_${tgUserId}`
    : (referral?.referral_link ?? '')

  const handleCopy = () => {
    if (!referralLink) return
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const activeCount = referral?.active_referral_count ?? 0

  return (
    <div className="animate-slide-up max-w-lg mx-auto">
      {/* User card */}
      <div className="card p-6 mb-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-brand flex items-center justify-center shadow-glow-cyan flex-shrink-0">
            <UserIcon className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-ink-100 text-lg truncate">
              @{user?.username ?? '—'}
            </p>
            {user?.full_name && (
              <p className="text-sm text-ink-500 truncate">{user.full_name}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-ink-600 font-semibold uppercase tracking-widest mb-0.5">
              {t('profile.balance')}
            </p>
            <p className="text-xl font-black text-brand-cyan flex items-center gap-1">
              <Star className="w-4 h-4" />
              {Number(user?.balance ?? 0).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Referral card */}
      <div className="card p-6 mb-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-brand-purple/20 rounded-xl flex items-center justify-center">
            <Users className="w-4 h-4 text-brand-purple" />
          </div>
          <div>
            <h2 className="font-black text-ink-100 text-base">{t('referral.title')}</h2>
            <p className="text-xs text-ink-600">{t('referral.commission')}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-surface-700 rounded-2xl p-4">
            <p className="text-xs text-ink-600 font-semibold uppercase tracking-widest mb-1">
              {t('referral.activeFriends')}
            </p>
            <p className="text-2xl font-black text-ink-100">{activeCount}</p>
          </div>
          <div className="bg-surface-700 rounded-2xl p-4">
            <p className="text-xs text-ink-600 font-semibold uppercase tracking-widest mb-1">
              {t('referral.lifetimeEarnings')}
            </p>
            <p className="text-2xl font-black text-yes">
              {Number(referral?.lifetime_earnings ?? 0).toLocaleString()} ⭐
            </p>
          </div>
        </div>

        {/* Referral link */}
        <p className="text-xs font-semibold text-ink-500 uppercase tracking-widest mb-2">
          {t('referral.link')}
        </p>
        <div className="flex items-center gap-2 bg-surface-700 rounded-xl px-3 py-2.5 mb-5">
          <p className="flex-1 text-xs text-brand-cyan font-mono truncate">
            {referralLink || '—'}
          </p>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs font-semibold text-ink-400 hover:text-ink-100 transition-colors px-2 py-1 rounded-lg hover:bg-surface-600 flex-shrink-0"
          >
            {copied
              ? <><Check className="w-3.5 h-3.5 text-yes" />{t('referral.copied')}</>
              : <><Copy className="w-3.5 h-3.5" />{t('referral.copy')}</>
            }
          </button>
        </div>

        {/* Milestones */}
        <p className="text-xs font-semibold text-ink-500 uppercase tracking-widest mb-3">
          {t('referral.milestones')}
        </p>
        <div className="space-y-2 mb-5">
          {MILESTONES.map(({ count, tier }) => {
            const reached = activeCount >= count
            return (
              <div
                key={tier}
                className={`flex items-center justify-between rounded-xl px-4 py-3 border ${
                  reached ? 'bg-yes/10 border-yes/30' : 'bg-surface-700 border-surface-600'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Ticket className={`w-4 h-4 ${reached ? 'text-yes' : 'text-ink-600'}`} />
                  <span className={`text-sm font-semibold ${reached ? 'text-ink-100' : 'text-ink-500'}`}>
                    {t(`referral.milestone${count}`)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full border ${TIER_COLORS[tier] ?? ''}`}>
                    {tier.toUpperCase()}
                  </span>
                  {reached
                    ? <CheckCircle className="w-4 h-4 text-yes" />
                    : <span className="text-xs text-ink-600">{t('referral.friendsCount', { count: activeCount, target: count })}</span>
                  }
                </div>
              </div>
            )
          })}
        </div>

        {/* Available tickets */}
        {referral && referral.tickets.length > 0 && (
          <>
            <p className="text-xs font-semibold text-ink-500 uppercase tracking-widest mb-3">
              {t('referral.tickets')}
            </p>
            <div className="space-y-2 mb-5">
              {referral.tickets.map((ticket) => (
                <div key={ticket.id} className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${TIER_COLORS[ticket.tier] ?? ''}`}>
                  <Gift className="w-4 h-4" />
                  <span className="text-sm font-bold">
                    {t('referral.ticketLabel', { tier: ticket.tier.toUpperCase() })}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* How it works */}
        <div className="pt-4 border-t border-surface-700">
          <p className="text-xs font-semibold text-ink-600 uppercase tracking-widest mb-3">
            {t('referral.howItWorks')}
          </p>
          <div className="space-y-2">
            {[t('referral.step1'), t('referral.step2'), t('referral.step3')].map((step, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-brand-purple/20 text-brand-purple text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-ink-400 leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
