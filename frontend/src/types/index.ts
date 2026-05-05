export interface User {
  id: number
  email: string
  username: string
  full_name?: string
  balance: number
  is_active: boolean
  is_superuser: boolean
  ton_wallet_address: string | null
  created_at: string
}

export type MarketStatus = 'open' | 'closed' | 'resolved' | 'cancelled'
export type MarketOutcome = 'yes' | 'no' | 'unresolved'

export interface Market {
  id: number
  title: string
  description: string
  category: string
  creator_id: number
  status: MarketStatus
  outcome: MarketOutcome
  yes_probability: number
  no_probability: number
  total_volume: number
  close_date: string
  created_at: string
}

export type BetSide = 'yes' | 'no'
export type BetStatus = 'active' | 'won' | 'lost' | 'cancelled'

export interface Bet {
  id: number
  user_id: number
  market_id: number
  side: BetSide
  status: BetStatus
  amount: number
  probability_at_bet: number
  potential_payout: number
  actual_payout?: number
  created_at: string
}

export interface Token {
  access_token: string
  token_type: string
}

export interface ApiError {
  detail: string
}

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string
        initDataUnsafe: {
          user?: TelegramUser
          query_id?: string
          auth_date: number
          hash: string
        }
        ready(): void
        expand(): void
        close(): void
        openInvoice(url: string, callback?: (status: string) => void): void
      }
    }
  }
}
