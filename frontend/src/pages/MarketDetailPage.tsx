import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { marketsApi } from '@/api/markets'
import paymentsApi from '@/api/payments'
import { betsApi } from '@/api/bets'
import { authApi } from '@/api/auth'
import { useAppSelector } from '@/hooks/useStore'
import {
  TrendingUp, Clock, CheckCircle, XCircle, Users, Star, Trophy,
  Eye, EyeOff, Loader2, Wallet, Gift,
} from 'lucide-react'
import type { BetSide } from '@/types'
import Confetti from '@/components/common/Confetti'

type PaymentState = 'idle' | 'creating' | 'waiting' | 'verifying' | 'success' | 'cancelled' | 'error'
type PaymentMethod = 'balance' | 'stars'

const POLL_INTERVAL_MS = 1500
const POLL_MAX_ATTEMPTS = 20
const MIN_PARTICIPANTS = 20
const BET_AMOUNT = 100

const OPTION_TO_SIDE: BetSide[] = ['yes', 'no', 'opt2', 'opt3']

const OPTION_COLORS = [
  { active: 'bg-emerald-500/15 border-emerald-500 text-emerald-400 shadow-glow-yes', inactive: 'border-surface-600 text-ink-400 hover:border-emerald-500/40 hover:text-emerald-400/70' },
  { active: 'bg-rose-500/15 border-rose-500 text-rose-400 shadow-glow-no', inactive: 'border-surface-600 text-ink-400 hover:border-rose-500/40 hover:text-rose-400/70' },
  { active: 'bg-brand-purple/15 border-brand-purple text-brand-purple', inactive: 'border-surface-600 text-ink-400 hover:border-brand-purple/40' },
  { active: 'bg-amber-500/15 border-amber-500 text-amber-400', inactive: 'border-surface-600 text-ink-400 hover:border-amber-500/40' },
]

const OPTION_LABELS = ['A', 'B', 'C', 'D']

