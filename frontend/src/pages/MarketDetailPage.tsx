import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { marketsApi } from '@/api/markets'
import paymentsApi from '@/api/payments'
import { betsApi } from '@/api/bets'
import { authApi } from '@/api/auth'
import referralApi from '@/api/referral'
import { usersApi } from '@/api/users'
import { useAppSelector } from '@/hooks/useStore'
import {
  TrendingUp, Clock, CheckCircle, XCircle, Users, Star, Trophy,
  Eye, EyeOff, Loader2, Wallet, Gift, Zap, ArrowLeft, Ticket,
} from 'lucide-react'
import GemIcon from '@/components/common/GemIcon'
import type { BetSide, MarketResultEntry } from '@/types'
import Confetti from '@/components/common/Confetti'

type PaymentState = 'idle' | 'creating' | 'waiting' | 'verifying' | 'success' | 'cancelled' | 'error'
type PaymentMethod = 'balance' | 'ticket'

const POLL_INTERVAL_MS = 1500
const POLL_MAX_ATTEMPTS = 40  // 60 s total — covers Render cold-start (~30-60 s)
const MIN_PARTICIPANTS = 10
const TIER_AMOUNTS: Record<string, number> = { free: 0, easy: 20, medium: 50, hard: 100 }

const OPTION_TO_SIDE: BetSide[] = ['yes', 'no', 'opt2', 'opt3']
const OPTION_LABELS = ['A', 'B', 'C', 'D']

