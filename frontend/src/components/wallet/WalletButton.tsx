import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Copy, LogOut, ArrowDownToLine, Check, ChevronDown, X } from 'lucide-react'
import { useTonWallet } from '@/hooks/useTonWallet'
import { usersApi } from '@/api/users'
import { useAppSelector } from '@/hooks/useStore'

function TonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2.5 8.5L12 22L21.5 8.5L12 2Z" />
      <path d="M2.5 8.5L12 14L21.5 8.5" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" fill="none" />
    </svg>
  )
}

function truncate(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

function DepositModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['deposit-address'],
    queryFn: usersApi.depositAddress,
  })

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card border-gradient w-full max-w-sm p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <TonIcon className="w-5 h-5 text-brand-cyan" />
            <h2 className="text-lg font-black text-ink-100">Deposit TON</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-600 hover:text-ink-100 hover:bg-surface-700 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-brand-cyan border-t-transparent rounded-full animate-spin-slow" />
          </div>
        )}

        {error && (
          <p className="text-no text-sm text-center py-4">Deposits not configured yet.</p>
        )}

        {data && (
          <div className="space-y-4">
            <div className="bg-surface-700 rounded-xl p-4">
              <p className="text-xs text-ink-600 font-semibold uppercase tracking-widest mb-2">
                Send TON to this address
              </p>
              <p className="text-sm font-mono text-ink-100 break-all leading-relaxed">
                {data.address}
              </p>
              <button
                onClick={() => copy(data.address)}
                className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-brand-cyan hover:text-white transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy address'}
              </button>
            </div>

            <div className="bg-surface-700 rounded-xl p-4">
              <p className="text-xs text-ink-600 font-semibold uppercase tracking-widest mb-1">
                Memo / Comment (required)
              </p>
              <p className="text-sm font-mono text-yes font-bold">{data.memo}</p>
              <p className="text-xs text-ink-600 mt-1">
                Include this memo so we can credit your account.
              </p>
            </div>

            <div className="bg-brand-cyan/10 border border-brand-cyan/20 rounded-xl p-3">
              <p className="text-xs text-ink-400 leading-relaxed">
                Rate: <strong className="text-ink-100">1 TON = ${data.amount_per_credit}</strong>
                {' '}· Balance updates within ~30 seconds after the transaction confirms.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function WalletButton() {
  const { address, connect, disconnect } = useTonWallet()
  const token = useAppSelector((s) => s.auth.token)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showDeposit, setShowDeposit] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Only render when the user is logged in
  if (!token) return null

  const copyAddress = () => {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!address) {
    return (
      <button
        onClick={connect}
        className="flex items-center gap-1.5 bg-surface-700 border border-surface-600 hover:border-brand-cyan/50 text-ink-400 hover:text-brand-cyan px-3 py-1.5 rounded-xl text-sm font-semibold transition-all duration-150"
      >
        <TonIcon className="w-3.5 h-3.5" />
        Connect
      </button>
    )
  }

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan px-3 py-1.5 rounded-xl text-sm font-semibold transition-all duration-150 hover:bg-brand-cyan/20"
        >
          <TonIcon className="w-3.5 h-3.5" />
          {truncate(address)}
          <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-48 card shadow-card-hover z-50 py-1.5 animate-fade-in">
            <button
              onClick={copyAddress}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-400 hover:text-ink-100 hover:bg-surface-700 transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-yes" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copied ? 'Copied!' : 'Copy address'}
            </button>
            <button
              onClick={() => { setShowDeposit(true); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-400 hover:text-ink-100 hover:bg-surface-700 transition-colors"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              Deposit TON
            </button>
            <div className="my-1 border-t border-surface-600" />
            <button
              onClick={() => { disconnect(); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-no/70 hover:text-no hover:bg-no/10 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Disconnect
            </button>
          </div>
        )}
      </div>

      {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} />}
    </>
  )
}
