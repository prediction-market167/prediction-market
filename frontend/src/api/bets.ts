import apiClient from './client'
import type { Bet, BetSide } from '@/types'

export const betsApi = {
  place: (data: { market_id: number; side: BetSide; amount: number }) =>
    apiClient.post<Bet>('/bets', data).then((r) => r.data),

  myBets: (params?: { skip?: number; limit?: number; market_id?: number }) =>
    apiClient.get<Bet[]>('/bets/my', { params }).then((r) => r.data),
}
