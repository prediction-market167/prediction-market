import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react'
import { marketsApi } from '@/api/markets'
import paymentsApi from '@/api/payments'
import { useAppSelector } from '@/hooks/useStore'
import { TrendingUp, Clock, CheckCircle, XCircle, Users, Star, Trophy, Wallet } from 'lucide-react'

type PaymentState = 'idle' | 'creating' | 'waiting' | 'verifying' | 'success' | 'cancelled' | 'error'

const POLL_INTERVAL_MS = 1500
const POLL_MAX_ATTEMPTS = 20
const MIN_PARTICIPANTS = 20
const BET_AMOUNT = 100

function TonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2.5 8.5L12 22L21.5 8.5L12 2Z" />
      <path d="M2.5 8.5L12 14L21.5 8.5" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" fill="none" />
    </svg>
  )
}

export default function MarketDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const token = useAppSelector((s) => s.auth.token)
  const walletAddress = useTonAddress()
  const [tonConnectUI] = useTonConnectUI()

  const [side, setSide] = useState<'yes' | 'no'>('yes')
  const [paymentState, setPaymentState] = useState<PaymentState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [placedBetId, setPlacedBetId] = useState<number | null>(null)

  const { data: market, isLoading } = useQuery({
    queryKey: ['market', id],
    queryFn: () => marketsApi.get(Number(id)),
    refetchInterval: 10_000,
  })

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
      } catch {
        // keep polling
      }
    }
    setErrorMsg(t('market.errors.timeout'))
    setPaymentState('error')
  }, [id, queryClient, t])

  const handlePlaceBet = useCallback(async () => {
    setErrorMsg('')
    setPaymentState('creating')

    let invoice: Awaited<ReturnType<typeof paymentsApi.createStarsInvoice>>
    try {
      invoice = await paymentsApi.createStarsInvoice(Number(id), side, BET_AMOUNT)
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
  const prob = side === 'yes' ? market.yes_probability : 1 - market.yes_probability
  const potentialPayout = prob > 0 ? (BET_AMOUNT / prob).toFixed(2) : '—'

  const isBusy = paymentState === 'creating' || paymentState === 'waiting' || paymentState === 'verifying'

  const participantCount = market.participant_count ?? 0
  const isPoolActive = participantCount >= MIN_PARTICIPANTS
  const progress = Math.min(participantCount / MIN_PARTICIPANTS, 1)

  return (
    <div className="max-w-2xl mx-auto animate-slide-up">
      {/* Market info */}
      <div className="card p-6 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="badge bg-yes/20 text-yes border border-yes/30">
            {market.status.toUpperCase()}
          </span>
          <span className="text-xs text-ink-600 font-medium">{market.category}</span>
        </div>

        <h1 className="text-2xl font-black text-ink-100 leading-tight mb-3">{market.title}</h1>
        <p className="text-sm text-ink-400 leading-relaxed mb-8">{market.description}</p>

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

        {/* Participant count — only shown while market is open */}
        {market.status === 'open' && (
          <div className={`mb-6 rounded-xl p-4 border transition-all duration-500 ${
            isPoolActive
              ? 'bg-yes/10 border-yes/30'
              : 'bg-surface-700 border-surface-600'
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
                    <span className="text-sm font-semibold text-ink-300">
                      {t('market.poolProgress')}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-ink-100 tabular-nums">
                    {participantCount}
                    <span className="text-ink-500 font-normal"> / {MIN_PARTICIPANTS}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-600 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-cyan transition-all duration-700 ease-out"
                    style={{ width: `${progress * 100}%` }}
                  />
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
            { icon: Users, label: t('market.players'), value: `${participantCount}${isPoolActive ? ' ✓' : ''}` },
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

      {/* Logged in but no TON wallet */}
      {token && !walletAddress && market.status === 'open' && (
        <div className="card border-gradient p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-brand-cyan/15 flex items-center justify-center mx-auto mb-4">
            <TonIcon className="w-6 h-6 text-brand-cyan" />
          </div>
          <h3 className="text-base font-bold text-ink-100 mb-1">Connect TON Wallet to Bet</h3>
          <p className="text-sm text-ink-400 mb-5">
            A connected TON wallet is required to place bets. Stars are backed by real TON payments.
          </p>
          <button
            onClick={() => tonConnectUI.openModal()}
            className="btn-primary px-6 py-2.5 shadow-glow-cyan flex items-center gap-2 mx-auto"
          >
            <TonIcon className="w-4 h-4" />
            Connect TON Wallet
          </button>
        </div>
      )}

      {/* Betting panel */}
      {token && walletAddress && market.status === 'open' && (
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
              <p className="text-xs text-ink-600 mb-6">
                {t('market.potentialPayoutValue', { payout: potentialPayout })}
              </p>
              <button onClick={resetPayment} className="btn-primary text-sm px-6 py-2.5">
                {t('market.placeAnother')}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-ink-100">{t('market.placeABet')}</h2>
                <div className="flex items-center gap-1.5 text-xs text-ink-600">
                  <Wallet className="w-3 h-3 text-brand-cyan" />
                  <span className="font-mono text-brand-cyan">{walletAddress.slice(0, 4)}…{walletAddress.slice(-4)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <button
                  onClick={() => setSide('yes')}
                  disabled={isBusy}
                  className={`flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm border-2 transition-all duration-150 disabled:opacity-50 ${
                    side === 'yes'
                      ? 'bg-yes/15 border-yes text-yes shadow-glow-yes'
                      : 'border-surface-600 text-ink-400 hover:border-yes/40 hover:text-yes/70 hover:bg-yes/5'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  YES · {yesPercent}%
                </button>
                <button
                  onClick={() => setSide('no')}
                  disabled={isBusy}
                  className={`flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm border-2 transition-all duration-150 disabled:opacity-50 ${
                    side === 'no'
                      ? 'bg-no/15 border-no text-no shadow-glow-no'
                      : 'border-surface-600 text-ink-400 hover:border-no/40 hover:text-no/70 hover:bg-no/5'
                  }`}
                >
                  <XCircle className="w-4 h-4" />
                  NO · {noPercent}%
                </button>
              </div>

              {/* Fixed bet amount display */}
              <div className="bg-surface-700 rounded-xl p-4 mb-4 flex justify-between items-center">
                <span className="text-xs text-ink-600 font-semibold uppercase tracking-wide">
                  {t('market.amount')}
                </span>
                <span className="text-sm font-black text-ink-100 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                  {BET_AMOUNT} ⭐ · fixed
                </span>
              </div>

              <div className="bg-surface-700 rounded-xl p-4 mb-5 flex justify-between items-center">
                <span className="text-xs text-ink-600 font-semibold uppercase tracking-wide">
                  {t('market.potentialPayoutLabel')}
                </span>
                <span className="text-sm font-black text-yes">{potentialPayout} ⭐</span>
              </div>

              {(paymentState === 'error' || paymentState === 'cancelled') && (
                <div className={`rounded-xl px-4 py-3 mb-4 text-sm ${paymentState === 'cancelled' ? 'bg-surface-600 text-ink-400' : 'bg-no/10 text-no border border-no/20'}`}>
                  {paymentState === 'cancelled' ? t('market.paymentCancelled') : errorMsg}
                </div>
              )}

              <button
                onClick={handlePlaceBet}
                disabled={isBusy}
                className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2 ${
                  side === 'yes'
                    ? 'bg-yes hover:bg-yes-dark text-white shadow-glow-yes'
                    : 'bg-no hover:bg-no-dark text-white shadow-glow-no'
                }`}
              >
                {paymentState === 'creating' && (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" /> {t('market.creatingInvoice')}</>
                )}
                {paymentState === 'waiting' && (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" /> {t('market.waitingPayment')}</>
                )}
                {paymentState === 'verifying' && (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" /> {t('market.confirmingBet')}</>
                )}
                {(paymentState === 'idle' || paymentState === 'error' || paymentState === 'cancelled') && (
                  <><Star className="w-4 h-4 fill-yellow-400 text-yellow-400" /> {t('market.payButton', { stars: BET_AMOUNT, side: side.toUpperCase() })}</>
                )}
              </button>

              <p className="text-center text-xs text-ink-700 mt-3">
                {t('market.poweredBy')}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
