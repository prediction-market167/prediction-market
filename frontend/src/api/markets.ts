import apiClient from './client'
import type { Market } from '@/types'

export const marketsApi = {
  list: (params?: { status?: string; category?: string; tier?: string; skip?: number; limit?: number }) =>
    apiClient.get<Market[]>('/markets', { params }).then((r) => r.data),

  get: (id: number) =>
    apiClient.get<Market>(`/markets/${id}`).then((r) => r.data),

  create: (data: { title: string; description: string; category: string; close_date: string }) =>
    apiClient.post<Market>('/markets', data).then((r) => r.data),

  resolve: (id: number, outcome: 'yes' | 'no') =>
    apiClient.post<Market>(`/markets/${id}/resolve`, { outcome }).then((r) => r.data),
}
