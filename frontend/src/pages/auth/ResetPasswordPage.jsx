import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import AuthLayout from './AuthLayout.jsx'
import CodeInput from '../../components/auth/CodeInput.jsx'
import PasswordField from '../../components/auth/PasswordField.jsx'
import { useAuth } from '../../context/AuthContext.jsx'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { pendingReset, resetPassword } = useAuth()

  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!pendingReset) {
    return <Navigate to="/forgot-password" replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (isSubmitting) return
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      await resetPassword({ code, password })
      navigate('/login', { state: { resetSuccess: true } })
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Create new password"
      subtitle={
        <>
          Enter the code we sent to <span className="font-semibold text-cream">{pendingReset.email}</span> and
          choose a new password.
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        )}

        <CodeInput value={code} onChange={setCode} />

        <PasswordField
          label="New password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          helperText="Use at least 8 characters."
        />

        <PasswordField
          label="Confirm new password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
        />

        <button
          type="submit"
          disabled={isSubmitting || code.length !== 6}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-ember px-6 py-3 text-sm font-semibold text-cream shadow-md shadow-ember/25 transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Resetting...' : 'Reset password'}
        </button>
      </form>
    </AuthLayout>
  )
}
