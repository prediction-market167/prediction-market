import apiClient from './client'
import type { User } from '@/types'

export interface DepositAddress {
  address: string
  memo: string
  amount_per_credit: string
}

export interface PlatformSettings {
  stars_to_ton_rate: number
}

export interface WithdrawResult {
  withdrawal_id: number
  amount_gems: number
  amount_ton: number
  wallet_address: string
  status: string
}

export interface WithdrawalRecord {
  id: number
  amount_gems: number
  amount_ton: number
  wallet_address: string
  status: 'pending' | 'completed' | 'failed'
  tx_hash: string | null
  note: string | null
  created_at: string
}

export const usersApi = {
  updateWallet: (ton_wallet_address: string | null) =>
    apiClient.patch<User>('/users/me', { ton_wallet_address }).then((r) => r.data),

  depositAddress: () =>
    apiClient.get<DepositAddress>('/users/me/deposit-address').then((r) => r.data),

  platformSettings: () =>
    apiClient.get<PlatformSettings>('/users/me/platform-settings').then((r) => r.data),

  withdraw: (amount_gems: number, wallet_address: string) =>
    apiClient
      .post<WithdrawResult>('/users/me/withdraw', { amount_gems, wallet_address })
      .then((r) => r.data),

  getWithdrawals: () =>
    apiClient.get<WithdrawalRecord[]>('/users/me/withdrawals').then((r) => r.data),
}
