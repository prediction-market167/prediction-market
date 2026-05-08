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
  amount_stars: number
  amount_ton: number
  wallet_address: string
  status: string
}

export const usersApi = {
  updateWallet: (ton_wallet_address: string | null) =>
    apiClient.patch<User>('/users/me', { ton_wallet_address }).then((r) => r.data),

  depositAddress: () =>
    apiClient.get<DepositAddress>('/users/me/deposit-address').then((r) => r.data),

  platformSettings: () =>
    apiClient.get<PlatformSettings>('/users/me/platform-settings').then((r) => r.data),

  withdraw: (amount_stars: number) =>
    apiClient.post<WithdrawResult>('/users/me/withdraw', { amount_stars }).then((r) => r.data),
}
