import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AuthLayout from './AuthLayout.jsx'
import CodeInput from '../../components/auth/CodeInput.jsx'
import { useAuth } from '../../context/AuthContext.jsx'

const RESEND_SECONDS = 45

export default function VerifyCodePage() {
  const navigate = useNavigate()
  const { pendingSignup, verifyCode, resendCode } = useAuth()

  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS)

  useEffect(() => {
    if (secondsLeft <= 0) return
    const timer = setInterval(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearInterval(timer)
  }, [secondsLeft])

  if (!pendingSignup) {
    return <Navigate to="/signup" replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (isSubmitting) return
    setError(null)
    setIsSubmitting(true)
    try {
      await verifyCode(code)
      navigate('/setup-profile')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResend() {
    if (isResending) return
    setError(null)
    setIsResending(true)
    try {
      await resendCode()
      setCode('')
      setSecondsLeft(RESEND_SECONDS)
    } finally {
      setIsResending(false)
    }
  }

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={
        <>
          We sent a 6-digit code to <span className="font-semibold text-cream">{pendingSignup.email}</span>
        </>
      }
      footer={
        <>
          Wrong email?{' '}
          <Link to="/signup" className="font-semibold text-ember-light hover:underline">
            Sign up again
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        )}

        <CodeInput value={code} onChange={setCode} />

        <button
          type="submit"
          disabled={isSubmitting || code.length !== 6}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-ember px-6 py-3 text-sm font-semibold text-cream shadow-md shadow-ember/25 transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Verifying...' : 'Verify'}
        </button>

        <p className="text-center text-sm text-muted">
          Didn&apos;t get a code?{' '}
          {secondsLeft > 0 ? (
            <span className="font-medium text-muted/80">Resend in {secondsLeft}s</span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="font-semibold text-ember-light hover:underline disabled:opacity-60"
            >
              {isResending ? 'Sending...' : 'Resend code'}
            </button>
          )}
        </p>
      </form>
    </AuthLayout>
  )
}
