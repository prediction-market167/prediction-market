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

  listUsers: () =>
    apiClient.get<User[]>('/admin/users').then(r => r.data),

  updateUser: (id: number, payload: UserAdminUpdatePayload) =>
    apiClient.patch<User>(`/admin/users/${id}`, payload).then(r => r.data),
}

export default adminApi
