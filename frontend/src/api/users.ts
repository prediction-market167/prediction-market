import apiClient from './client'
import type { User } from '@/types'

export interface DepositAddress {
  address: string
  memo: string
  amount_per_credit: string
}

export const usersApi = {
  updateWallet: (ton_wallet_address: string | null) =>
    apiClient.patch<User>('/users/me', { ton_wallet_address }).then((r) => r.data),

  depositAddress: () =>
    apiClient.get<DepositAddress>('/users/me/deposit-address').then((r) => r.data),
}
