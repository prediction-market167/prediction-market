import apiClient from './client'
import type { Token, User } from '@/types'

export const authApi = {
  login: (email: string, password: string) => {
    const form = new URLSearchParams()
    form.append('username', email)
    form.append('password', password)
    return apiClient
      .post<Token>('/auth/login', form, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .then((r) => r.data)
  },

  register: (data: { email: string; username: string; password: string; full_name?: string }) =>
    apiClient.post<User>('/auth/register', data).then((r) => r.data),

  me: () => apiClient.get<User>('/users/me').then((r) => r.data),

  telegramLogin: (initData: string, ref?: string | null) =>
    apiClient
      .post<Token>('/auth/telegram', { init_data: initData }, { params: ref ? { ref } : {} })
      .then((r) => r.data),
}
