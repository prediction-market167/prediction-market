import apiClient from './client'
import type { ReferralInfo, JackpotInfo } from '@/types'

const referralApi = {
  info: () =>
    apiClient.get<ReferralInfo>('/referral/info').then(r => r.data),

  jackpot: () =>
    apiClient.get<JackpotInfo>('/referral/jackpot').then(r => r.data),
}

export default referralApi
