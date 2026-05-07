import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMemo } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authApi } from '@/api/auth'
import { useAppDispatch } from '@/hooks/useStore'
import { setToken } from '@/store/slices/authSlice'
import { TrendingUp } from 'lucide-react'

export default function LoginPage() {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const schema = useMemo(
    () =>
      z.object({
        email: z.string().email(t('auth.login.emailError')),
        password: z.string().min(6, t('auth.login.passwordError')),
      }),
    [t],
  )
  type FormData = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const { mutate, isPending, error } = useMutation({
    mutationFn: (data: FormData) => authApi.login(data.email, data.password),
    onSuccess: (token) => {
      dispatch(setToken(token.access_token))
      navigate('/')
    },
  })

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background:
          'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0,200,255,0.08) 0%, transparent 55%), #070b14',
      }}
    >
      <div className="w-full max-w-sm animate-slide-up">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gradient-brand rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow-cyan">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-black text-ink-100">{t('auth.login.title')}</h1>
          <p className="text-sm text-ink-600 mt-1">{t('auth.login.subtitle')}</p>
        </div>

        <div className="card border-gradient p-6">
          <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2 block">
                {t('auth.login.email')}
              </label>
              <input
                {...register('email')}
                type="email"
                placeholder={t('auth.login.emailPlaceholder')}
                className="input-dark"
              />
              {errors.email && (
                <p className="text-xs text-no mt-1.5">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2 block">
                {t('auth.login.password')}
              </label>
              <input
                {...register('password')}
                type="password"
                placeholder="••••••••"
                className="input-dark"
              />
              {errors.password && (
                <p className="text-xs text-no mt-1.5">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <div className="bg-no/10 border border-no/30 rounded-xl px-4 py-3">
                <p className="text-xs text-no">{t('auth.login.error')}</p>
              </div>
            )}

            <button type="submit" disabled={isPending} className="btn-primary w-full py-3 mt-2">
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
                  {t('auth.login.submitting')}
                </span>
              ) : (
                t('auth.login.submit')
              )}
            </button>
          </form>
        </div>

        <p className="text-sm text-center text-ink-600 mt-6">
          {t('auth.login.noAccount')}{' '}
          <Link
            to="/register"
            className="text-brand-cyan hover:text-white transition-colors font-semibold"
          >
            {t('auth.login.createOne')}
          </Link>
        </p>
      </div>
    </div>
  )
}
