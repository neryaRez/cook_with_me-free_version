import { useState } from 'react'
import { createComment, updateComment, deleteComment } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { SendIcon, PencilIcon, TrashIcon } from './icons.jsx'

export default function CommentSection({
  recipeId,
  comments,
  onCommentAdded,
  onCommentUpdated,
  onCommentDeleted,
}) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [editError, setEditError] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || isSubmitting) return

    setIsSubmitting(true)
    setActionError(null)
    try {
      const newComment = await createComment(recipeId, { text: trimmed })
      onCommentAdded(newComment)
      setText('')
    } catch (err) {
      setActionError(err.message || 'Failed to post comment.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function startEdit(comment) {
    setEditingId(comment.id)
    setEditText(comment.text)
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditText('')
    setEditError(null)
  }

  async function handleSaveEdit(commentId) {
    const trimmed = editText.trim()
    if (!trimmed) {
      setEditError('Comment cannot be empty.')
      return
    }
    setSavingId(commentId)
    setEditError(null)
    try {
      const updated = await updateComment(recipeId, commentId, { text: trimmed })
      onCommentUpdated(updated)
      setEditingId(null)
    } catch (err) {
      setEditError(err.message || 'Failed to update comment.')
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(commentId) {
    if (!window.confirm('Delete this comment?')) return
    setActionError(null)
    setDeletingId(commentId)
    try {
      await deleteComment(recipeId, commentId)
      onCommentDeleted(commentId)
    } catch (err) {
      setActionError(err.message || 'Failed to delete comment.')
    } finally {
      setDeletingId(null)
    }
  }

  const authorInitial = user
    ? (user.displayName || user.username || 'Y').charAt(0).toUpperCase()
    : 'Y'

  return (
    <div className="space-y-5">
      <h2 className="font-display text-xl font-bold text-cream">
        Comments <span className="text-muted">({comments.length})</span>
      </h2>

      <form onSubmit={handleSubmit} className="flex items-start gap-3">
        <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ember/15 text-sm font-semibold text-ember-light">
          {authorInitial}
        </span>
        <div className="flex-1">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Share a tip, a tweak, or how it turned out..."
            rows={2}
            className="w-full resize-none rounded-2xl border border-border-subtle/70 bg-surface px-4 py-3 text-sm text-cream placeholder:text-muted/70 outline-none focus:border-ember/50 focus:ring-2 focus:ring-ember/20"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !text.trim()}
              className="flex items-center gap-2 rounded-full bg-ember px-4 py-2 text-sm font-semibold text-cream transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <SendIcon className="h-4 w-4" />
              {isSubmitting ? 'Posting...' : 'Post comment'}
            </button>
          </div>
        </div>
      </form>

      {actionError && <p className="text-xs text-red-400">{actionError}</p>}

      <div className="space-y-4">
        {comments.length === 0 && (
          <p className="text-sm text-muted">No comments yet - be the first to share your thoughts.</p>
        )}
        {comments
          .slice()
          .reverse()
          .map((comment) => {
            const displayName = comment.authorName || comment.author || 'Chef'
            const displayDate = comment.createdAt
              ? comment.createdAt.slice(0, 10)
              : comment.date
            const isOwn = user && comment.authorSub && comment.authorSub === user.sub
            const isEditing = editingId === comment.id

            return (
              <div key={comment.id} className="flex items-start gap-3">
                <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-sm font-semibold text-cream">
                  {displayName.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 rounded-2xl border border-border-subtle/70 bg-surface px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-cream">{displayName}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted">{displayDate}</p>
                      {isOwn && !isEditing && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(comment)}
                            disabled={deletingId === comment.id}
                            className="text-muted transition-colors hover:text-cream disabled:opacity-40"
                            aria-label="Edit comment"
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(comment.id)}
                            disabled={deletingId === comment.id}
                            className="text-muted transition-colors hover:text-red-400 disabled:opacity-40"
                            aria-label="Delete comment"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={2}
                        className="w-full resize-none rounded-xl border border-border-subtle/70 bg-card px-3 py-2 text-sm text-cream outline-none focus:border-ember/50 focus:ring-2 focus:ring-ember/20"
                      />
                      {editError && <p className="text-xs text-red-400">{editError}</p>}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(comment.id)}
                          disabled={savingId === comment.id}
                          className="rounded-full bg-ember px-3 py-1 text-xs font-semibold text-cream hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {savingId === comment.id ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={savingId === comment.id}
                          className="rounded-full border border-border-subtle/70 px-3 py-1 text-xs text-muted hover:text-cream disabled:opacity-40"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm leading-relaxed text-muted">{comment.text}</p>
                  )}
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