export default function MarketDetailPage() {
  const { t, i18n } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const token = useAppSelector((s) => s.auth.token)

  const [selectedOption, setSelectedOption] = useState<number>(0)
  const [paymentState, setPaymentState] = useState<PaymentState>('idle')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('stars')
  const [errorMsg, setErrorMsg] = useState('')
  const [placedBetId, setPlacedBetId] = useState<number | null>(null)

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

  const userBalance = Number(me?.balance ?? 0)
  const canPayBalance = userBalance >= BET_AMOUNT

  const isQuiz = !!market?.tier
  const isFree = market?.tier === 'free'
  const betAmount = isFree ? 0 : 100
  const isDarkPool = isQuiz && market?.status === 'open' && !market?.is_revealed

  const lang = i18n.language.split('-')[0]
  const localizedOptions = useMemo(() => {
    if (!market?.options) return null
    const opts = market.options
    return (lang === 'ru' ? opts.ru : lang === 'hi' ? opts.hi : opts.en) || opts.en || []
  }, [market?.options, lang])

  const localizedTitle = useMemo(() => {
    if (!market) return ''
    if (!isQuiz) return market.title
    return (lang === 'ru' ? market.title_ru : lang === 'hi' ? market.title_hi : market.title_en) || market.title_en || market.title
  }, [market, isQuiz, lang])

  const side = OPTION_TO_SIDE[selectedOption] ?? 'yes'

  const pollVerify = useCallback(async (payment_id: number) => {
    setPaymentState('verifying')
    for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
      try {
        const result = await paymentsApi.verifyStars(payment_id)
        if (result.status === 'paid' && result.bet_id) {
          setPlacedBetId(result.bet_id)
          setPaymentState('success')
          queryClient.invalidateQueries({ queryKey: ['market', id] })
          queryClient.invalidateQueries({ queryKey: ['my-bets'] })
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
      setPlacedBetId(bet.id)
      setPaymentState('success')
      queryClient.invalidateQueries({ queryKey: ['market', id] })
      queryClient.invalidateQueries({ queryKey: ['my-bets'] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.detail ?? t('market.errors.betFailed'))
      setPaymentState('error')
    }
  }, [id, side, queryClient, t])

  const handleSubmit = isFree || paymentMethod === 'balance' ? handleBalanceBet : handleStarsBet

  const resetPayment = () => {
    setPaymentState('idle')
    setErrorMsg('')
    setPlacedBetId(null)
  }

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-cyan border-t-transparent rounded-full animate-spin-slow" />
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
      {/* Market info */}
      <div className="card p-6 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="badge bg-yes/20 text-yes border border-yes/30">
            {market.status.toUpperCase()}
          </span>
          {market.tier && (
            <span className="badge bg-surface-700 text-ink-400 border border-surface-600">
              {market.tier.toUpperCase()}
            </span>
          )}
          <span className="text-xs text-ink-600 font-medium">{market.category}</span>
        </div>

        <h1 className="text-2xl font-black text-ink-100 leading-tight mb-3">{localizedTitle}</h1>
        {market.description && (
          <p className="text-sm text-ink-400 leading-relaxed mb-6">{market.description}</p>
        )}

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
              market.pool_status === 'threshold_met' ? 'text-emerald-400' : 'text-amber-400'
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

        {market.status === 'open' && !isDarkPool && (
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
                  <div className="h-full rounded-full bg-brand-cyan transition-all duration-700 ease-out" style={{ width: `${progress * 100}%` }} />
                </div>
                <p className="text-xs text-ink-600 mt-2">
                  {t('market.poolNeeded', { count: MIN_PARTICIPANTS - participantCount })}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: TrendingUp, label: t('market.volume'), value: `⭐${Number(market.total_volume).toLocaleString()}` },
            { icon: Clock, label: t('market.closes'), value: new Date(market.close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
            { icon: Users, label: t('market.players'), value: isDarkPool ? '—' : `${participantCount}${isPoolActive ? ' ✓' : ''}` },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-surface-700 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className="w-3.5 h-3.5 text-ink-600" />
                <span className="text-xs text-ink-600 font-semibold uppercase tracking-wide">{label}</span>
              </div>
              <p className="text-sm font-bold text-ink-100">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Not logged in */}
      {!token && (
        <div className="card border-gradient p-6 text-center">
          <p className="text-ink-400 mb-4 text-sm">{t('market.signInToTrade')}</p>
          <Link to="/login" className="btn-primary px-6 py-2.5 shadow-glow-cyan">
            {t('market.loginToTrade')}
          </Link>
        </div>
      )}

      {/* Betting panel */}
      {token && market.status === 'open' && (
        <div className="card p-6">
          {paymentState === 'success' ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-yes/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-yes" />
              </div>
              <h3 className="text-lg font-bold text-ink-100 mb-1">{t('market.betPlaced')}</h3>
              <p className="text-sm text-ink-400 mb-1">
                {t('market.betDetails', { id: placedBetId, side: side.toUpperCase(), amount: BET_AMOUNT })}
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

              {/* Quiz option buttons OR yes/no buttons */}
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

              {/* Payment method selector — hidden for free tier */}
              {isFree ? (
                <div className="mb-4 flex items-center gap-2 rounded-xl px-4 py-3 bg-emerald-500/10 border border-emerald-500/30">
                  <Gift className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm font-bold text-emerald-400">{t('game.freeEntry')}</span>
                  <span className="text-xs text-ink-500 ml-auto">0 ⭐</span>
                </div>
              ) : (
                <div className="mb-4">
                  <p className="text-xs text-ink-600 font-semibold uppercase tracking-wide mb-2">
                    {t('payment.chooseMethod')}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPaymentMethod('balance')}
                      disabled={isBusy || !canPayBalance}
                      className={`py-2.5 px-3 rounded-xl text-sm font-semibold border-2 transition-all text-left disabled:opacity-40 ${
                        paymentMethod === 'balance'
                          ? 'bg-brand-cyan/10 border-brand-cyan/50 text-brand-cyan'
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
                      onClick={() => setPaymentMethod('stars')}
                      disabled={isBusy}
                      className={`py-2.5 px-3 rounded-xl text-sm font-semibold border-2 transition-all text-left disabled:opacity-40 ${
                        paymentMethod === 'stars'
                          ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400'
                          : 'border-surface-600 text-ink-400 hover:border-surface-500'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Star className="w-3.5 h-3.5" />
                        {t('payment.withStars')}
                      </div>
                      <p className="text-xs font-normal opacity-70">Telegram Stars</p>
                    </button>
                  </div>
                  {paymentMethod === 'balance' && !canPayBalance && (
                    <p className="text-xs text-no mt-1.5">{t('payment.insufficientBalance')}</p>
                  )}
                </div>
              )}

              {/* Fixed bet amount — hidden for free tier (shown in free entry badge above) */}
              {!isFree && (
                <div className="bg-surface-700 rounded-xl p-4 mb-4 flex justify-between items-center">
                  <span className="text-xs text-ink-600 font-semibold uppercase tracking-wide">{t('market.amount')}</span>
                  <span className="text-sm font-black text-ink-100 flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                    {betAmount} ⭐ · {t('game.fixed')}
                  </span>
                </div>
              )}

              {isQuiz && isDarkPool && (
                <div className="bg-surface-700 rounded-xl p-4 mb-4 flex justify-between items-center">
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
                disabled={isBusy || (!isFree && paymentMethod === 'balance' && !canPayBalance)}
                className="w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2 bg-brand-cyan hover:bg-brand-cyan/90 text-white shadow-glow-cyan"
              >
                {paymentState === 'creating' && (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" /> {t('market.creatingInvoice')}</>
                )}
                {paymentState === 'waiting' && (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" /> {t('market.waitingPayment')}</>
                )}
                {paymentState === 'verifying' && (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" /> {isFree || paymentMethod === 'balance' ? t('payment.confirmingBalance') : t('market.confirmingBet')}</>
                )}
                {(paymentState === 'idle' || paymentState === 'error' || paymentState === 'cancelled') && (
                  isFree ? (
                    <><Gift className="w-4 h-4" />{t('game.submitFree')}</>
                  ) : (
                    <>
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
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
    </div>
  )
}
