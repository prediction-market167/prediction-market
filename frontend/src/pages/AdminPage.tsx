import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { Plus, CheckCircle, XCircle, Clock, Ban, Users, BarChart2, Trophy } from 'lucide-react'
import adminApi, { MarketCreatePayload } from '@/api/admin'
import type { Market, MarketOutcome, User } from '@/types'

type Tab = 'markets' | 'users'

const MIN_PARTICIPANTS = 20

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-yes/20 text-yes border-yes/30',
  closed: 'bg-brand-blue/20 text-brand-blue border-brand-blue/30',
  resolved: 'bg-surface-600 text-ink-400 border-surface-500',
  cancelled: 'bg-no/20 text-no border-no/30',
}

function MarketFormModal({
  market,
  onClose,
  onSave,
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
            <label className="block text-xs font-medium text-ink-400 mb-1">
              {t('admin.markets.fields.title')}
            </label>
            <input
              className="input-dark w-full"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-400 mb-1">
              {t('admin.markets.fields.description')}
            </label>
            <textarea
              className="input-dark w-full h-24 resize-none"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-400 mb-1">
                {t('admin.markets.fields.category')}
              </label>
              <input
                className="input-dark w-full"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-400 mb-1">
                {t('admin.markets.fields.closeDate')}
              </label>
              <input
                type="datetime-local"
                className="input-dark w-full"
                value={form.close_date}
                onChange={e => setForm(f => ({ ...f, close_date: e.target.value }))}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-ink-400 hover:text-ink-100 transition-colors"
          >
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

function ResolveModal({
  market,
  onClose,
  onResolve,
}: {
  market: Market
  onClose: () => void
  onResolve: (outcome: MarketOutcome) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-sm mx-4">
        <h2 className="text-lg font-bold text-ink-100 mb-2">{t('admin.markets.resolveTitle')}</h2>
        <p className="text-sm text-ink-400 mb-6 line-clamp-2">{market.title}</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onResolve('yes')}
            className="py-3 rounded-xl font-bold text-white bg-yes/20 border border-yes/40 hover:bg-yes/30 transition-colors"
          >
            YES
          </button>
          <button
            onClick={() => onResolve('no')}
            className="py-3 rounded-xl font-bold text-white bg-no/20 border border-no/40 hover:bg-no/30 transition-colors"
          >
            NO
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-full mt-3 py-2 text-sm text-ink-600 hover:text-ink-400 transition-colors"
        >
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
      {active
        ? <><Trophy className="w-3 h-3" />{count}</>
        : <><Users className="w-3 h-3" />{count}/{MIN_PARTICIPANTS}</>
      }
    </div>
  )
}

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

  const createMut = useMutation({
    mutationFn: adminApi.createMarket,
    onSuccess: () => { invalidate(); setShowCreate(false) },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof adminApi.updateMarket>[1] }) =>
      adminApi.updateMarket(id, data),
    onSuccess: () => { invalidate(); setEditMarket(null) },
  })

  const closeMut = useMutation({
    mutationFn: adminApi.closeMarket,
    onSuccess: (result) => {
      invalidate()
      if (result.status === 'cancelled') {
        setCloseNotice(
          t('admin.markets.closeNotice', {
            count: result.participant_count,
            min: MIN_PARTICIPANTS,
          })
        )
        setTimeout(() => setCloseNotice(null), 6000)
      }
    },
  })

  const resolveMut = useMutation({
    mutationFn: ({ id, outcome }: { id: number; outcome: MarketOutcome }) =>
      adminApi.resolveMarket(id, outcome),
    onSuccess: () => { invalidate(); setResolveMarket(null) },
  })

  const cancelMut = useMutation({
    mutationFn: adminApi.cancelMarket,
    onSuccess: invalidate,
  })

  const HEADERS = [
    t('admin.markets.headers.title'),
    t('admin.markets.headers.category'),
    t('admin.markets.headers.status'),
    t('admin.markets.headers.players'),
    t('admin.markets.headers.volume'),
    t('admin.markets.headers.closeDate'),
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
                {HEADERS.map(h => (
                  <th key={h} className="text-left text-xs font-medium text-ink-600 pb-3 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700">
              {markets.map(m => (
                <tr key={m.id} className="hover:bg-surface-700/30 transition-colors">
                  <td className="py-3 pr-4 max-w-xs">
                    <p className="text-ink-100 font-medium truncate">{m.title}</p>
                    <p className="text-xs text-ink-600">#{m.id}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-xs text-ink-400 bg-surface-700 px-2 py-0.5 rounded-full">{m.category}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_BADGE[m.status]}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <ParticipantBadge count={m.participant_count} />
                  </td>
                  <td className="py-3 pr-4 text-ink-300">⭐{Number(m.total_volume).toLocaleString()}</td>
                  <td className="py-3 pr-4 text-ink-400 text-xs whitespace-nowrap">
                    {format(new Date(m.close_date), 'MMM d, yyyy')}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditMarket(m)}
                        className="p-1.5 rounded-lg text-ink-500 hover:text-ink-100 hover:bg-surface-600 transition-colors"
                        title={t('admin.markets.tooltips.edit')}
                      >
                        <BarChart2 className="w-3.5 h-3.5" />
                      </button>
                      {m.status === 'open' && (
                        <button
                          onClick={() => closeMut.mutate(m.id)}
                          disabled={closeMut.isPending}
                          className="p-1.5 rounded-lg text-ink-500 hover:text-brand-blue hover:bg-brand-blue/10 transition-colors disabled:opacity-50"
                          title={t('admin.markets.tooltips.close')}
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {(m.status === 'open' || m.status === 'closed') && (
                        <button
                          onClick={() => setResolveMarket(m)}
                          className="p-1.5 rounded-lg text-ink-500 hover:text-yes hover:bg-yes/10 transition-colors"
                          title={t('admin.markets.tooltips.resolve')}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {m.status !== 'cancelled' && m.status !== 'resolved' && (
                        <button
                          onClick={() => cancelMut.mutate(m.id)}
                          className="p-1.5 rounded-lg text-ink-500 hover:text-no hover:bg-no/10 transition-colors"
                          title={t('admin.markets.tooltips.forceCancel')}
                        >
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

      {showCreate && (
        <MarketFormModal
          onClose={() => setShowCreate(false)}
          onSave={data => createMut.mutate(data)}
        />
      )}
      {editMarket && (
        <MarketFormModal
          market={editMarket}
          onClose={() => setEditMarket(null)}
          onSave={data => updateMut.mutate({ id: editMarket.id, data })}
        />
      )}
      {resolveMarket && (
        <ResolveModal
          market={resolveMarket}
          onClose={() => setResolveMarket(null)}
          onResolve={outcome => resolveMut.mutate({ id: resolveMarket.id, outcome })}
        />
      )}
    </div>
  )
}

function UsersTab() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: adminApi.listUsers,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof adminApi.updateUser>[1] }) =>
      adminApi.updateUser(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })

  const HEADERS = [
    t('admin.users.headers.user'),
    t('admin.users.headers.balance'),
    t('admin.users.headers.active'),
    t('admin.users.headers.superuser'),
    t('admin.users.headers.joined'),
    t('admin.users.headers.actions'),
  ]

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
                {HEADERS.map(h => (
                  <th key={h} className="text-left text-xs font-medium text-ink-600 pb-3 pr-4">{h}</th>
                ))}
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
                  <td className="py-3 pr-4 text-ink-400 text-xs whitespace-nowrap">
                    {format(new Date(u.created_at), 'MMM d, yyyy')}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateMut.mutate({ id: u.id, data: { is_active: !u.is_active } })}
                        className={`p-1.5 rounded-lg transition-colors ${u.is_active ? 'text-ink-500 hover:text-no hover:bg-no/10' : 'text-ink-500 hover:text-yes hover:bg-yes/10'}`}
                        title={u.is_active ? t('admin.users.tooltips.deactivate') : t('admin.users.tooltips.activate')}
                      >
                        {u.is_active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => updateMut.mutate({ id: u.id, data: { is_superuser: !u.is_superuser } })}
                        className="p-1.5 rounded-lg text-ink-500 hover:text-brand-blue hover:bg-brand-blue/10 transition-colors"
                        title={u.is_superuser ? t('admin.users.tooltips.removeAdmin') : t('admin.users.tooltips.makeAdmin')}
                      >
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

export default function AdminPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('markets')

  return (
    <div>
      <h1 className="text-2xl font-black text-ink-100 mb-6">{t('admin.title')}</h1>
      <div className="card">
        <div className="flex gap-1 mb-6 border-b border-surface-600 pb-4">
          {(['markets', 'users'] as Tab[]).map(tabKey => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize ${
                tab === tabKey ? 'bg-surface-600 text-ink-100' : 'text-ink-500 hover:text-ink-300'
              }`}
            >
              {tabKey === 'markets'
                ? <span className="flex items-center gap-1.5"><BarChart2 className="w-4 h-4" />{t('admin.tabs.markets')}</span>
                : <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />{t('admin.tabs.users')}</span>}
            </button>
          ))}
        </div>
        {tab === 'markets' ? <MarketsTab /> : <UsersTab />}
      </div>
    </div>
  )
}
