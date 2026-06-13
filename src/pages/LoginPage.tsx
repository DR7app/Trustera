import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [showResend, setShowResend] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)

  useEffect(() => {
    if (searchParams.get('verified') === 'true') {
      toast.success('Email confermata! Ora puoi accedere.')
    }
    const error = searchParams.get('error')
    if (error) {
      toast.error(error)
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      if (isSignUp) {
        const res = await fetch('/.netlify/functions/dr7trust-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, fullName })
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Errore nella registrazione')
        }

        toast.success('Account creato! Controlla la tua email per confermare.')
        setIsSignUp(false)
        setPassword('')
        setFullName('')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          if (error.message === 'Email not confirmed') {
            setShowResend(true)
            throw new Error('Email non confermata. Controlla la tua casella di posta.')
          }
          throw error
        }
        navigate('/dashboard')
      }
    } catch (error: any) {
      toast.error(error.message || 'Errore di autenticazione')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center px-5 py-10">

      {/* Card */}
      <div
        className="w-full max-w-[400px] rounded-3xl p-8 sm:p-10"
        style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          boxShadow: '0 8px 60px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link to="/">
            <img
              src="/dr7trust-logo.png"
              alt="DR7 Trust"
              className="h-14 w-auto"
            />
          </Link>
        </div>

        {/* Title */}
        <h1 className="text-center text-[26px] sm:text-[28px] font-semibold tracking-tight text-gray-900 mb-1">
          {isSignUp ? 'Crea Account' : 'Log in'}
        </h1>
        <p className="text-center text-[15px] text-gray-400 mb-8 leading-snug">
          {isSignUp
            ? 'Registrati per iniziare a firmare'
            : 'Accedi al tuo account DR7 Trust'}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Full name — signup only */}
          {isSignUp && (
            <div>
              <label className="block text-[13px] font-medium text-gray-500 mb-1.5 tracking-wide uppercase">
                Nome e Cognome
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3 text-[16px] text-gray-900 placeholder-gray-300 outline-none transition-all focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                placeholder="Mario Rossi"
                required
                autoComplete="name"
              />
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-[13px] font-medium text-gray-500 mb-1.5 tracking-wide uppercase">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3 text-[16px] text-gray-900 placeholder-gray-300 outline-none transition-all focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
              placeholder="nome@email.com"
              required
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-[13px] font-medium text-gray-500 mb-1.5 tracking-wide uppercase">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3 pr-12 text-[16px] text-gray-900 placeholder-gray-300 outline-none transition-all focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                placeholder={isSignUp ? 'Min. 6 caratteri' : '••••••••'}
                required
                minLength={6}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-gray-350 hover:text-gray-600 transition-colors rounded-md"
                tabIndex={-1}
                aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#16a34a] text-white font-semibold text-[16px] py-3.5 transition-all hover:bg-[#15803d] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
          >
            {loading
              ? <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Caricamento...
                </span>
              : isSignUp ? 'Registrati' : 'Log in'}
          </button>
        </form>

        {/* Forgot password link */}
        {!isSignUp && !showForgot && (
          <button
            type="button"
            onClick={() => { setShowForgot(true); setForgotEmail(email) }}
            className="block w-full text-center text-[13px] text-gray-400 hover:text-green-600 transition-colors mt-4"
          >
            Password dimenticata?
          </button>
        )}

        {/* Forgot password form */}
        {showForgot && !isSignUp && (
          <div className="mt-5 p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <p className="text-[14px] text-gray-700 font-medium mb-3">Recupera password</p>
            <input
              type="email"
              value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[15px] text-gray-900 placeholder-gray-300 outline-none transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/20 mb-3"
              placeholder="La tua email"
            />
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!forgotEmail) { toast.error('Inserisci la tua email'); return }
                  setForgotLoading(true)
                  try {
                    const res = await fetch('/.netlify/functions/dr7trust-reset-password', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: forgotEmail })
                    })
                    const data = await res.json()
                    if (res.ok) {
                      toast.success(data.message || 'Email inviata!')
                      setShowForgot(false)
                    } else {
                      toast.error(data.error || "Errore nell'invio")
                    }
                  } catch {
                    toast.error("Errore nell'invio dell'email")
                  } finally {
                    setForgotLoading(false)
                  }
                }}
                disabled={forgotLoading}
                className="flex-1 rounded-xl bg-[#16a34a] text-white font-semibold py-2.5 text-[14px] transition-all hover:bg-[#15803d] active:scale-[0.98] disabled:opacity-40"
              >
                {forgotLoading ? 'Invio...' : 'Invia link'}
              </button>
              <button
                onClick={() => setShowForgot(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-[14px] hover:bg-gray-100 transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        )}

        {/* Resend verification */}
        {showResend && !isSignUp && (
          <div className="mt-5 p-4 bg-amber-50/80 rounded-2xl border border-amber-200/60 text-center">
            <p className="text-[13px] text-amber-700 mb-2.5">Non hai ricevuto l'email di conferma?</p>
            <button
              onClick={async () => {
                setResendLoading(true)
                try {
                  const res = await fetch('/.netlify/functions/dr7trust-resend-verification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                  })
                  const data = await res.json()
                  if (res.ok) {
                    toast.success(data.message || 'Email inviata!')
                  } else {
                    toast.error(data.error || "Errore nell'invio")
                  }
                } catch {
                  toast.error("Errore nell'invio dell'email")
                } finally {
                  setResendLoading(false)
                }
              }}
              disabled={resendLoading}
              className="text-[13px] text-green-600 font-semibold hover:text-green-700 transition-colors disabled:text-gray-400"
            >
              {resendLoading ? 'Invio in corso...' : 'Reinvia email di conferma'}
            </button>
          </div>
        )}

        {/* Divider */}
        <div className="mt-7 mb-5 flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-[12px] text-gray-300 uppercase tracking-widest">oppure</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Toggle login / signup */}
        <button
          onClick={() => { setIsSignUp(!isSignUp); setShowResend(false); setShowForgot(false) }}
          className="w-full rounded-xl border border-gray-200 bg-white py-3 text-[15px] font-semibold text-gray-700 transition-all hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98]"
        >
          {isSignUp ? 'Hai un account? Log in' : 'Registrati gratis'}
        </button>
      </div>

      {/* Footer */}
      <p className="mt-8 text-[12px] text-gray-300 text-center">
        DR7 Trust - Infrastructure for Digital Trust
      </p>
    </div>
  )
}
