import apiClient from './client'

export interface StarsInvoiceResponse {
  payment_id: number
  invoice_url: string
  stars_amount: number
}

export interface StarsVerifyResponse {
  payment_id: number
  status: 'pending' | 'paid' | 'failed'
  bet_id: number | null
}

const paymentsApi = {
  createStarsInvoice: (market_id: number, side: 'yes' | 'no', amount: number) =>
    apiClient
      .post<StarsInvoiceResponse>('/payments/stars/invoice', { market_id, side, amount })
      .then(r => r.data),

  verifyStars: (payment_id: number) =>
    apiClient
      .post<StarsVerifyResponse>('/payments/stars/verify', { payment_id })
      .then(r => r.data),
}

export default paymentsApi