const OPTION_COLORS = [
  { active: 'bg-gold/15 border-gold text-gold shadow-glow-gold', inactive: 'border-surface-600 text-ink-400 hover:border-gold hover:text-gold hover:bg-gold/5' },
  { active: 'bg-gold/15 border-gold text-gold shadow-glow-gold', inactive: 'border-surface-600 text-ink-400 hover:border-gold hover:text-gold hover:bg-gold/5' },
  { active: 'bg-gold/15 border-gold text-gold shadow-glow-gold', inactive: 'border-surface-600 text-ink-400 hover:border-gold hover:text-gold hover:bg-gold/5' },
  { active: 'bg-gold/15 border-gold text-gold shadow-glow-gold', inactive: 'border-surface-600 text-ink-400 hover:border-gold hover:text-gold hover:bg-gold/5' },
]

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export default function MarketDetailPage() {
  const { t, i18n } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const token = useAppSelector((s) => s.auth.token)

  const [selectedOption, setSelectedOption] = useState<number>(0)
  const [paymentState, setPaymentState] = useState<PaymentState>('idle')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('balance')
  const [errorMsg, setErrorMsg] = useState('')
  const [placedBetId, setPlacedBetId] = useState<number | null>(null)
  const [showTopUpModal, setShowTopUpModal] = useState(false)
  const [topUpMethod, setTopUpMethod] = useState<'choose' | 'ton'>('choose')
  const [tonCopied, setTonCopied] = useState(false)
  const submissionTimestampRef = useRef<number | null>(null)

  const { data: market, isLoading } = useQuery({
    queryKey: ['market', id],
    queryFn: () => marketsApi.get(Number(id)),
    refetchInterval: 10_000,
  })

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    enabled: !!token,
  })

  // Check if current user has already entered this market
  const { data: myBetsForMarket = [] } = useQuery({
    queryKey: ['my-bet-for-market', id],
    queryFn: () => betsApi.myBets({ market_id: Number(id), limit: 1 }),
    enabled: !!token && !!id,
  })
  const myBet = myBetsForMarket[0] ?? null

  // Fetch results when market is resolved
  const { data: results } = useQuery({
    queryKey: ['market-results', id],
    queryFn: () => marketsApi.results(Number(id)),
    enabled: !!token && !!market && (market.status === 'resolved' || market.status === 'cancelled'),
  })

  // Fetch available referral tickets
  const { data: referralInfo } = useQuery({
    queryKey: ['referral-info'],
    queryFn: referralApi.info,
    enabled: !!token,
    staleTime: 30_000,
  })

  // Find a usable ticket that matches this market's tier
  const matchingTicket = referralInfo?.tickets.find(
    (tk) => !tk.is_used && market?.tier && tk.tier === market.tier
  ) ?? null

  const userBalance = Number(me?.balance ?? 0)
  const betAmount = TIER_AMOUNTS[market?.tier ?? ''] ?? 100
  const canPayBalance = userBalance >= betAmount

  const { data: depositInfo } = useQuery({
    queryKey: ['deposit-address'],
    queryFn: usersApi.depositAddress,
    enabled: !!token && showTopUpModal && topUpMethod === 'ton',
    staleTime: 5 * 60_000,
  })

  const isQuiz = !!market?.tier
  const isFree = market?.tier === 'free'
  const isDarkPool = isQuiz && !isFree && market?.status === 'open' && !market?.is_revealed

  const lang = i18n.language.split('-')[0]
  const localizedOptions = useMemo(() => {
    if (!market?.options) return null
    const opts = market.options
    const raw = (lang === 'ru' ? opts.ru : lang === 'hi' ? opts.hi : opts.en) || opts.en || []
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) as string[] } catch { return [] }
    }
    return raw as string[]
  }, [market?.options, lang])

  const localizedTitle = useMemo(() => {
    if (!market) return ''
    if (!isQuiz) return market.title
    return (lang === 'ru' ? market.title_ru : lang === 'hi' ? market.title_hi : market.title_en) || market.title_en || market.title
  }, [market, isQuiz, lang])

  const side = OPTION_TO_SIDE[selectedOption] ?? 'yes'

  // Whether the user is already registered (has an active bet on this market)
  const isRegistered = !!myBet || paymentState === 'success'

  // Elapsed time since contest started (for submission confirmation)
  const submissionElapsed = useMemo(() => {
    if (!market || !submissionTimestampRef.current) return null
    const contestStart = new Date(market.created_at).getTime()
    const elapsed = Math.max(0, (submissionTimestampRef.current - contestStart) / 1000)
    return formatElapsed(elapsed)
  }, [market, placedBetId]) // eslint-disable-line react-hooks/exhaustive-deps

  const pollVerify = useCallback(async (payment_id: number) => {
    setPaymentState('verifying')
    for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
      try {
        const result = await paymentsApi.verifyStars(payment_id)
        if (result.status === 'paid' && result.bet_id) {
          submissionTimestampRef.current = Date.now()
          setPlacedBetId(result.bet_id)
          setPaymentState('success')
          queryClient.invalidateQueries({ queryKey: ['market', id] })
          queryClient.invalidateQueries({ queryKey: ['my-bets'] })
          queryClient.invalidateQueries({ queryKey: ['my-bet-for-market', id] })
          queryClient.invalidateQueries({ queryKey: ['me'] })
          return
        }
        if (result.status === 'failed') {
          setErrorMsg(t('market.errors.betFailed'))
          setPaymentState('error')
          return
        }
      } catch { /* keep polling */ }
    }
    setErrorMsg(t('market.errors.timeout'))
    setPaymentState('error')
  }, [id, queryClient, t])

  const handleStarsBet = useCallback(async () => {
    setErrorMsg('')
    setPaymentState('creating')

    let invoice: Awaited<ReturnType<typeof paymentsApi.createStarsInvoice>>
    try {
      invoice = await paymentsApi.createStarsInvoice(Number(id), side, betAmount)
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.detail ?? t('market.errors.failedInvoice'))
      setPaymentState('error')
      return
    }

    const tgWebApp = window.Telegram?.WebApp
    if (!tgWebApp?.openInvoice) {
      setErrorMsg(t('market.errors.telegramOnly'))
      setPaymentState('error')
      return
    }

    setPaymentState('waiting')
    tgWebApp.openInvoice(invoice.invoice_url, (status: string) => {
      if (status === 'paid') {
        pollVerify(invoice.payment_id)
      } else if (status === 'cancelled') {
        setPaymentState('cancelled')
      } else {
        setErrorMsg(t('market.errors.paymentStatus', { status }))
        setPaymentState('error')
      }
    })
  }, [id, side, pollVerify, t])

  const handleBalanceBet = useCallback(async () => {
    setErrorMsg('')
    setPaymentState('verifying')
    try {
      const bet = await betsApi.place({ market_id: Number(id), side, amount: betAmount })
      submissionTimestampRef.current = Date.now()
      setPlacedBetId(bet.id)
      setPaymentState('success')
      queryClient.invalidateQueries({ queryKey: ['market', id] })
      queryClient.invalidateQueries({ queryKey: ['my-bets'] })
      queryClient.invalidateQueries({ queryKey: ['my-bet-for-market', id] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.detail ?? t('market.errors.betFailed'))
      setPaymentState('error')
    }
  }, [id, side, queryClient, t])

  const handleTicketBet = useCallback(async () => {
    if (!matchingTicket) return
    setErrorMsg('')
    setPaymentState('verifying')
    try {
      const bet = await betsApi.useTicket({
        market_id: Number(id),
        ticket_id: matchingTicket.id,
        side,
        amount: 0,
      })
      submissionTimestampRef.current = Date.now()
      setPlacedBetId(bet.id)
      setPaymentState('success')
      queryClient.invalidateQueries({ queryKey: ['market', id] })
      queryClient.invalidateQueries({ queryKey: ['my-bets'] })
      queryClient.invalidateQueries({ queryKey: ['my-bet-for-market', id] })
      queryClient.invalidateQueries({ queryKey: ['referral-info'] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.detail ?? t('market.errors.betFailed'))
      setPaymentState('error')
    }
  }, [id, side, matchingTicket, queryClient, t])

  const handleCopyTon = useCallback(() => {
    if (!depositInfo?.address) return
    navigator.clipboard.writeText(depositInfo.address)
    setTonCopied(true)
    setTimeout(() => setTonCopied(false), 2000)
  }, [depositInfo])

  const closeTopUpModal = useCallback(() => {
    setShowTopUpModal(false)
    setTopUpMethod('choose')
  }, [])

  const handleSubmit = isFree
    ? handleBalanceBet
    : paymentMethod === 'ticket'
      ? handleTicketBet
      : canPayBalance
        ? handleBalanceBet
        : () => setShowTopUpModal(true)

  const resetPayment = () => {
    setPaymentState('idle')
    setErrorMsg('')
    setPlacedBetId(null)
    submissionTimestampRef.current = null
  }

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin-slow" />
      </div>
    )

  if (!market)
    return (
      <div className="text-center py-24">
        <p className="text-no font-semibold">{t('market.notFound')}</p>
      </div>
    )

  const yesPercent = Math.round(market.yes_probability * 100)
  const noPercent = 100 - yesPercent
  const isBusy = paymentState === 'creating' || paymentState === 'waiting' || paymentState === 'verifying'

  const participantCount = market.participant_count ?? 0
  const isPoolActive = participantCount >= MIN_PARTICIPANTS
  const progress = Math.min(participantCount / MIN_PARTICIPANTS, 1)

  return (
    <div className="max-w-2xl mx-auto animate-slide-up">
      <Confetti active={paymentState === 'success'} />

      {/* Top-up Modal */}
      {showTopUpModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={closeTopUpModal}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-full max-w-md bg-surface-800 rounded-t-2xl border border-surface-600/60 p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            {topUpMethod === 'choose' ? (
              <>
                <h3 className="text-base font-black text-white mb-1">{t('payment.insufficientTitle')}</h3>
                <p className="text-xs text-ink-500 mb-4">
                  {t('payment.needGems', { amount: betAmount, balance: userBalance.toLocaleString() })}
                </p>
                <p className="text-sm text-ink-300 mb-4">{t('payment.topUpPrompt')}</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { closeTopUpModal(); handleStarsBet() }}
                    disabled={isBusy}
                    className="py-3 px-4 rounded-xl text-sm font-bold border-2 border-gold/50 bg-gold/10 text-gold flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    <Star className="w-4 h-4" />
                    {t('payment.topUpWithStars')}
                  </button>
                  <button
                    onClick={() => setTopUpMethod('ton')}
                    className="py-3 px-4 rounded-xl text-sm font-bold border-2 border-blue-500/50 bg-blue-500/10 text-blue-400 flex items-center justify-center gap-2"
                  >
                    💎 {t('payment.topUpWithTon')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => setTopUpMethod('choose')}
                  className="flex items-center gap-2 text-sm font-semibold text-ink-400 hover:text-ink-200 mb-4"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t('payment.topUpWithTon')}
                </button>
                {depositInfo ? (
                  <>
                    <p className="text-xs text-ink-500 mb-2">{t('payment.sendTon')}</p>
                    <div className="bg-surface-700 rounded-lg p-3 flex items-start gap-2 mb-2">
                      <p className="text-xs font-mono text-ink-200 flex-1 break-all leading-relaxed">{depositInfo.address}</p>
                      <button
                        onClick={handleCopyTon}
                        className={`text-xs font-bold flex-shrink-0 mt-0.5 transition-colors ${tonCopied ? 'text-emerald-400' : 'text-gold'}`}
                      >
                        {tonCopied ? t('referral.copied') : t('referral.copy')}
                      </button>
                    </div>
                    {depositInfo.memo && (
                      <p className="text-xs text-ink-600 mb-2">
                        Memo: <span className="font-mono text-ink-400">{depositInfo.memo}</span>
                      </p>
                    )}
                    <p className="text-xs text-ink-600">{t('payment.tonNote')}</p>
                  </>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <span className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin-slow" />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Market info card */}
      <div className="card mb-5">
        <div className="flex items-center gap-2 mb-4">
          <span className={`badge border ${
            market.status === 'open'
              ? 'bg-yes/20 text-yes border-yes/30'
              : 'bg-surface-700 text-ink-500 border-surface-600'
          }`}>
            {market.status.toUpperCase()}
          </span>
          {market.tier && (
            <span className="badge bg-gold/10 text-gold border border-gold/30">
              {market.tier.toUpperCase()}
            </span>
          )}
          <span className="text-xs text-ink-600 font-medium">{market.category}</span>
        </div>

        <h1 className="text-2xl font-black text-ink-100 leading-tight mb-3">{localizedTitle}</h1>
        {market.description && (
          <p className="text-sm text-ink-400 leading-relaxed mb-6">{market.description}</p>
        )}

        {/* Dark pool status (entry phase) */}
        {isDarkPool ? (
          <div className="mb-6 rounded-xl p-5 bg-surface-700 border border-surface-600">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-surface-600 flex items-center justify-center flex-shrink-0">
                <EyeOff className="w-5 h-5 text-ink-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-ink-200">{t('game.darkPool')}</p>
                <p className="text-xs text-ink-500 mt-0.5">{t('game.darkPoolHint')}</p>
              </div>
            </div>
            <div className="h-2 rounded-full bg-surface-600 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-surface-500 to-surface-400 animate-pulse" style={{ width: '50%' }} />
            </div>
            <div className={`mt-3 flex items-center gap-2 text-xs font-semibold ${
              market.pool_status === 'threshold_met' ? 'text-emerald-400' : 'text-gold'
            }`}>
              {market.pool_status === 'threshold_met' ? (
                <><CheckCircle className="w-3.5 h-3.5" />{t('game.thresholdMet')}</>
              ) : (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />{t('game.gathering')}</>
              )}
            </div>
          </div>
        ) : (
          !isQuiz && (
            <div className="mb-6">
              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-5xl font-black text-yes tabular-nums">{yesPercent}%</p>
                  <p className="text-xs text-ink-600 font-semibold uppercase tracking-wider mt-1">
                    {t('market.chanceYes')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-5xl font-black text-no tabular-nums">{noPercent}%</p>
                  <p className="text-xs text-ink-600 font-semibold uppercase tracking-wider mt-1">
                    {t('market.chanceNo')}
                  </p>
                </div>
              </div>
              <div className="h-3 rounded-full bg-no/25 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-yes transition-all duration-700 ease-out"
                  style={{ width: `${yesPercent}%` }}
                />
              </div>
            </div>
          )
        )}

        {/* Correct answer revealed */}
        {isQuiz && market.is_revealed && market.correct_option_idx != null && localizedOptions && (
          <div className="mb-6 rounded-xl p-4 bg-emerald-500/10 border border-emerald-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-emerald-400">{t('game.correctAnswer')}</span>
            </div>
            <p className="text-base font-black text-ink-100">
              {OPTION_LABELS[market.correct_option_idx]}. {localizedOptions[market.correct_option_idx]}
            </p>
          </div>
        )}

        {/* Pool progress (non-quiz open markets) */}
        {market.status === 'open' && !isDarkPool && !isQuiz && (
          <div className={`mb-6 rounded-xl p-4 border transition-all duration-500 ${
            isPoolActive ? 'bg-yes/10 border-yes/30' : 'bg-surface-700 border-surface-600'
          }`}>
            {isPoolActive ? (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-yes/20 flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-5 h-5 text-yes" />
                </div>
                <div>
                  <p className="text-sm font-bold text-yes">{t('market.poolActive')}</p>
                  <p className="text-xs text-ink-400 mt-0.5">
                    {t('market.poolParticipants', { count: participantCount })}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-2.5">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-ink-400" />
                    <span className="text-sm font-semibold text-ink-300">{t('market.poolProgress')}</span>
                  </div>
                  <span className="text-sm font-bold text-ink-100 tabular-nums">
                    {participantCount}<span className="text-ink-500 font-normal"> / {MIN_PARTICIPANTS}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-600 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-gold transition-all duration-700 ease-out" style={{ width: `${progress * 100}%` }} />
                </div>
                <p className="text-xs text-ink-600 mt-2">
                  {t('market.poolNeeded', { count: MIN_PARTICIPANTS - participantCount })}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {([
            {
              icon: TrendingUp,
              label: t('market.volume'),
              node: (
                <span className="flex items-center gap-1">
                  <GemIcon className="w-3.5 h-3.5" />
                  {Number(market.total_volume).toLocaleString()}
                </span>
              ),
            },
            {
              icon: Clock,
              label: t('market.closes'),
              node: new Date(market.close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            },
            {
              icon: Users,
              label: t('market.players'),
              node: isDarkPool ? '—' : `${participantCount}${isPoolActive ? ' ✓' : ''}`,
            },
          ] as const).map(({ icon: Icon, label, node }) => (
            <div key={label} className="bg-surface-700 border border-surface-600 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className="w-3.5 h-3.5 text-ink-600" />
                <span className="text-xs text-ink-600 font-semibold uppercase tracking-wide">{label}</span>
              </div>
              <p className="text-sm font-bold text-ink-100">{node}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Not logged in */}
      {!token && (
        <div className="card-glow text-center">
          <p className="text-ink-400 mb-4 text-sm">{t('market.signInToTrade')}</p>
          <Link to="/login" className="btn-primary px-6 py-2.5 shadow-glow-gold">
            {t('market.loginToTrade')}
          </Link>
        </div>
      )}

      {/* Quiz entry phase panel */}
      {token && isQuiz && isDarkPool && (
        <div className="card">
          {/* Already registered: show "wait for results" state */}
          {isRegistered ? (
            <div className="text-center py-4">
              {paymentState === 'success' ? (
                <>
                  <Confetti active />
                  <div className="w-16 h-16 rounded-2xl bg-gradient-gold flex items-center justify-center mx-auto mb-4 shadow-glow-gold">
                    <Zap className="w-8 h-8 text-surface-900" />
                  </div>
                  <h3 className="text-lg font-bold text-gradient-gold mb-1">{t('game.submittedBanner')}</h3>
                  {submissionElapsed && (
                    <p className="text-sm text-ink-400 mb-1">
                      {t('game.submittedIn', { elapsed: submissionElapsed })}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-bold text-emerald-400 mb-1">{t('game.alreadyEntered')}</h3>
                  <p className="text-sm text-ink-500">{t('game.alreadyEnteredHint')}</p>
                </>
              )}

              {/* Show what answer they picked */}
              {localizedOptions && (() => {
                const answerIdx = myBet
                  ? OPTION_TO_SIDE.indexOf(myBet.side as BetSide)
                  : selectedOption
                const colors = OPTION_COLORS[answerIdx] ?? OPTION_COLORS[0]
                return (
                  <div className={`mt-5 flex items-center gap-3 py-3 px-4 rounded-xl border-2 text-left ${colors.active}`}>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 bg-white/20">
                      {OPTION_LABELS[answerIdx] ?? '?'}
                    </span>
                    <span className="text-sm font-semibold">{localizedOptions[answerIdx]}</span>
                  </div>
                )
              })()}
            </div>
          ) : (
            /* Not yet registered: show answer picker + payment */
            <>
              {/* Answer picker (for selection before paying) */}
              <h2 className="text-base font-bold text-ink-300 mb-3">{t('game.enterContest')}</h2>
              {localizedOptions ? (
                <div className="grid gap-2 mb-5">
                  {localizedOptions.map((opt, idx) => {
                    const colors = OPTION_COLORS[idx] ?? OPTION_COLORS[0]
                    const isSelected = selectedOption === idx
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedOption(idx)}
                        disabled={isBusy}
                        className={`flex items-center gap-3 py-3 px-4 rounded-xl font-semibold text-sm border-2 transition-all duration-150 disabled:opacity-50 text-left ${
                          isSelected ? colors.active : colors.inactive
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                          isSelected ? 'bg-white/20' : 'bg-surface-700'
                        }`}>
                          {OPTION_LABELS[idx]}
                        </span>
                        {opt}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <button
                    onClick={() => setSelectedOption(0)}
                    disabled={isBusy}
                    className={`flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm border-2 transition-all duration-150 disabled:opacity-50 ${
                      selectedOption === 0
                        ? 'bg-yes/15 border-yes text-yes shadow-glow-yes'
                        : 'border-surface-600 text-ink-400 hover:border-yes/40 hover:text-yes/70 hover:bg-yes/5'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" /> YES
                  </button>
                  <button
                    onClick={() => setSelectedOption(1)}
                    disabled={isBusy}
                    className={`flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm border-2 transition-all duration-150 disabled:opacity-50 ${
                      selectedOption === 1
                        ? 'bg-no/15 border-no text-no shadow-glow-no'
                        : 'border-surface-600 text-ink-400 hover:border-no/40 hover:text-no/70 hover:bg-no/5'
                    }`}
                  >
                    <XCircle className="w-4 h-4" /> NO
                  </button>
                </div>
              )}

              {/* Payment method selector */}
              {isFree ? (
                <div className="mb-4 flex items-center gap-2 rounded-xl px-4 py-3 bg-emerald-500/10 border border-emerald-500/30">
                  <Gift className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm font-bold text-emerald-400">{t('game.freeEntry')}</span>
                  <span className="text-xs text-ink-500 ml-auto flex items-center gap-0.5">0 <GemIcon className="w-3 h-3" /></span>
                </div>
              ) : (
                <div className="mb-4">
                  {matchingTicket ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setPaymentMethod('balance')}
                        disabled={isBusy}
                        className={`py-2.5 px-3 rounded-xl text-sm font-semibold border-2 transition-all text-left disabled:opacity-40 ${
                          paymentMethod !== 'ticket'
                            ? 'bg-gold/10 border-gold/50 text-gold'
                            : 'border-surface-600 text-ink-400 hover:border-surface-500'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Wallet className="w-3.5 h-3.5" />
                          {t('payment.withBalance')}
                        </div>
                        <p className="text-xs font-normal opacity-70">
                          {t('payment.balanceSuffix', { balance: userBalance.toLocaleString() })}
                        </p>
                      </button>
                      <button
                        onClick={() => setPaymentMethod('ticket')}
                        disabled={isBusy}
                        className={`py-2.5 px-3 rounded-xl text-sm font-semibold border-2 transition-all text-left disabled:opacity-40 ${
                          paymentMethod === 'ticket'
                            ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-400'
                            : 'border-emerald-500/30 text-emerald-500/70 hover:border-emerald-500/50 hover:text-emerald-400'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Ticket className="w-3.5 h-3.5" />
                          {t('referral.useTicket')}
                        </div>
                        <p className="text-xs font-normal opacity-70">0 💎</p>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 py-3 px-4 rounded-xl bg-surface-700 border border-surface-600">
                      <Wallet className="w-4 h-4 text-ink-500 flex-shrink-0" />
                      <span className="text-sm font-semibold text-ink-300">{t('payment.withBalance')}</span>
                      <span className="ml-auto text-sm font-bold text-gold flex items-center gap-1">
                        <GemIcon className="w-3.5 h-3.5" />
                        {userBalance.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {!isFree && paymentMethod !== 'ticket' && (
                <div className="bg-surface-700 border border-surface-600 rounded-xl p-4 mb-4 flex justify-between items-center">
                  <span className="text-xs text-ink-600 font-semibold uppercase tracking-wide">{t('market.amount')}</span>
                  <span className="text-sm font-black text-gold flex items-center gap-1.5">
                    <GemIcon className="w-3.5 h-3.5" />
                    {betAmount} · {t('game.fixed')}
                  </span>
                </div>
              )}

              {(paymentState === 'error' || paymentState === 'cancelled') && (
                <div className={`rounded-xl px-4 py-3 mb-4 text-sm ${paymentState === 'cancelled' ? 'bg-surface-600 text-ink-400' : 'bg-no/10 text-no border border-no/20'}`}>
                  {paymentState === 'cancelled' ? t('market.paymentCancelled') : errorMsg}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={isBusy}
                className="w-full btn-primary py-3.5 text-base font-black disabled:opacity-40 disabled:cursor-not-allowed gap-2"
              >
                {paymentState === 'creating' && (
                  <><span className="w-4 h-4 border-2 border-surface-900/30 border-t-surface-900 rounded-full animate-spin-slow" /> {t('market.creatingInvoice')}</>
                )}
                {paymentState === 'waiting' && (
                  <><span className="w-4 h-4 border-2 border-surface-900/30 border-t-surface-900 rounded-full animate-spin-slow" /> {t('market.waitingPayment')}</>
                )}
                {paymentState === 'verifying' && (
                  <><span className="w-4 h-4 border-2 border-surface-900/30 border-t-surface-900 rounded-full animate-spin-slow" /> {
                    paymentMethod === 'ticket' ? t('referral.usingTicket')
                    : t('payment.confirmingBalance')
                  }</>
                )}
                {(paymentState === 'idle' || paymentState === 'error' || paymentState === 'cancelled') && (
                  isFree ? (
                    <><Gift className="w-4 h-4" />{t('game.submitFree')}</>
                  ) : paymentMethod === 'ticket' ? (
                    <><Ticket className="w-4 h-4" />{t('referral.useTicket')} · {OPTION_LABELS[selectedOption]}</>
                  ) : (
                    <>
                      <GemIcon className="w-4 h-4" />
                      {t('game.submitAnswer', { stars: betAmount, option: OPTION_LABELS[selectedOption] })}
                    </>
                  )
                )}
              </button>
              <p className="text-center text-xs text-ink-700 mt-3">{t('market.poweredBy')}</p>
            </>
          )}
        </div>
      )}

      {/* Standard betting panel (non-quiz, revealed quiz, or free quiz) */}
      {token && market.status === 'open' && (!isQuiz || market.is_revealed || isFree) && (
        <div className="card">
          {isFree && isRegistered && paymentState !== 'success' ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-emerald-400 mb-1">{t('game.alreadyEntered')}</h3>
              <p className="text-sm text-ink-500">{t('game.alreadyEnteredHint')}</p>
            </div>
          ) : paymentState === 'success' ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-gold flex items-center justify-center mx-auto mb-4 shadow-glow-gold">
                <Zap className="w-8 h-8 text-surface-900" />
              </div>
              <h3 className="text-lg font-bold text-gradient-gold mb-1">{t('market.betPlaced')}</h3>
              <p className="text-sm text-ink-400 mb-1">
                {t('market.betDetails', { id: placedBetId, side: side.toUpperCase(), amount: betAmount })}
              </p>
              <button onClick={resetPayment} className="btn-primary text-sm px-6 py-2.5 mt-4">
                {t('market.placeAnother')}
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold text-ink-100 mb-5">
                {isQuiz ? t('game.pickAnswer') : t('market.placeABet')}
              </h2>

              {isQuiz && localizedOptions ? (
                <div className="grid gap-2.5 mb-5">
                  {localizedOptions.map((opt, idx) => {
                    const colors = OPTION_COLORS[idx] ?? OPTION_COLORS[0]
                    const isSelected = selectedOption === idx
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedOption(idx)}
                        disabled={isBusy}
                        className={`flex items-center gap-3 py-3 px-4 rounded-xl font-semibold text-sm border-2 transition-all duration-150 disabled:opacity-50 text-left ${
                          isSelected ? colors.active : colors.inactive
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                          isSelected ? 'bg-white/20' : 'bg-surface-700'
                        }`}>
                          {OPTION_LABELS[idx]}
                        </span>
                        {opt}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <button
                    onClick={() => setSelectedOption(0)}
                    disabled={isBusy}
                    className={`flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm border-2 transition-all duration-150 disabled:opacity-50 ${
                      selectedOption === 0
                        ? 'bg-yes/15 border-yes text-yes shadow-glow-yes'
                        : 'border-surface-600 text-ink-400 hover:border-yes/40 hover:text-yes/70 hover:bg-yes/5'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    YES · {yesPercent}%
                  </button>
                  <button
                    onClick={() => setSelectedOption(1)}
                    disabled={isBusy}
                    className={`flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm border-2 transition-all duration-150 disabled:opacity-50 ${
                      selectedOption === 1
                        ? 'bg-no/15 border-no text-no shadow-glow-no'
                        : 'border-surface-600 text-ink-400 hover:border-no/40 hover:text-no/70 hover:bg-no/5'
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    NO · {noPercent}%
                  </button>
                </div>
              )}

              {isFree ? (
                <div className="mb-4 flex items-center gap-2 rounded-xl px-4 py-3 bg-emerald-500/10 border border-emerald-500/30">
                  <Gift className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm font-bold text-emerald-400">{t('game.freeEntry')}</span>
                  <span className="text-xs text-ink-500 ml-auto flex items-center gap-0.5">0 <GemIcon className="w-3 h-3" /></span>
                </div>
              ) : (
                <div className="mb-4 flex items-center gap-3 py-3 px-4 rounded-xl bg-surface-700 border border-surface-600">
                  <Wallet className="w-4 h-4 text-ink-500 flex-shrink-0" />
                  <span className="text-sm font-semibold text-ink-300">{t('payment.withBalance')}</span>
                  <span className="ml-auto text-sm font-bold text-gold flex items-center gap-1">
                    <GemIcon className="w-3.5 h-3.5" />
                    {userBalance.toLocaleString()}
                  </span>
                </div>
              )}

              {!isFree && (
                <div className="bg-surface-700 border border-surface-600 rounded-xl p-4 mb-4 flex justify-between items-center">
                  <span className="text-xs text-ink-600 font-semibold uppercase tracking-wide">{t('market.amount')}</span>
                  <span className="text-sm font-black text-gold flex items-center gap-1.5">
                    <GemIcon className="w-3.5 h-3.5" />
                    {betAmount} · {t('game.fixed')}
                  </span>
                </div>
              )}

              {isQuiz && isDarkPool && (
                <div className="bg-surface-700 border border-surface-600 rounded-xl p-4 mb-4 flex justify-between items-center">
                  <span className="text-xs text-ink-600 font-semibold uppercase tracking-wide">{t('market.potentialPayoutLabel')}</span>
                  <span className="text-sm font-bold text-ink-500">{t('game.payoutRevealedAt55')}</span>
                </div>
              )}

              {(paymentState === 'error' || paymentState === 'cancelled') && (
                <div className={`rounded-xl px-4 py-3 mb-4 text-sm ${paymentState === 'cancelled' ? 'bg-surface-600 text-ink-400' : 'bg-no/10 text-no border border-no/20'}`}>
                  {paymentState === 'cancelled' ? t('market.paymentCancelled') : errorMsg}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={isBusy}
                className="w-full btn-primary py-3.5 text-base font-black disabled:opacity-40 disabled:cursor-not-allowed gap-2"
              >
                {paymentState === 'creating' && (
                  <><span className="w-4 h-4 border-2 border-surface-900/30 border-t-surface-900 rounded-full animate-spin-slow" /> {t('market.creatingInvoice')}</>
                )}
                {paymentState === 'waiting' && (
                  <><span className="w-4 h-4 border-2 border-surface-900/30 border-t-surface-900 rounded-full animate-spin-slow" /> {t('market.waitingPayment')}</>
                )}
                {paymentState === 'verifying' && (
                  <><span className="w-4 h-4 border-2 border-surface-900/30 border-t-surface-900 rounded-full animate-spin-slow" /> {t('payment.confirmingBalance')}</>
                )}
                {(paymentState === 'idle' || paymentState === 'error' || paymentState === 'cancelled') && (
                  isFree ? (
                    <><Gift className="w-4 h-4" />{t('game.submitFree')}</>
                  ) : (
                    <>
                      <GemIcon className="w-4 h-4" />
                      {isQuiz
                        ? t('game.submitAnswer', { stars: betAmount, option: OPTION_LABELS[selectedOption] })
                        : t('market.payButton', { stars: betAmount, side: side.toUpperCase() })
                      }
                    </>
                  )
                )}
              </button>

              <p className="text-center text-xs text-ink-700 mt-3">{t('market.poweredBy')}</p>
            </>
          )}
        </div>
      )}

      {/* Results leaderboard (resolved quiz markets) */}
      {isQuiz && (market.status === 'resolved' || market.status === 'cancelled') && results && (
        <ResultsLeaderboard results={results} localizedOptions={localizedOptions} t={t} />
      )}
    </div>
  )
}

function ResultsLeaderboard({
  results,
  localizedOptions,
  t,
}: {
  results: import('@/types').MarketResultsResponse
  localizedOptions: string[] | null
  t: ReturnType<typeof import('react-i18next').useTranslation>['t']
}) {
  const rankEmoji = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  return (
    <div className="card mt-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-black text-ink-100">{t('game.resultsTitle')}</h2>
        <span className="text-xs font-semibold text-ink-500">
          {t('game.resultsSubtitle', {
            count: results.total_participants,
            correct: results.correct_count,
          })}
        </span>
      </div>

      {results.your_rank && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-gold/10 border border-gold/30 text-sm font-bold text-gold">
          {t('game.yourRank', { rank: results.your_rank, total: results.total_participants })}
        </div>
      )}

      <div className="space-y-1.5 max-h-96 overflow-y-auto">
        {results.entries.map((entry: MarketResultEntry) => (
          <div
            key={`${entry.rank}-${entry.username}`}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
              entry.is_you
                ? 'bg-gold/10 border-gold/30'
                : entry.is_correct
                ? 'bg-emerald-500/5 border-emerald-500/15'
                : 'bg-surface-700 border-surface-600'
            }`}
          >
            <span className="text-sm font-black w-8 text-center flex-shrink-0">
              {rankEmoji(entry.rank)}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold truncate ${entry.is_you ? 'text-gold' : 'text-ink-200'}`}>
                {entry.username}{entry.is_you ? ' 👤' : ''}
              </p>
              <p className="text-xs text-ink-500">
                {OPTION_LABELS[entry.option_idx]}
                {localizedOptions?.[entry.option_idx]
                  ? `. ${localizedOptions[entry.option_idx].slice(0, 30)}${localizedOptions[entry.option_idx].length > 30 ? '…' : ''}`
                  : ''}
                {' · '}
                {formatElapsed(entry.elapsed_seconds)}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              {entry.is_correct ? (
                <p className="text-xs font-bold text-emerald-400">{t('game.correctBadge')}</p>
              ) : (
                <p className="text-xs font-bold text-no/70">{t('game.wrongBadge')}</p>
              )}
              {entry.prize > 0 && (
                <p className="text-xs font-black text-gold flex items-center gap-0.5 justify-end mt-0.5">
                  <GemIcon className="w-3 h-3" />{Number(entry.prize).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
