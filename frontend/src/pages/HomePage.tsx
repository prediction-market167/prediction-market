import { Link } from 'react-router-dom'
import { Zap, Shield, ArrowRight, Brain } from 'lucide-react'

const STATS = [
  { label: 'Active Contests', value: '1,200+' },
  { label: 'Total Prizes', value: '$48M' },
  { label: 'Players', value: '32K' },
  { label: 'Avg. Win Rate', value: '+22%' },
]

const FEATURES = [
  {
    icon: Brain,
    title: 'Test Your Knowledge',
    desc: 'Compete on real-world events across politics, sports, crypto, and more. The sharper your instincts, the bigger your rewards.',
  },
  {
    icon: Zap,
    title: 'Instant Results',
    desc: 'Prizes credited the moment contests resolve. No waiting, no friction — just win and collect.',
  },
  {
    icon: Shield,
    title: 'Fair & Transparent',
    desc: 'Every contest is verifiable on-chain. No hidden fees, no manipulation, no surprises.',
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
          Contests are live
        </div>

        <h1 className="text-6xl sm:text-7xl font-black tracking-tight leading-none mb-6">
          <span className="text-ink-100">Predict.</span>
          <br />
          <span className="text-gradient">Compete. Win.</span>
        </h1>

        <p className="text-lg text-ink-400 max-w-md mx-auto mb-10 leading-relaxed">
          The ultimate quiz competition platform. Answer questions, outsmart the crowd, and take home real prizes.
        </p>

        <Link
          to="/markets"
          className="btn-primary gap-2 text-base px-7 py-3.5 shadow-glow-cyan"
        >
          Join Contest
          <ArrowRight className="w-4 h-4" />
        </Link>
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
