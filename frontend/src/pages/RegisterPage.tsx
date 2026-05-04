import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { TrendingUp } from 'lucide-react'

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  full_name: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type FormData = z.infer<typeof schema>

const FIELDS = [
  { name: 'email' as const, label: 'Email', type: 'email', placeholder: 'you@example.com' },
  { name: 'username' as const, label: 'Username', type: 'text', placeholder: 'satoshi' },
  { name: 'full_name' as const, label: 'Full Name', type: 'text', placeholder: 'Optional' },
  { name: 'password' as const, label: 'Password', type: 'password', placeholder: '••••••••' },
]

export default function RegisterPage() {
  const navigate = useNavigate()

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
          <h1 className="text-2xl font-black text-ink-100">Create account</h1>
          <p className="text-sm text-ink-600 mt-1">Start trading predictions today</p>
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
                <p className="text-xs text-no">Failed to create account. Please try again.</p>
              </div>
            )}

            <button type="submit" disabled={isPending} className="btn-primary w-full py-3 mt-2">
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        </div>

        <p className="text-sm text-center text-ink-600 mt-6">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-brand-cyan hover:text-white transition-colors font-semibold"
          >
            Sign in →
          </Link>
        </p>
      </div>
    </div>
  )
}
