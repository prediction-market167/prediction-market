import apiClient from './client'

export interface LeaderboardEntry {
  rank: number
  username: string
  contest_count: number
  total_winnings: number
}

const leaderboardApi = {
  get: (tier: string) =>
    apiClient.get<LeaderboardEntry[]>('/leaderboard', { params: { tier } }).then(r => r.data),
  weekly: (tier: string) =>
    apiClient.get<LeaderboardEntry[]>('/leaderboard/weekly', { params: { tier } }).then(r => r.data),
}

export default leaderboardApi
