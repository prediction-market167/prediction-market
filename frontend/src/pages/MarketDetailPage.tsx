import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { marketsApi } from '@/api/markets'
import { betsApi } from '@/api/bets'
import { useAppSelector } from '@/hooks/useStore'
import { TrendingUp, Clock, CheckCircle, XCircle, Users } from 'lucide-react'

export default function MarketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const token = useAppSelector((s) => s.auth.token)

  const [side, setSide] = useState<'yes' | 'no'>('yes')
  const [amount, setAmount] = useState('')

  const { data: market, isLoading } = useQuery({
    queryKey: ['market', id],
    queryFn: () => marketsApi.get(Number(id)),
  })

  const { mutate: placeBet, isPending } = useMutation({
    mutationFn: () =>
      betsApi.place({ market_id: Number(id), side, amount: parseFloat(amount) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market', id] })
      setAmount('')
    },
  })

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-cyan border-t-transparent rounded-full animate-spin-slow" />
      </div>
    )

  if (!market)
    return (
      <div className="text-center py-24">
        <p className="text-no font-semibold">Market not found</p>
      </div>
    )

  const yesPercent = Math.round(market.yes_probability * 100)
  const noPercent = 100 - yesPercent
  const amountNum = parseFloat(amount)
  const prob = side === 'yes' ? market.yes_probability : 1 - market.yes_probability
  const potentialPayout =
    amount && amountNum > 0 && prob > 0
      ? (amountNum / prob).toFixed(2)
      : '—'

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

        <h1 className="text-2xl font-black text-ink-100 leading-tight mb-3">
          {market.title}
        </h1>
        <p className="text-sm text-ink-400 leading-relaxed mb-8">{market.description}</p>

        {/* Probability */}
        <div className="mb-8">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-5xl font-black text-yes tabular-nums">{yesPercent}%</p>
              <p className="text-xs text-ink-600 font-semibold uppercase tracking-wider mt-1">
                chance YES
              </p>
            </div>
            <div className="text-right">
              <p className="text-5xl font-black text-no tabular-nums">{noPercent}%</p>
              <p className="text-xs text-ink-600 font-semibold uppercase tracking-wider mt-1">
                chance NO
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

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              icon: TrendingUp,
              label: 'Volume',
              value: `₮${Number(market.total_volume).toLocaleString()}`,
            },
            {
              icon: Clock,
              label: 'Closes',
              value: new Date(market.close_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }),
            },
            {
              icon: Users,
              label: 'Status',
              value: market.status.charAt(0).toUpperCase() + market.status.slice(1),
            },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-surface-700 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className="w-3.5 h-3.5 text-ink-600" />
                <span className="text-xs text-ink-600 font-semibold uppercase tracking-wide">
                  {label}
                </span>
              </div>
              <p className="text-sm font-bold text-ink-100">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Betting panel */}
      {token && market.status === 'open' && (
        <div className="card p-6">
          <h2 className="text-lg font-bold text-ink-100 mb-5">Place a Bet</h2>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <button
              onClick={() => setSide('yes')}
              className={`flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm border-2 transition-all duration-150 ${
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
              className={`flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm border-2 transition-all duration-150 ${
                side === 'no'
                  ? 'bg-no/15 border-no text-no shadow-glow-no'
                  : 'border-surface-600 text-ink-400 hover:border-no/40 hover:text-no/70 hover:bg-no/5'
              }`}
            >
              <XCircle className="w-4 h-4" />
              NO · {noPercent}%
            </button>
          </div>

          <div className="mb-4">
            <label className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2 block">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 font-semibold text-sm pointer-events-none">
                ₮
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                className="input-dark pl-8"
              />
            </div>
          </div>

          <div className="bg-surface-700 rounded-xl p-4 mb-5 flex justify-between items-center">
            <span className="text-xs text-ink-600 font-semibold uppercase tracking-wide">
              Potential payout
            </span>
            <span className="text-sm font-black text-yes">₮{potentialPayout}</span>
          </div>

          <button
            onClick={() => placeBet()}
            disabled={isPending || !amount || amountNum <= 0}
            className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] ${
              side === 'yes'
                ? 'bg-yes hover:bg-yes-dark text-white shadow-glow-yes'
                : 'bg-no hover:bg-no-dark text-white shadow-glow-no'
            }`}
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
                Submitting...
              </span>
            ) : (
              `Buy ${side.toUpperCase()} · ${side === 'yes' ? yesPercent : noPercent}%`
            )}
          </button>
        </div>
      )}

      {!token && (
        <div className="card border-gradient p-6 text-center">
          <p className="text-ink-400 mb-4 text-sm">Sign in to trade on this market</p>
          <Link to="/login" className="btn-primary px-6 py-2.5 shadow-glow-cyan">
            Log In to Trade
          </Link>
        </div>
      )}
    </div>
  )
}
