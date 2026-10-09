import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import { supabase } from './supabaseClient'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import type { Session } from '@supabase/supabase-js'

const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const FeaturesPage = lazy(() => import('./pages/FeaturesPage'))
const PricingPage = lazy(() => import('./pages/PricingPage'))
const ApiPage = lazy(() => import('./pages/ApiPage'))
const SecurityPage = lazy(() => import('./pages/SecurityPage'))
const SignPage = lazy(() => import('./pages/SignPage'))
const FirmaPage = lazy(() => import('./pages/FirmaPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const VerifyPage = lazy(() => import('./pages/VerifyPage'))
const ApprovePage = lazy(() => import('./pages/ApprovePage'))

function ProtectedRoute({ session, children }: { session: Session | null; children: React.ReactNode }) {
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PageLoader() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <PageLoader />
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/dashboard" element={
          <ProtectedRoute session={session}>
            <DashboardPage session={session!} />
          </ProtectedRoute>
        } />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/api" element={<ApiPage />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/sign/:token" element={<SignPage />} />
        <Route path="/firma/:token" element={<FirmaPage />} />
        {/* 09/10/2026: link corto del messaggio WhatsApp, stessa pagina */}
        <Route path="/f/:token" element={<FirmaPage />} />
        <Route path="/verify/:hash" element={<VerifyPage />} />
        <Route path="/approve/:token" element={<ApprovePage />} />
      </Routes>
    </Suspense>
  )
}
