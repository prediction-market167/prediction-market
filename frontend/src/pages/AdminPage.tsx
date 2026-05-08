import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import {
  Plus, CheckCircle, XCircle, Clock, Ban, Users, BarChart2, Trophy,
  Upload, RefreshCw, Play, Trash2, Download, FileSpreadsheet
} from 'lucide-react'
import adminApi, { MarketCreatePayload } from '@/api/admin'
import questionsApi from '@/api/questions'
import type { Market, MarketOutcome, User, Question, QuestionTier } from '@/types'

type Tab = 'markets' | 'users' | 'questions'

const MIN_PARTICIPANTS = 20

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-yes/20 text-yes border-yes/30',
  closed: 'bg-brand-blue/20 text-brand-blue border-brand-blue/30',
  resolved: 'bg-surface-600 text-ink-400 border-surface-500',
  cancelled: 'bg-no/20 text-no border-no/30',
}


const TIER_COLORS: Record<QuestionTier, string> = {
  free: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  easy: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
  medium: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  hard: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
}

// ─── Market Form Modal ────────────────────────────────────────────────────────

function MarketFormModal({
  market, onClose, onSave,
}: {
  market?: Market
  onClose: () => void
  onSave: (data: MarketCreatePayload) => void
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    title: market?.title ?? '',
    description: market?.description ?? '',
    category: market?.category ?? '',
    close_date: market?.close_date ? market.close_date.slice(0, 16) : '',
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-lg mx-4">
        <h2 className="text-lg font-bold text-ink-100 mb-5">
          {market ? t('admin.markets.editTitle') : t('admin.markets.createTitle')}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-400 mb-1">{t('admin.markets.fields.title')}</label>
            <input className="input-dark w-full" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-400 mb-1">{t('admin.markets.fields.description')}</label>
            <textarea className="input-dark w-full h-24 resize-none" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-400 mb-1">{t('admin.markets.fields.category')}</label>
              <input className="input-dark w-full" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-400 mb-1">{t('admin.markets.fields.closeDate')}</label>
              <input type="datetime-local" className="input-dark w-full" value={form.close_date} onChange={e => setForm(f => ({ ...f, close_date: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-ink-400 hover:text-ink-100 transition-colors">
            {t('admin.markets.cancel')}
          </button>
          <button
            onClick={() => onSave({ ...form, close_date: new Date(form.close_date).toISOString() })}
            className="btn-primary text-sm px-5 py-2"
          >
            {market ? t('admin.markets.save') : t('admin.markets.create')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Resolve Modal ────────────────────────────────────────────────────────────

function ResolveModal({
  market, onClose, onResolve,
}: {
  market: Market
  onClose: () => void
  onResolve: (outcome: MarketOutcome) => void
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language.split('-')[0]
  const options = market.options
    ? (lang === 'en' ? market.options.en : lang === 'ru' ? market.options.ru : lang === 'hi' ? market.options.hi : market.options.mn)
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-sm mx-4">
        <h2 className="text-lg font-bold text-ink-100 mb-2">{t('admin.markets.resolveTitle')}</h2>
        <p className="text-sm text-ink-400 mb-6 line-clamp-3">{market.title}</p>
        {options ? (
          <div className="grid gap-2">
            {options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => onResolve(idx === 0 ? 'yes' : idx === 1 ? 'no' : idx === 2 ? 'yes' : 'no')}
                className="py-2.5 px-4 rounded-xl font-semibold text-sm text-left text-ink-200 bg-surface-700 border border-surface-600 hover:border-brand-cyan/40 hover:bg-brand-cyan/5 transition-colors"
              >
                <span className="text-brand-cyan font-black mr-2">{String.fromCharCode(65 + idx)}.</span>
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => onResolve('yes')} className="py-3 rounded-xl font-bold text-white bg-yes/20 border border-yes/40 hover:bg-yes/30 transition-colors">YES</button>
            <button onClick={() => onResolve('no')} className="py-3 rounded-xl font-bold text-white bg-no/20 border border-no/40 hover:bg-no/30 transition-colors">NO</button>
          </div>
        )}
        <button onClick={onClose} className="w-full mt-3 py-2 text-sm text-ink-600 hover:text-ink-400 transition-colors">
          {t('admin.markets.cancel')}
        </button>
      </div>
    </div>
  )
}

function ParticipantBadge({ count }: { count: number }) {
  const active = count >= MIN_PARTICIPANTS
  return (
    <div className={`flex items-center gap-1 text-xs font-medium ${active ? 'text-yes' : 'text-ink-500'}`}>
      {active ? <><Trophy className="w-3 h-3" />{count}</> : <><Users className="w-3 h-3" />{count}/{MIN_PARTICIPANTS}</>}
    </div>
  )
}

// ─── Markets Tab ──────────────────────────────────────────────────────────────

function MarketsTab() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editMarket, setEditMarket] = useState<Market | null>(null)
  const [resolveMarket, setResolveMarket] = useState<Market | null>(null)
  const [closeNotice, setCloseNotice] = useState<string | null>(null)

  const { data: markets = [], isLoading } = useQuery({
    queryKey: ['admin', 'markets'],
    queryFn: () => adminApi.listMarkets(),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'markets'] })

  const createMut = useMutation({ mutationFn: adminApi.createMarket, onSuccess: () => { invalidate(); setShowCreate(false) } })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof adminApi.updateMarket>[1] }) => adminApi.updateMarket(id, data),
    onSuccess: () => { invalidate(); setEditMarket(null) },
  })
  const closeMut = useMutation({
    mutationFn: adminApi.closeMarket,
    onSuccess: (result) => {
      invalidate()
      if (result.status === 'cancelled') {
        setCloseNotice(t('admin.markets.closeNotice', { count: result.participant_count, min: MIN_PARTICIPANTS }))
        setTimeout(() => setCloseNotice(null), 6000)
      }
    },
  })
  const resolveMut = useMutation({
    mutationFn: ({ id, outcome }: { id: number; outcome: MarketOutcome }) => adminApi.resolveMarket(id, outcome),
    onSuccess: () => { invalidate(); setResolveMarket(null) },
  })
  const cancelMut = useMutation({ mutationFn: adminApi.cancelMarket, onSuccess: invalidate })

  const HEADERS = [
    t('admin.markets.headers.title'), t('admin.markets.headers.category'),
    t('admin.markets.headers.status'), t('admin.markets.headers.players'),
    t('admin.markets.headers.volume'), t('admin.markets.headers.closeDate'),
    t('admin.markets.headers.actions'),
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-ink-400">{t('admin.markets.count', { count: markets.length })}</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> {t('admin.markets.newMarket')}
        </button>
      </div>

      {closeNotice && (
        <div className="mb-4 rounded-xl px-4 py-3 bg-brand-blue/10 border border-brand-blue/20 text-sm text-brand-blue">
          {closeNotice}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-ink-600">{t('admin.markets.loading')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-600">
                {HEADERS.map(h => <th key={h} className="text-left text-xs font-medium text-ink-600 pb-3 pr-4">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700">
              {markets.map(m => (
                <tr key={m.id} className="hover:bg-surface-700/30 transition-colors">
                  <td className="py-3 pr-4 max-w-xs">
                    <p className="text-ink-100 font-medium truncate">{m.title}</p>
                    <p className="text-xs text-ink-600">#{m.id}{m.tier && <span className="ml-1 uppercase text-brand-cyan">[{m.tier}]</span>}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-xs text-ink-400 bg-surface-700 px-2 py-0.5 rounded-full">{m.category}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_BADGE[m.status]}`}>{m.status}</span>
                  </td>
                  <td className="py-3 pr-4"><ParticipantBadge count={m.participant_count} /></td>
                  <td className="py-3 pr-4 text-ink-300">⭐{Number(m.total_volume).toLocaleString()}</td>
                  <td className="py-3 pr-4 text-ink-400 text-xs whitespace-nowrap">{format(new Date(m.close_date), 'MMM d, HH:mm')}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditMarket(m)} className="p-1.5 rounded-lg text-ink-500 hover:text-ink-100 hover:bg-surface-600 transition-colors" title={t('admin.markets.tooltips.edit')}>
                        <BarChart2 className="w-3.5 h-3.5" />
                      </button>
                      {m.status === 'open' && (
                        <button onClick={() => closeMut.mutate(m.id)} disabled={closeMut.isPending} className="p-1.5 rounded-lg text-ink-500 hover:text-brand-blue hover:bg-brand-blue/10 transition-colors disabled:opacity-50" title={t('admin.markets.tooltips.close')}>
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {(m.status === 'open' || m.status === 'closed') && (
                        <button onClick={() => setResolveMarket(m)} className="p-1.5 rounded-lg text-ink-500 hover:text-yes hover:bg-yes/10 transition-colors" title={t('admin.markets.tooltips.resolve')}>
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {m.status !== 'cancelled' && m.status !== 'resolved' && (
                        <button onClick={() => cancelMut.mutate(m.id)} className="p-1.5 rounded-lg text-ink-500 hover:text-no hover:bg-no/10 transition-colors" title={t('admin.markets.tooltips.forceCancel')}>
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <MarketFormModal onClose={() => setShowCreate(false)} onSave={data => createMut.mutate(data)} />}
      {editMarket && <MarketFormModal market={editMarket} onClose={() => setEditMarket(null)} onSave={data => updateMut.mutate({ id: editMarket.id, data })} />}
      {resolveMarket && <ResolveModal market={resolveMarket} onClose={() => setResolveMarket(null)} onResolve={outcome => resolveMut.mutate({ id: resolveMarket.id, outcome })} />}
    </div>
  )
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: adminApi.listUsers,
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof adminApi.updateUser>[1] }) => adminApi.updateUser(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
  const HEADERS = [t('admin.users.headers.user'), t('admin.users.headers.balance'), t('admin.users.headers.active'), t('admin.users.headers.superuser'), t('admin.users.headers.joined'), t('admin.users.headers.actions')]

  return (
    <div>
      <p className="text-sm text-ink-400 mb-5">{t('admin.users.count', { count: users.length })}</p>
      {isLoading ? (
        <div className="text-center py-12 text-ink-600">{t('admin.users.loading')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-600">
                {HEADERS.map(h => <th key={h} className="text-left text-xs font-medium text-ink-600 pb-3 pr-4">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700">
              {users.map((u: User) => (
                <tr key={u.id} className="hover:bg-surface-700/30 transition-colors">
                  <td className="py-3 pr-4">
                    <p className="text-ink-100 font-medium">{u.username}</p>
                    <p className="text-xs text-ink-600">{u.email}</p>
                  </td>
                  <td className="py-3 pr-4 text-ink-300">⭐{Number(u.balance).toLocaleString()}</td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${u.is_active ? 'bg-yes/20 text-yes border-yes/30' : 'bg-no/20 text-no border-no/30'}`}>
                      {u.is_active ? t('admin.users.active') : t('admin.users.inactive')}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${u.is_superuser ? 'bg-brand-blue/20 text-brand-blue border-brand-blue/30' : 'bg-surface-600 text-ink-600 border-surface-500'}`}>
                      {u.is_superuser ? t('admin.users.admin') : t('admin.users.user')}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-ink-400 text-xs whitespace-nowrap">{format(new Date(u.created_at), 'MMM d, yyyy')}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateMut.mutate({ id: u.id, data: { is_active: !u.is_active } })} className={`p-1.5 rounded-lg transition-colors ${u.is_active ? 'text-ink-500 hover:text-no hover:bg-no/10' : 'text-ink-500 hover:text-yes hover:bg-yes/10'}`} title={u.is_active ? t('admin.users.tooltips.deactivate') : t('admin.users.tooltips.activate')}>
                        {u.is_active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => updateMut.mutate({ id: u.id, data: { is_superuser: !u.is_superuser } })} className="p-1.5 rounded-lg text-ink-500 hover:text-brand-blue hover:bg-brand-blue/10 transition-colors" title={u.is_superuser ? t('admin.users.tooltips.removeAdmin') : t('admin.users.tooltips.makeAdmin')}>
                        <Users className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Questions Tab ────────────────────────────────────────────────────────────

const SAMPLE_CSV_ROWS = [
  // header
  'tier,question_mn,question_en,question_ru,question_hi,option_a_mn,option_a_en,option_a_ru,option_a_hi,option_b_mn,option_b_en,option_b_ru,option_b_hi,option_c_mn,option_c_en,option_c_ru,option_c_hi,option_d_mn,option_d_en,option_d_ru,option_d_hi,correct_answer',
  // free (2 options — c/d left empty)
  'free,Дэлхийн хамгийн том далай юу вэ?,What is the largest ocean?,Какой океан самый большой?,सबसे बड़ा महासागर कौन सा है?,Номхон далай,Pacific Ocean,Тихий океан,प्रशांत महासागर,Энэтхэгийн далай,Indian Ocean,Индийский океан,हिंद महासागर,,,,,,,,,,a',
  // easy (2 options)
  'easy,Монгол улс ардчилсан орон мөн үү?,Is Mongolia a democratic country?,Монголия — демократическая страна?,क्या मंगोलिया लोकतांत्रिक देश है?,Тийм,True,Да,हाँ,Үгүй,False,Нет,नहीं,,,,,,,,,,a',
  // medium (2 options)
  'medium,Монгол улсын нийслэл хот аль нь вэ?,What is the capital of Mongolia?,Какова столица Монголии?,मंगोलिया की राजधानी?,Улаанбаатар,Ulaanbaatar,Улан-Батор,उलानबाटार,Дархан,Darkhan,Дархан,दारखान,,,,,,,,,,a',
  // hard (4 options)
  'hard,Дэлхийн хамгийн өндөр уул?,World\'s highest mountain?,Самая высокая гора в мире?,दुनिया का सबसे ऊँचा पर्वत?,Эверест,Everest,Эверест,एवरेस्ट,К2,K2,K2,K2,Канченжунга,Kangchenjunga,Канченджанга,कंचनजंगा,Лхоцзе,Lhotse,Лхоцзе,ल्होत्से,a',
].join('\n')

function downloadSampleCsv() {
  const blob = new Blob([SAMPLE_CSV_ROWS], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'questions_sample.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function QuestionsTab() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['admin', 'questions'],
    queryFn: () => questionsApi.list(),
  })

  const uploadMut = useMutation({
    mutationFn: questionsApi.upload,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin', 'questions'] })
      setUploadError(null)
      setUploadSuccess(t('admin.questions.uploadSuccess', { count: data.created }))
      setTimeout(() => setUploadSuccess(null), 5000)
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      if (Array.isArray(detail?.errors)) {
        setUploadError(detail.errors.join('\n'))
      } else {
        setUploadError(typeof detail === 'string' ? detail : t('admin.questions.uploadFailed'))
      }
    },
  })

  const triggerMut = useMutation({
    mutationFn: questionsApi.triggerTier,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'questions'] })
      qc.invalidateQueries({ queryKey: ['markets'] })
    },
  })

  const deleteMut = useMutation({
    mutationFn: questionsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'questions'] }),
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    uploadMut.mutate(file)
    e.target.value = ''
  }

  const TIERS: QuestionTier[] = ['free', 'easy', 'medium', 'hard']

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMut.isPending}
          className="btn-primary text-sm px-4 py-2 flex items-center gap-2 disabled:opacity-50"
        >
          {uploadMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {t('admin.questions.upload')}
        </button>

        <button
          onClick={downloadSampleCsv}
          className="text-sm px-4 py-2 rounded-xl flex items-center gap-2 bg-surface-700 border border-surface-600 text-ink-300 hover:text-ink-100 hover:border-surface-500 transition-colors"
        >
          <Download className="w-4 h-4" />
          {t('admin.questions.downloadSample')}
        </button>

        <div className="ml-auto flex gap-2">
          {TIERS.map(tier => (
            <button
              key={tier}
              onClick={() => triggerMut.mutate(tier)}
              disabled={triggerMut.isPending}
              className="text-xs px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 bg-surface-700 border border-surface-600 text-ink-400 hover:text-ink-100 hover:border-surface-500 transition-colors disabled:opacity-50"
              title={t('admin.questions.triggerTier', { tier })}
            >
              <Play className="w-3 h-3" />
              {tier.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {uploadError && (
        <div className="mb-4 rounded-xl px-4 py-3 bg-no/10 border border-no/20 text-sm text-no whitespace-pre-line">
          {uploadError}
        </div>
      )}
      {uploadSuccess && (
        <div className="mb-4 rounded-xl px-4 py-3 bg-yes/10 border border-yes/20 text-sm text-yes">
          {uploadSuccess}
        </div>
      )}

      {/* Column format reference */}
      <div className="mb-5 rounded-xl p-4 bg-surface-800 border border-surface-700 text-xs">
        <p className="font-semibold text-ink-300 mb-2">{t('admin.questions.csvFormatTitle')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-ink-500">
          <div><span className="text-brand-cyan font-mono">tier</span> — free / easy / medium / hard</div>
          <div><span className="text-brand-cyan font-mono">correct_answer</span> — a / b / c / d</div>
          <div><span className="text-brand-cyan font-mono">question_mn/en/ru/hi</span> — {t('admin.questions.csvRequired')}</div>
          <div><span className="text-brand-cyan font-mono">option_a_mn/en/ru/hi</span> — {t('admin.questions.csvRequired')}</div>
          <div><span className="text-brand-cyan font-mono">option_b_mn/en/ru/hi</span> — {t('admin.questions.csvRequired')}</div>
          <div><span className="text-brand-cyan font-mono">option_c/d_mn/en/ru/hi</span> — {t('admin.questions.csvHardOnly')}</div>
        </div>
      </div>

      <p className="text-sm text-ink-400 mb-4">{t('admin.questions.count', { count: questions.length })}</p>

      {isLoading ? (
        <div className="text-center py-12 text-ink-600">{t('admin.questions.loading')}</div>
      ) : questions.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-surface-800/50 border border-surface-700">
          <FileSpreadsheet className="w-10 h-10 text-ink-700 mx-auto mb-3" />
          <p className="text-ink-500 text-sm font-medium mb-1">{t('admin.questions.empty')}</p>
          <button onClick={downloadSampleCsv} className="text-xs text-brand-cyan hover:underline flex items-center gap-1 mx-auto mt-2">
            <Download className="w-3 h-3" />{t('admin.questions.downloadSample')}
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-600">
                {[
                  t('admin.questions.headers.tier'),
                  t('admin.questions.headers.question'),
                  t('admin.questions.headers.options'),
                  t('admin.questions.headers.langs'),
                  t('admin.questions.headers.actions'),
                ].map(h => <th key={h} className="text-left text-xs font-medium text-ink-600 pb-3 pr-4">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700">
              {questions.map((q: Question) => (
                <tr key={q.id} className="hover:bg-surface-700/30 transition-colors">
                  <td className="py-3 pr-4">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase ${TIER_COLORS[q.tier]}`}>
                      {q.tier}
                    </span>
                    {q.is_used && (
                      <p className="text-[10px] text-ink-600 mt-1">{t('admin.questions.used')}</p>
                    )}
                  </td>
                  <td className="py-3 pr-4 max-w-xs">
                    <p className="text-ink-200 text-xs leading-relaxed line-clamp-2">{q.question_mn}</p>
                    {q.question_en && (
                      <p className="text-ink-600 text-[10px] mt-0.5 line-clamp-1">{q.question_en}</p>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="space-y-0.5">
                      {q.options_mn.map((opt, idx) => (
                        <p key={idx} className={`text-[10px] ${idx === q.correct_option_idx ? 'text-yes font-bold' : 'text-ink-600'}`}>
                          {String.fromCharCode(65 + idx)}. {opt}
                        </p>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex gap-1">
                      {(['mn', 'en', 'ru', 'hi'] as const).map(lang => {
                        const hasLang = lang === 'mn' || !!q[`question_${lang}` as keyof Question]
                        return (
                          <span key={lang} className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${hasLang ? 'bg-yes/20 text-yes' : 'bg-surface-700 text-ink-700'}`}>
                            {lang}
                          </span>
                        )
                      })}
                    </div>
                  </td>
                  <td className="py-3">
                    {!q.is_used && (
                      <button
                        onClick={() => deleteMut.mutate(q.id)}
                        disabled={deleteMut.isPending}
                        className="p-1.5 rounded-lg text-ink-500 hover:text-no hover:bg-no/10 transition-colors disabled:opacity-50"
                        title={t('admin.questions.delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Admin Page ───────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('questions')

  return (
    <div>
      <h1 className="text-2xl font-black text-ink-100 mb-6">{t('admin.title')}</h1>
      <div className="card">
        <div className="flex gap-1 mb-6 border-b border-surface-600 pb-4 overflow-x-auto">
          {([
            { key: 'questions', icon: FileSpreadsheet, label: t('admin.tabs.questions') },
            { key: 'markets', icon: BarChart2, label: t('admin.tabs.markets') },
            { key: 'users', icon: Users, label: t('admin.tabs.users') },
          ] as const).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                tab === key ? 'bg-surface-600 text-ink-100' : 'text-ink-500 hover:text-ink-300'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Icon className="w-4 h-4" />{label}
              </span>
            </button>
          ))}
        </div>
        {tab === 'questions' && <QuestionsTab />}
        {tab === 'markets' && <MarketsTab />}
        {tab === 'users' && <UsersTab />}
      </div>
    </div>
  )
}
