import { useQuery } from '@tanstack/react-query'
import { betsApi } from '@/api/bets'
import { authApi } from '@/api/auth'
import { useEffect } from 'react'
import { useAppDispatch } from '@/hooks/useStore'
import { setUser } from '@/store/slices/authSlice'
import { Wallet, TrendingUp, CheckCircle, XCircle, Clock, Ban } from 'lucide-react'
import type { Bet, BetStatus } from '@/types'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

const statusConfig: Record<
  BetStatus,
  { label: string; textClass: string; bgClass: string; Icon: React.ElementType }
> = {
  active: { label: 'Active', textClass: 'text-brand-cyan', bgClass: 'bg-brand-cyan/15', Icon: Clock },
  won: { label: 'Won', textClass: 'text-yes', bgClass: 'bg-yes/15', Icon: CheckCircle },
  lost: { label: 'Lost', textClass: 'text-no', bgClass: 'bg-no/15', Icon: XCircle },
  cancelled: { label: 'Cancelled', textClass: 'text-ink-600', bgClass: 'bg-surface-700', Icon: Ban },
}

function buildPnlSeries(bets: Bet[]) {
  const sorted = [...bets].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
  let running = 0
  return sorted.map((bet) => {
    const delta =
      bet.status === 'won'
        ? (bet.actual_payout ?? bet.potential_payout) - bet.amount
        : bet.status === 'lost'
          ? -bet.amount
          : 0
    running += delta
    return {
      date: new Date(bet.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      pnl: parseFloat(running.toFixed(2)),
    }
  })
}

function buildOutcomePie(bets: Bet[]) {
  const counts: Record<BetStatus, number> = { won: 0, lost: 0, active: 0, cancelled: 0 }
  bets.forEach((b) => counts[b.status]++)
  return [
    { name: 'Won', value: counts.won, color: '#10b981' },
    { name: 'Lost', value: counts.lost, color: '#ef4444' },
    { name: 'Active', value: counts.active, color: '#00c8ff' },
    { name: 'Cancelled', value: counts.cancelled, color: '#2a3550' },
  ].filter((d) => d.value > 0)
}

const tooltipStyle = {
  backgroundColor: '#0d1424',
  border: '1px solid #1a2540',
  borderRadius: '0.75rem',
  color: '#f0f4ff',
  fontSize: '0.8125rem',
}

export default function PortfolioPage() {
  const dispatch = useAppDispatch()

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: authApi.me })
  const { data: bets, isLoading } = useQuery({
    queryKey: ['my-bets'],
    queryFn: () => betsApi.myBets({ limit: 50 }),
  })

  useEffect(() => {
    if (user) dispatch(setUser(user))
  }, [user, dispatch])

  const wonBets = bets?.filter((b) => b.status === 'won').length ?? 0
  const winRate = bets?.length ? Math.round((wonBets / bets.length) * 100) : 0
  const totalWagered = bets?.reduce((s, b) => s + Number(b.amount), 0) ?? 0

  const pnlSeries = bets?.length ? buildPnlSeries(bets) : []
  const outcomePie = bets?.length ? buildOutcomePie(bets) : []
  const totalPnl = pnlSeries[pnlSeries.length - 1]?.pnl ?? 0
  const pnlPositive = totalPnl >= 0

  return (
    <div className="animate-slide-up">
      <h1 className="text-3xl font-black text-ink-100 mb-8">Portfolio</h1>

      {/* Stats */}
      {user && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Balance', value: `₮${Number(user.balance).toLocaleString()}`, Icon: Wallet, color: 'text-brand-cyan' },
            { label: 'Total Wagered', value: `₮${totalWagered.toLocaleString()}`, Icon: TrendingUp, color: 'text-ink-200' },
            { label: 'Total Bets', value: String(bets?.length ?? 0), Icon: Clock, color: 'text-ink-200' },
            { label: 'Win Rate', value: `${winRate}%`, Icon: CheckCircle, color: winRate >= 50 ? 'text-yes' : 'text-ink-200' },
          ].map(({ label, value, Icon, color }) => (
            <div key={label} className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-xs text-ink-600 font-semibold uppercase tracking-widest">
                  {label}
                </span>
              </div>
              <p className={`text-2xl font-black ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      {bets && bets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
          {/* P&L Area Chart */}
          <div className="card p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs text-ink-600 font-semibold uppercase tracking-widest mb-1">
                  Cumulative P&amp;L
                </p>
                <p className={`text-2xl font-black ${pnlPositive ? 'text-yes' : 'text-no'}`}>
                  {pnlPositive ? '+' : ''}₮{totalPnl.toFixed(2)}
                </p>
              </div>
              <span
                className={`badge border text-xs ${
                  pnlPositive
                    ? 'bg-yes/20 text-yes border-yes/30'
                    : 'bg-no/20 text-no border-no/30'
                }`}
              >
                {pnlPositive ? '▲' : '▼'} All time
              </span>
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={pnlSeries} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={pnlPositive ? '#10b981' : '#ef4444'}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={pnlPositive ? '#10b981' : '#ef4444'}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#4a5a7a', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#4a5a7a', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₮${v}`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ stroke: '#243556', strokeWidth: 1 }}
                  formatter={(v: number) => [`₮${v.toFixed(2)}`, 'P&L']}
                />
                <Area
                  type="monotone"
                  dataKey="pnl"
                  stroke={pnlPositive ? '#10b981' : '#ef4444'}
                  strokeWidth={2}
                  fill="url(#pnlGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: pnlPositive ? '#10b981' : '#ef4444', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Outcome Donut */}
          <div className="card p-6 flex flex-col">
            <p className="text-xs text-ink-600 font-semibold uppercase tracking-widest mb-6">
              Outcomes
            </p>
            <div className="flex-1 flex items-center justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={outcomePie}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {outcomePie.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number, name: string) => [v, name]}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => (
                      <span style={{ color: '#8a9cc0', fontSize: '0.75rem' }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Bet History */}
      <p className="text-xs font-semibold text-ink-600 uppercase tracking-widest mb-4">
        Bet History
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 h-16 animate-pulse" />
          ))}
        </div>
      ) : !bets?.length ? (
        <div className="card p-12 text-center">
          <TrendingUp className="w-12 h-12 text-ink-800 mx-auto mb-4" />
          <p className="text-ink-400 font-semibold">No bets yet</p>
          <p className="text-ink-600 text-sm mt-1">Browse markets to start trading</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bets.map((bet) => {
            const cfg = statusConfig[bet.status] ?? statusConfig.active
            const { Icon } = cfg
            return (
              <div key={bet.id} className="card card-hover p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bgClass}`}>
                    <Icon className={`w-4 h-4 ${cfg.textClass}`} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink-100">
                      <span className={bet.side === 'yes' ? 'text-yes' : 'text-no'}>
                        {bet.side.toUpperCase()}
                      </span>{' '}
                      · Market #{bet.market_id}
                    </p>
                    <p className={`text-xs font-semibold mt-0.5 ${cfg.textClass}`}>{cfg.label}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-ink-100">
                    ₮{Number(bet.amount).toLocaleString()}
                  </p>
                  <p className="text-xs text-ink-600 mt-0.5">
                    → ₮{Number(bet.potential_payout).toFixed(2)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
