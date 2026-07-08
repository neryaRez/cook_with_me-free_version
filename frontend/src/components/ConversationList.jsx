import { useState } from 'react'
import { ChevronDownIcon, PencilIcon, TrashIcon, ChefHatIcon } from './icons.jsx'
import { formatRelativeTime } from '../utils/time.js'
import Loader from './Loader.jsx'

export default function ConversationList({
  conversations,
  activeId,
  isLoading,
  error,
  onSelect,
  onRename,
  onDelete,
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  function startEdit(conversation) {
    setEditingId(conversation.id)
    setEditTitle(conversation.title)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditTitle('')
  }

  async function handleSaveEdit(conversationId) {
    const trimmed = editTitle.trim()
    if (!trimmed) return

    setSavingId(conversationId)
    try {
      await onRename(conversationId, trimmed)
      setEditingId(null)
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(conversation) {
    if (!window.confirm(`Delete "${conversation.title}"? This cannot be undone.`)) return

    setDeletingId(conversation.id)
    try {
      await onDelete(conversation.id)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between gap-2 border-b border-border-subtle/70 px-3 py-2.5 text-xs text-muted transition-colors hover:text-cream"
      >
        <span>Pick up where you left off.</span>
        <ChevronDownIcon
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {isExpanded && (
        <div className="max-h-64 overflow-y-auto p-2">
          {isLoading && (
            <div className="py-8">
              <Loader label="Loading conversations..." />
            </div>
          )}

          {!isLoading && error && <p className="p-3 text-xs text-red-400">{error}</p>}

          {!isLoading && !error && conversations.length === 0 && (
            <div className="px-3 py-8 text-center">
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-ember/15 text-ember-light">
                <ChefHatIcon className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm text-muted">
                No conversations yet — start one to get cooking advice that remembers your preferences.
              </p>
            </div>
          )}

          {!isLoading &&
            !error &&
            conversations.map((conversation) => {
              const isActive = conversation.id === activeId
              const isEditing = editingId === conversation.id
              const isDeleting = deletingId === conversation.id

              return (
                <div
                  key={conversation.id}
                  className={`mb-1 rounded-xl border px-3 py-2.5 transition-colors ${
                    isActive
                      ? 'border-ember/40 bg-ember/10'
                      : 'border-transparent hover:border-border-subtle/70 hover:bg-surface'
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        autoFocus
                        maxLength={120}
                        className="w-full rounded-lg border border-border-subtle/70 bg-card px-2 py-1.5 text-sm text-cream outline-none focus:border-ember/50"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(conversation.id)}
                          disabled={savingId === conversation.id}
                          className="rounded-full bg-ember px-3 py-1 text-xs font-semibold text-cream hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {savingId === conversation.id ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={savingId === conversation.id}
                          className="rounded-full border border-border-subtle/70 px-3 py-1 text-xs text-muted hover:text-cream disabled:opacity-40"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelect(conversation.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') onSelect(conversation.id)
                      }}
                      className="w-full cursor-pointer text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-cream">{conversation.title}</p>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              startEdit(conversation)
                            }}
                            disabled={isDeleting}
                            className="text-muted transition-colors hover:text-cream disabled:opacity-40"
                            aria-label="Rename conversation"
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleDelete(conversation)
                            }}
                            disabled={isDeleting}
                            className="text-muted transition-colors hover:text-red-400 disabled:opacity-40"
                            aria-label="Delete conversation"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {conversation.preview && (
                        <p className="mt-0.5 truncate text-xs text-muted">{conversation.preview}</p>
                      )}
                      <p className="mt-1 text-[11px] text-muted/70">{formatRelativeTime(conversation.updatedAt)}</p>
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
