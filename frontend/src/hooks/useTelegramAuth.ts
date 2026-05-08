import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from './useStore'
import { setToken, setUser } from '@/store/slices/authSlice'
import { authApi } from '@/api/auth'

export function useTelegramAuth() {
  const dispatch = useAppDispatch()
  const token = useAppSelector((s) => s.auth.token)
  const [loading, setLoading] = useState(true)
  const [isTelegram, setIsTelegram] = useState(false)

  useEffect(() => {
    const twa = window.Telegram?.WebApp

    if (!twa?.initData) {
      setLoading(false)
      setIsTelegram(false)
      return
    }

    setIsTelegram(true)
    twa.ready()
    twa.expand()

    // If we already have a token, fetch user profile and we're done
    if (token) {
      authApi.me()
        .then((user) => dispatch(setUser(user)))
        .catch(() => {/* stale token — will re-auth on next load */})
        .finally(() => setLoading(false))
      return
    }

    // Extract referral code from deep-link start_param (e.g. "ref_abc123")
    const startParam = twa.initDataUnsafe?.start_param ?? ''
    const ref = startParam.startsWith('ref_') ? startParam.slice(4) : null

    authApi
      .telegramLogin(twa.initData, ref)
      .then((t) => {
        dispatch(setToken(t.access_token))
        return authApi.me()
      })
      .then((user) => dispatch(setUser(user)))
      .catch(console.error)
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])  // run once on mount only

  return { loading, isTelegram }
}
