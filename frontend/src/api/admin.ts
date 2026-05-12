import apiClient from './client'
import type { Market, MarketStatus, MarketOutcome, User } from '@/types'

export interface MarketCreatePayload {
  title: string
  description: string
  category: string
  close_date: string
}

export interface MarketUpdatePayload {
  title?: string
  description?: string
  status?: MarketStatus
}

export interface UserAdminUpdatePayload {
  is_active?: boolean
  is_superuser?: boolean
  balance?: number
}

export type JackpotCriteriaType = 'contest_count' | 'leaderboard'

export interface JackpotCriteria {
  type: JackpotCriteriaType
  min_contests?: number
  days?: number
  tier?: string
  top_x?: number
}

export interface JackpotTriggerResult {
  winner_username: string
  amount: number
  eligible_count: number
}

export interface JackpotHistoryEntry {
  id: number
  winner_username: string
  amount: number
  criteria: JackpotCriteria | null
  created_at: string
}

export interface AdminSettings {
  stars_to_ton_rate: number
}

export interface BlockedUser {
  id: number
  username: string
  telegram_id: number | null
  blocked_at: string | null
  block_reason: string | null
}

export interface FinancialData {
  total_revenue: number
  prize_pool_balance: number
  jackpot_balance: number
  referral_pool_balance: number
  monthly_bonus_balance: number
  admin_profit_balance: number
  master_wallet_configured: boolean
}

export interface AdminWithdrawal {
  id: number
  user_id: number
  username: string
  telegram_id: number | null
  amount_gems: number
  amount_ton: number
  wallet_address: string
  status: 'pending' | 'completed' | 'failed'
  tx_hash: string | null
  note: string | null
  created_at: string
}

const adminApi = {
  listMarkets: (status?: MarketStatus) =>
    apiClient.get<Market[]>('/admin/markets', { params: status ? { status } : {} }).then(r => r.data),

  createMarket: (payload: MarketCreatePayload) =>
    apiClient.post<Market>('/admin/markets', payload).then(r => r.data),

  updateMarket: (id: number, payload: MarketUpdatePayload) =>
    apiClient.patch<Market>(`/admin/markets/${id}`, payload).then(r => r.data),

  closeMarket: (id: number) =>
    apiClient.post<Market>(`/admin/markets/${id}/close`).then(r => r.data),

  resolveMarket: (id: number, outcome: MarketOutcome) =>
    apiClient.post<Market>(`/admin/markets/${id}/resolve`, { outcome }).then(r => r.data),

  cancelMarket: (id: number) =>
    apiClient.delete<Market>(`/admin/markets/${id}`).then(r => r.data),

  repairRefunds: () =>
    apiClient.post<{ markets_processed: number; total_bets_refunded: number; details: { market_id: number; refunded: number; ok: boolean; error?: string }[] }>('/admin/markets/repair-refunds').then(r => r.data),

  listUsers: () =>
    apiClient.get<User[]>('/admin/users').then(r => r.data),

  updateUser: (id: number, payload: UserAdminUpdatePayload) =>
    apiClient.patch<User>(`/admin/users/${id}`, payload).then(r => r.data),

  jackpotEligibleCount: (criteria: JackpotCriteria) =>
    apiClient.get<{ count: number }>('/admin/jackpot/eligible-count', { params: criteria }).then(r => r.data),

  triggerJackpot: (criteria: JackpotCriteria) =>
    apiClient.post<JackpotTriggerResult>('/admin/jackpot/trigger', criteria).then(r => r.data),

  jackpotHistory: () =>
    apiClient.get<JackpotHistoryEntry[]>('/admin/jackpot/history').then(r => r.data),

  broadcast: (message: string) =>
    apiClient.post<{ sent: number; total: number }>('/admin/broadcast', { message }).then(r => r.data),

  getSettings: () =>
    apiClient.get<AdminSettings>('/admin/settings').then(r => r.data),

  updateSettings: (stars_to_ton_rate: number) =>
    apiClient.patch<AdminSettings>('/admin/settings', { stars_to_ton_rate }).then(r => r.data),

  getBlockedUsers: () =>
    apiClient.get<BlockedUser[]>('/admin/blocked-users').then(r => r.data),

  unblockUser: (id: number) =>
    apiClient.post<{ ok: boolean }>(`/admin/blocked-users/${id}/unblock`).then(r => r.data),

  getFinancials: () =>
    apiClient.get<FinancialData>('/admin/financials').then(r => r.data),

  listWithdrawals: (status?: string) =>
    apiClient
      .get<AdminWithdrawal[]>('/admin/withdrawals', { params: status ? { status } : {} })
      .then(r => r.data),

  approveWithdrawal: (id: number, note?: string) =>
    apiClient.post<{ status: string; tx_hash: string }>(`/admin/withdrawals/${id}/approve`, { note }).then(r => r.data),

  rejectWithdrawal: (id: number, note?: string) =>
    apiClient.post<{ status: string }>(`/admin/withdrawals/${id}/reject`, { note }).then(r => r.data),
}

export default adminApi
