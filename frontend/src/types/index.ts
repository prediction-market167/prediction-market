export interface User {
  id: number
  email: string
  username: string
  full_name?: string
  balance: number
  is_active: boolean
  is_superuser: boolean
  ton_wallet_address: string | null
  referral_code?: string | null
  lifetime_referral_earnings?: number
  created_at: string
}

export type MarketStatus = 'open' | 'closed' | 'resolved' | 'cancelled'
export type MarketOutcome = 'yes' | 'no' | 'unresolved'
export type QuestionTier = 'free' | 'easy' | 'medium' | 'hard'
export type PoolStatus = 'gathering' | 'threshold_met'

export interface Market {
  id: number
  title: string
  title_en?: string
  title_ru?: string
  title_hi?: string
  description: string
  category: string
  creator_id: number
  status: MarketStatus
  outcome: MarketOutcome
  yes_probability: number
  no_probability: number
  total_volume: number
  participant_count: number
  close_date: string
  created_at: string

  // Quiz fields
  tier?: QuestionTier
  options?: { mn?: string[]; en: string[]; ru: string[]; hi: string[] }
  correct_option_idx?: number | null
  is_revealed: boolean
  pool_status?: PoolStatus | null
  question_id?: number | null
}

export type BetSide = 'yes' | 'no' | 'opt2' | 'opt3'
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

export interface MarketResultEntry {
  rank: number
  username: string
  option_idx: number
  elapsed_seconds: number
  is_correct: boolean
  prize: number
  is_you: boolean
}

export interface MarketResultsResponse {
  total_participants: number
  correct_count: number
  prize_pool: number
  your_rank: number | null
  entries: MarketResultEntry[]
}

export type TranslationStatus = 'pending' | 'done' | 'failed'

export interface Question {
  id: number
  tier: QuestionTier
  order_idx: number
  question_mn: string
  question_en?: string
  question_ru?: string
  question_hi?: string
  options_mn: string[]
  options_en?: string[]
  options_ru?: string[]
  options_hi?: string[]
  correct_option_idx: number
  is_used: boolean
  translation_status: TranslationStatus
  created_at: string
}

export interface ReferralTicket {
  id: number
  tier: QuestionTier
  is_used: boolean
  created_at: string
}

export interface ReferralMilestone {
  count: number
  tier: string
}

export interface ReferralInfo {
  referral_code: string | null
  referral_link: string
  active_referral_count: number
  lifetime_earnings: number
  tickets: ReferralTicket[]
  next_milestone: ReferralMilestone | null
}

export interface JackpotInfo {
  jackpot_balance: number
  monthly_bonus_balance: number
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
          start_param?: string
        }
        ready(): void
        expand(): void
        close(): void
        openInvoice(url: string, callback?: (status: string) => void): void
      }
    }
  }
}
