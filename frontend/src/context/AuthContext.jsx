import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import * as authService from '../services/authService.js'
import { isCognitoConfigured } from '../services/cognitoClient.js'
import { setIdToken, clearIdToken } from '../services/tokenStore.js'
import { getMe, updateMe } from '../services/api.js'

const AuthContext = createContext(null)

function getInitials(name) {
  const initials = (name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  return initials || '?'
}

function buildUserFromProfile(claims, profile) {
  const displayName = profile?.displayName || claims.name || claims.email?.split('@')[0] || 'Chef'
  return {
    sub: claims.sub,
    email: claims.email,
    displayName,
    username: profile?.username || claims.email?.split('@')[0]?.toLowerCase() || '',
    bio: profile?.bio || '',
    avatarUrl: profile?.avatarUrl || '',
    initials: getInitials(displayName),
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [pendingSignup, setPendingSignup] = useState(null)
  const [pendingReset, setPendingReset] = useState(null)

  async function applySession(session) {
    const claims = authService.claimsFromSession(session)
    const { idToken } = authService.tokensFromSession(session)
    setIdToken(idToken)

    let profile = null
    try {
      profile = await getMe()
    } catch {
      profile = null
    }

    setUser(buildUserFromProfile(claims, profile))
  }

  useEffect(() => {
    // Read-only session restore. Guarded against StrictMode's double-invoke
    // in dev so a stale second invocation can't overwrite a newer result.
    // No signIn/signUp call ever lives in an effect - only in form handlers.
    let isActive = true

    if (!isCognitoConfigured) {
      setIsAuthLoading(false)
      return
    }

    authService
      .getCurrentSession()
      .then((session) => {
        if (!isActive || !session) return
        return applySession(session)
      })
      .catch(() => {
        if (isActive) {
          setUser(null)
          clearIdToken()
        }
      })
      .finally(() => {
        if (isActive) setIsAuthLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [])

  async function signIn({ email, password }) {
    const session = await authService.signIn({ email, password })
    await applySession(session)
  }

  async function signUp({ name, email, password }) {
    await authService.signUp({ email, password, name })
    setPendingSignup({ name, email, password })
  }

  async function verifyCode(code) {
    if (!pendingSignup) throw new Error('Your session expired. Please sign up again.')
    await authService.confirmSignUp(pendingSignup.email, code)
    const session = await authService.signIn({
      email: pendingSignup.email,
      password: pendingSignup.password,
    })
    await applySession(session)
    setPendingSignup((prev) => (prev ? { ...prev, password: null, verified: true } : prev))
  }

  async function resendCode() {
    if (!pendingSignup) throw new Error('Your session expired. Please sign up again.')
    await authService.resendConfirmationCode(pendingSignup.email)
  }

  async function updateProfile(payload) {
    const profile = await updateMe(payload)
    setUser((prev) => (prev ? buildUserFromProfile({ sub: prev.sub, email: prev.email }, profile) : prev))
  }

  async function completeProfile(payload) {
    await updateProfile(payload)
    setPendingSignup(null)
  }

  function skipProfile() {
    setPendingSignup(null)
  }

  async function forgotPassword(email) {
    await authService.forgotPassword(email)
    setPendingReset({ email })
  }

  async function resetPassword({ code, password }) {
    if (!pendingReset) throw new Error('Your session expired. Please request a new code.')
    await authService.confirmForgotPassword({ email: pendingReset.email, code, password })
    setPendingReset(null)
  }

  function logout() {
    authService.signOut()
    clearIdToken()
    setUser(null)
  }

  const value = useMemo(
    () => ({
      user,
      isAuthLoading,
      pendingSignup,
      pendingReset,
      isCognitoConfigured,
      signIn,
      signUp,
      verifyCode,
      resendCode,
      completeProfile,
      skipProfile,
      updateProfile,
      forgotPassword,
      resetPassword,
      logout,
    }),
    [user, isAuthLoading, pendingSignup, pendingReset]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
