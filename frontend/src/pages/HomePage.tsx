import { Link } from 'react-router-dom'
import { TrendingUp, Zap, Shield, ArrowRight } from 'lucide-react'

const STATS = [
  { label: 'Active Markets', value: '1,200+' },
  { label: 'Total Volume', value: '₮48M' },
  { label: 'Traders', value: '32K' },
  { label: 'Avg. ROI', value: '+22%' },
]

const FEATURES = [
  {
    icon: TrendingUp,
    title: 'Real-time Odds',
    desc: 'Live probability updates as markets move. Always know your edge before you trade.',
  },
  {
    icon: Zap,
    title: 'Instant Settlement',
    desc: 'Winnings credited the moment outcomes resolve. Zero delays, zero friction.',
  },
  {
    icon: Shield,
    title: 'Fully Transparent',
    desc: 'Every position verifiable. No hidden fees, no manipulation, no surprises.',
  },
]

export default function HomePage() {
  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <div className="text-center pt-16 pb-20 relative">
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand-cyan/8 rounded-full blur-[120px]" />
          <div className="absolute top-10 left-1/2 translate-x-8 w-[400px] h-[300px] bg-brand-purple/8 rounded-full blur-[100px]" />
        </div>

        <div className="inline-flex items-center gap-2 bg-surface-700 border border-surface-500 text-xs text-brand-cyan font-semibold px-3 py-1.5 rounded-full mb-8">
          <span className="w-1.5 h-1.5 bg-yes rounded-full animate-pulse" />
          Markets are live
        </div>

        <h1 className="text-6xl sm:text-7xl font-black tracking-tight leading-none mb-6">
          <span className="text-ink-100">Predict.</span>
          <br />
          <span className="text-gradient">Trade. Win.</span>
        </h1>

        <p className="text-lg text-ink-400 max-w-md mx-auto mb-10 leading-relaxed">
          The most accurate prediction market. Trade on politics, sports, crypto, and global events.
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            to="/markets"
            className="btn-primary gap-2 text-base px-7 py-3.5 shadow-glow-cyan"
          >
            Explore Markets
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/register"
            className="flex items-center gap-2 text-sm font-semibold px-7 py-3.5 rounded-xl border border-surface-500 text-ink-200 hover:border-brand-cyan/60 hover:text-brand-cyan transition-all duration-200"
          >
            Create Account
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-20">
        {STATS.map((stat) => (
          <div key={stat.label} className="card p-5 text-center">
            <p className="text-3xl font-black text-ink-100">{stat.value}</p>
            <p className="text-xs text-ink-600 mt-1.5 font-semibold uppercase tracking-widest">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="card card-hover p-6 group">
            <div className="w-11 h-11 bg-gradient-brand rounded-xl flex items-center justify-center mb-5 shadow-glow-cyan group-hover:shadow-glow-cyan transition-shadow duration-300">
              <Icon className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-bold text-ink-100 mb-2 text-base">{title}</h3>
            <p className="text-sm text-ink-400 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
