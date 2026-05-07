import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMemo } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authApi } from '@/api/auth'
import { TrendingUp } from 'lucide-react'

export default function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const schema = useMemo(
    () =>
      z.object({
        email: z.string().email(t('auth.register.errors.email')),
        username: z.string().min(3, t('auth.register.errors.username')),
        full_name: z.string().optional(),
        password: z.string().min(6, t('auth.register.errors.password')),
      }),
    [t],
  )
  type FormData = z.infer<typeof schema>

  const FIELDS = useMemo(
    () => [
      {
        name: 'email' as const,
        label: t('auth.register.fields.email.label'),
        type: 'email',
        placeholder: t('auth.register.fields.email.placeholder'),
      },
      {
        name: 'username' as const,
        label: t('auth.register.fields.username.label'),
        type: 'text',
        placeholder: t('auth.register.fields.username.placeholder'),
      },
      {
        name: 'full_name' as const,
        label: t('auth.register.fields.fullName.label'),
        type: 'text',
        placeholder: t('auth.register.fields.fullName.placeholder'),
      },
      {
        name: 'password' as const,
        label: t('auth.register.fields.password.label'),
        type: 'password',
        placeholder: t('auth.register.fields.password.placeholder'),
      },
    ],
    [t],
  )

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const { mutate, isPending, error } = useMutation({
    mutationFn: (data: FormData) => authApi.register(data),
    onSuccess: () => navigate('/login'),
  })

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
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
          <h1 className="text-2xl font-black text-ink-100">{t('auth.register.title')}</h1>
          <p className="text-sm text-ink-600 mt-1">{t('auth.register.subtitle')}</p>
        </div>

        <div className="card border-gradient p-6">
          <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
            {FIELDS.map(({ name, label, type, placeholder }) => (
              <div key={name}>
                <label className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2 block">
                  {label}
                </label>
                <input
                  {...register(name)}
                  type={type}
                  placeholder={placeholder}
                  className="input-dark"
                />
                {errors[name] && (
                  <p className="text-xs text-no mt-1.5">{errors[name]?.message}</p>
                )}
              </div>
            ))}

            {error && (
              <div className="bg-no/10 border border-no/30 rounded-xl px-4 py-3">
                <p className="text-xs text-no">{t('auth.register.errors.failed')}</p>
              </div>
            )}

            <button type="submit" disabled={isPending} className="btn-primary w-full py-3 mt-2">
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
                  {t('auth.register.submitting')}
                </span>
              ) : (
                t('auth.register.submit')
              )}
            </button>
          </form>
        </div>

        <p className="text-sm text-center text-ink-600 mt-6">
          {t('auth.register.hasAccount')}{' '}
          <Link
            to="/login"
            className="text-brand-cyan hover:text-white transition-colors font-semibold"
          >
            {t('auth.register.signIn')}
          </Link>
        </p>
      </div>
    </div>
  )
}
