import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from './useStore'
import { setToken, setUser } from '@/store/slices/authSlice'
import { authApi } from '@/api/auth'

export function useTelegramAuth() {
  const dispatch = useAppDispatch()
  const token = useAppSelector((s) => s.auth.token)

  useEffect(() => {
    const twa = window.Telegram?.WebApp
    if (!twa?.initData || token) return

    twa.ready()
    twa.expand()

    authApi
      .telegramLogin(twa.initData)
      .then((t) => {
        dispatch(setToken(t.access_token))
        return authApi.me()
      })
      .then((user) => dispatch(setUser(user)))
      .catch(console.error)
  }, [dispatch, token])
}
