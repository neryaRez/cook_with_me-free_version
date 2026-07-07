import { useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import AuthLayout from './AuthLayout.jsx'
import Field, { inputClass } from '../../components/auth/Field.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { CameraIcon } from '../../components/icons.jsx'
import { requestAvatarUploadUrl } from '../../services/api.js'
import { optimizeAvatarImage } from '../../utils/image.js'

const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_AVATAR_SOURCE_BYTES = 15 * 1024 * 1024 // optimized before upload

export default function SetupProfilePage() {
  const navigate = useNavigate()
  const { user, pendingSignup, completeProfile, updateProfile, skipProfile } = useAuth()
  const fileInputRef = useRef(null)

  const isEditing = Boolean(user) && !pendingSignup
  const sourceName = isEditing ? user.displayName : pendingSignup?.name ?? ''

  const [displayName, setDisplayName] = useState(sourceName)
  const [username, setUsername] = useState(
    isEditing ? user.username : sourceName.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  )
  const [bio, setBio] = useState(isEditing ? user.bio : '')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(isEditing ? user.avatarUrl : '')
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)

  if (!user && !pendingSignup) {
    return <Navigate to="/signup" replace />
  }
  if (pendingSignup && !pendingSignup.verified) {
    return <Navigate to="/verify" replace />
  }

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      setError('Please upload a JPEG, PNG, or WebP image.')
      return
    }

    if (file.size > MAX_AVATAR_SOURCE_BYTES) {
      setError('Image must be 15 MB or smaller.')
      return
    }

    setError(null)
    setUploadStatus('Optimizing photo...')

    try {
      const optimizedFile = await optimizeAvatarImage(file)

      setAvatarFile(optimizedFile)
      setAvatarPreviewUrl((currentUrl) => {
        if (currentUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(currentUrl)
        }
        return URL.createObjectURL(optimizedFile)
      })
    } catch {
      setError('Could not process this image. Please choose another photo.')
    } finally {
      setUploadStatus(null)
      event.target.value = ''
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (isSubmitting) return
    setError(null)

    if (!displayName.trim() || !username.trim()) {
      setError('Please add a display name and username.')
      return
    }

    setIsSubmitting(true)
    try {
      let avatarKey

      if (avatarFile) {
        setUploadStatus('Uploading photo...')
        const { uploadUrl, avatarKey: key, headers } = await requestAvatarUploadUrl({
          contentType: avatarFile.type,
          fileSize: avatarFile.size,
        })
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: avatarFile,
          headers: { 'Content-Type': headers['Content-Type'] },
        })

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload profile photo.')
        }

        avatarKey = key
        setUploadStatus(null)
      }

      const payload = {
        displayName: displayName.trim(),
        username: username.trim(),
        bio: bio.trim(),
      }
      if (avatarKey) payload.avatarKey = avatarKey

      if (isEditing) {
        await updateProfile(payload)
      } else {
        await completeProfile(payload)
      }
      navigate('/')
    } catch (err) {
      setUploadStatus(null)
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleSkip() {
    skipProfile()
    navigate('/')
  }

  const initials = displayName.trim().charAt(0).toUpperCase() || '?'

  return (
    <AuthLayout
      title={isEditing ? 'Edit your profile' : 'Set up your profile'}
      subtitle={
        isEditing ? 'Update how the community sees you.' : 'Tell the community a bit about yourself.'
      }
      footer={
        !isEditing && (
          <button type="button" onClick={handleSkip} className="font-semibold text-ember-light hover:underline">
            Skip for now
          </button>
        )
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        )}

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-ember/15 text-xl font-bold text-ember-light"
          >
            {avatarPreviewUrl ? (
              <img src={avatarPreviewUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-ink/40 text-cream opacity-0 transition-opacity group-hover:opacity-100">
              <CameraIcon className="h-5 w-5" />
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-semibold text-ember-light hover:underline"
          >
            {avatarPreviewUrl ? 'Change photo' : 'Upload photo'}
          </button>
          {uploadStatus && (
            <p className="text-xs text-muted">{uploadStatus}</p>
          )}
        </div>

        <Field label="Display name">
          <input
            type="text"
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Jamie Oliver"
            className={inputClass}
          />
        </Field>

        <Field label="Username">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-muted">
              @
            </span>
            <input
              type="text"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/\s+/g, ''))}
              placeholder="jamiecooks"
              className={`${inputClass} pl-8`}
            />
          </div>
        </Field>

        <Field label="Bio (optional)">
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="Weeknight cook, weekend baker. Always chasing the perfect crust."
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </Field>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-ember px-6 py-3 text-sm font-semibold text-cream shadow-md shadow-ember/25 transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (uploadStatus ?? 'Saving...') : isEditing ? 'Save changes' : 'Finish setup'}
        </button>
      </form>
    </AuthLayout>
  )
}
