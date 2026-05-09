import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { authApi } from '@/api/auth'
import referralApi from '@/api/referral'
import { usersApi } from '@/api/users'
import type { WithdrawResult } from '@/api/users'
import { useAppSelector } from '@/hooks/useStore'
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react'
import leaderboardApi from '@/api/leaderboard'
import { Link } from 'react-router-dom'
import {
  User as UserIcon, Copy, Check, Ticket, CheckCircle, Gift, Users,
  LogOut, ArrowUpFromLine, AlertCircle,
} from 'lucide-react'
import GemIcon from '@/components/common/GemIcon'

const MIN_WITHDRAW = 500

const WEEKLY_BADGES: Record<number, { emoji: string; labelKey: string; color: string }> = {
  1: { emoji: '🥇', labelKey: 'leaderboard.badgeChampion', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  2: { emoji: '🔥', labelKey: 'leaderboard.badgeStreak',   color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
  3: { emoji: '⚡', labelKey: 'leaderboard.badgeSpeed',    color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
}

function TonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2.5 8.5L12 22L21.5 8.5L12 2Z" />
      <path d="M2.5 8.5L12 14L21.5 8.5" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" fill="none" />
    </svg>
  )
}

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
  const queryClient = useQueryClient()
  const walletAddress = useTonAddress()
  const [tonConnectUI] = useTonConnectUI()
  const [copied, setCopied] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawResult, setWithdrawResult] = useState<WithdrawResult | null>(null)
  const [withdrawError, setWithdrawError] = useState(false)

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    enabled: !!token,
  })

  const { data: weeklyEasy = [] }   = useQuery({ queryKey: ['lb-weekly', 'easy'],   queryFn: () => leaderboardApi.weekly('easy'),   staleTime: 60_000, enabled: !!user })
  const { data: weeklyMedium = [] } = useQuery({ queryKey: ['lb-weekly', 'medium'], queryFn: () => leaderboardApi.weekly('medium'), staleTime: 60_000, enabled: !!user })
  const { data: weeklyHard = [] }   = useQuery({ queryKey: ['lb-weekly', 'hard'],   queryFn: () => leaderboardApi.weekly('hard'),   staleTime: 60_000, enabled: !!user })

  const userBadge = (() => {
    const tiers = ['easy', 'medium', 'hard'] as const
    const allWeekly = [weeklyEasy, weeklyMedium, weeklyHard]
    for (let i = 0; i < tiers.length; i++) {
      const entries = allWeekly[i]
      const rank = entries.findIndex(e => e.username === user?.username) + 1
      if (rank > 0 && WEEKLY_BADGES[rank]) return { tier: tiers[i], rank, badge: WEEKLY_BADGES[rank] }
    }
    return null
  })()

  const { data: referral } = useQuery({
    queryKey: ['referral-info'],
    queryFn: referralApi.info,
    enabled: !!token,
  })

  const { data: settings } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: usersApi.platformSettings,
    enabled: !!token,
  })

  const withdrawMut = useMutation({
    mutationFn: (stars: number) => usersApi.withdraw(stars),
    onSuccess: (data) => {
      setWithdrawResult(data)
      setWithdrawError(false)
      setWithdrawAmount('')
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: () => {
      setWithdrawError(true)
    },
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
  const userBalance = Number(user?.balance ?? 0)
  const rate = settings?.stars_to_ton_rate ?? 100
  const parsedAmount = Number(withdrawAmount)
  const tonAmount = parsedAmount > 0 && rate > 0 ? (parsedAmount / rate).toFixed(4) : null

  const handleWithdraw = () => {
    if (!parsedAmount || parsedAmount <= 0) return
    setWithdrawError(false)
    setWithdrawResult(null)
    withdrawMut.mutate(parsedAmount)
  }

  return (
    <div className="animate-slide-up max-w-lg mx-auto">
      {/* User card */}
      <div className="card-glow mb-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-gold flex items-center justify-center shadow-glow-gold flex-shrink-0">
            <UserIcon className="w-7 h-7 text-surface-900" />
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
            <p className="text-xl font-black text-gold flex items-center gap-1">
              <GemIcon className="w-4 h-4" />
              {userBalance.toLocaleString()}
            </p>
          </div>
        </div>
        {userBadge && (
          <div className="mt-4 pt-4 border-t border-surface-600 flex items-center gap-3">
            <p className="text-xs text-ink-600 font-semibold uppercase tracking-widest">
              {t('leaderboard.yourBadge')}
            </p>
            <span className={`text-xs font-black px-2.5 py-1 rounded-full border ${userBadge.badge.color}`}>
              {userBadge.badge.emoji} {t(userBadge.badge.labelKey)}
            </span>
            <span className="text-xs text-ink-600 ml-auto capitalize">{userBadge.tier}</span>
          </div>
        )}
      </div>

      {/* TON Wallet & Withdrawal */}
      <div className="card mb-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-brand-purple/20 rounded-xl flex items-center justify-center">
            <TonIcon className="w-4 h-4 text-brand-cyan" />
          </div>
          <h2 className="font-black text-ink-100 text-base">{t('wallet.title')}</h2>
        </div>

        {!walletAddress ? (
          <div className="text-center py-2">
            <p className="text-sm text-ink-400 mb-4">{t('wallet.noWalletDesc')}</p>
            <button
              onClick={() => tonConnectUI.openModal()}
              className="btn-secondary px-6 py-2.5 flex items-center gap-2 mx-auto text-sm"
            >
              <TonIcon className="w-4 h-4" />
              {t('wallet.connect')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Connected address row */}
            <div className="flex items-center justify-between bg-surface-700 border border-surface-600 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <TonIcon className="w-3.5 h-3.5 text-brand-cyan" />
                <span className="text-sm font-mono text-brand-cyan">
                  {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
                </span>
              </div>
              <button
                onClick={() => tonConnectUI.disconnect()}
                className="flex items-center gap-1.5 text-xs text-ink-500 hover:text-no transition-colors"
              >
                <LogOut className="w-3 h-3" />
                {t('wallet.disconnect')}
              </button>
            </div>

            {/* Withdraw form */}
            <div>
              <label className="block text-xs font-semibold text-ink-500 uppercase tracking-widest mb-2">
                {t('wallet.amountLabel')}
              </label>
              <input
                type="number"
                min={1}
                max={userBalance}
                value={withdrawAmount}
                onChange={e => { setWithdrawAmount(e.target.value); setWithdrawResult(null); setWithdrawError(false) }}
                className="input-dark w-full"
                placeholder="0"
              />
            </div>

            <div className="bg-surface-700 border border-surface-600 rounded-xl px-4 py-3 flex justify-between items-center">
              <span className="text-xs text-ink-600 font-semibold uppercase tracking-wide">
                {t('wallet.youReceive')}
              </span>
              <span className="text-sm font-black text-gold">
                {tonAmount ? `${tonAmount} TON` : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-600">{t('wallet.rate', { rate })}</p>
              <p className="text-xs text-ink-600">{t('wallet.minWithdrawal')}</p>
            </div>

            {withdrawResult?.status === 'pending' && (
              <div className="rounded-xl p-4 bg-yes/10 border border-yes/30">
                <p className="text-sm font-black text-yes">{t('wallet.pendingTitle')}</p>
                <p className="text-xs text-ink-300 mt-1">
                  {t('wallet.pendingDesc', {
                    stars: withdrawResult.amount_stars,
                    ton: Number(withdrawResult.amount_ton).toFixed(4),
                  })}
                </p>
              </div>
            )}

            {withdrawError && (
              <div className="rounded-xl p-4 bg-no/10 border border-no/30 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-no flex-shrink-0" />
                <p className="text-sm text-no">{t('wallet.errorTitle')}</p>
              </div>
            )}

            <button
              onClick={handleWithdraw}
              disabled={
                !parsedAmount ||
                parsedAmount <= 0 ||
                parsedAmount < MIN_WITHDRAW ||
                parsedAmount > userBalance ||
                withdrawMut.isPending
              }
              className="w-full btn-primary py-3 text-sm font-black disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {withdrawMut.isPending ? (
                <><span className="w-4 h-4 border-2 border-surface-900/30 border-t-surface-900 rounded-full animate-spin-slow" /> {t('wallet.withdrawing')}</>
              ) : (
                <><ArrowUpFromLine className="w-4 h-4" /> {t('wallet.withdrawBtn', { stars: parsedAmount || 0 })}</>
              )}
            </button>

            {parsedAmount > 0 && parsedAmount < MIN_WITHDRAW && (
              <p className="text-xs text-no text-center">{t('wallet.minWithdrawalError')}</p>
            )}
            {parsedAmount > userBalance && (
              <p className="text-xs text-no text-center">{t('wallet.insufficientBalance')}</p>
            )}
          </div>
        )}
      </div>

      {/* Referral card */}
      <div className="card mb-5">
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
          <div className="bg-surface-700 border border-surface-600 rounded-2xl p-4">
            <p className="text-xs text-ink-600 font-semibold uppercase tracking-widest mb-1">
              {t('referral.activeFriends')}
            </p>
            <p className="text-2xl font-black text-ink-100">{activeCount}</p>
          </div>
          <div className="bg-surface-700 border border-gold/20 rounded-2xl p-4">
            <p className="text-xs text-ink-600 font-semibold uppercase tracking-widest mb-1">
              {t('referral.lifetimeEarnings')}
            </p>
            <p className="text-2xl font-black text-gold flex items-center gap-1">
              {Number(referral?.lifetime_earnings ?? 0).toLocaleString()}
              <GemIcon className="w-5 h-5" />
            </p>
          </div>
        </div>

        {/* Referral link */}
        <p className="text-xs font-semibold text-ink-500 uppercase tracking-widest mb-2">
          {t('referral.link')}
        </p>
        <div className="flex items-center gap-2 bg-surface-700 border border-surface-600 rounded-xl px-3 py-2.5 mb-5">
          <p className="flex-1 text-xs text-gold font-mono truncate">
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
        <div className="pt-4 border-t border-surface-600">
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
      {/* Footer links */}
      <div className="flex items-center justify-center gap-4 pb-2">
        <Link to="/privacy" className="text-xs text-ink-600 hover:text-ink-400 transition-colors">
          Privacy Policy
        </Link>
        <span className="text-ink-700">·</span>
        <Link to="/terms" className="text-xs text-ink-600 hover:text-ink-400 transition-colors">
          Terms of Service
        </Link>
      </div>
    </div>
  )
}
