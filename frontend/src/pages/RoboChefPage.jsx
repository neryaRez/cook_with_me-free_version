import { useCallback, useEffect, useState } from 'react'
import ChatInterface from '../components/ChatInterface.jsx'
import ConversationList from '../components/ConversationList.jsx'
import { ChefHatIcon, SparklesIcon, PlusIcon } from '../components/icons.jsx'
import {
  USE_REAL_API,
  getConversations,
  createConversation,
  renameConversation,
  deleteConversation,
} from '../services/api.js'

function sortByUpdatedAtDesc(conversations) {
  return [...conversations].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}

// A standalone primary action, deliberately separate from the conversation
// list panel below it so it reads as its own action rather than a control
// embedded inside the picker. Full-width in the desktop sidebar (where a
// filled column-width button reads naturally); compact and inline on
// mobile, where a full-width bar would feel oversized in a small row.
function NewConversationButton({ label, onClick, isCreating, fullWidth = true }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isCreating}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full bg-ember px-5 py-2.5 text-sm font-semibold text-cream shadow-lg shadow-ember/20 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 ${
        fullWidth ? 'w-full' : 'w-auto'
      }`}
    >
      <PlusIcon className="h-4 w-4" />
      {isCreating ? 'Creating...' : label}
    </button>
  )
}

export default function RoboChefPage() {
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [isLoadingList, setIsLoadingList] = useState(USE_REAL_API)
  const [listError, setListError] = useState(null)
  const [isCreating, setIsCreating] = useState(false)

  const loadConversations = useCallback(() => {
    if (!USE_REAL_API) return

    setIsLoadingList(true)
    setListError(null)
    getConversations()
      .then((data) => {
        setConversations(data)
        setActiveId((current) => current ?? data[0]?.id ?? null)
      })
      .catch(() => setListError('Could not load your conversations right now.'))
      .finally(() => setIsLoadingList(false))
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  function upsertConversation(updated) {
    setConversations((prev) => sortByUpdatedAtDesc([updated, ...prev.filter((c) => c.id !== updated.id)]))
  }

  async function handleCreate() {
    if (isCreating) return
    setIsCreating(true)
    setListError(null)
    try {
      const conversation = await createConversation()
      setConversations((prev) => [conversation, ...prev])
      setActiveId(conversation.id)
    } catch {
      setListError('Could not start a new conversation. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  function handleSelect(id) {
    setActiveId(id)
  }

  async function handleRename(id, title) {
    const updated = await renameConversation(id, title)
    upsertConversation(updated)
  }

  async function handleDelete(id) {
    await deleteConversation(id)
    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== id)
      if (activeId === id) setActiveId(remaining[0]?.id ?? null)
      return remaining
    })
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-ember/15 text-ember-light">
          <ChefHatIcon className="h-7 w-7" />
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold text-cream sm:text-4xl">Robo Chef</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
          Your AI sous-chef. Ask about ingredient swaps, techniques, timings,
          or describe what&apos;s in your fridge for instant recipe ideas.
        </p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-ember/10 px-3 py-1 text-xs font-medium text-ember-light">
          <SparklesIcon className="h-3.5 w-3.5" />
          {USE_REAL_API ? 'Connected to the Cook With Me backend' : 'Responses are simulated for this preview'}
        </span>
      </div>

      {!USE_REAL_API ? (
        <div className="mt-8 h-[36rem] overflow-hidden rounded-3xl border border-border-subtle/70 bg-card shadow-xl shadow-black/20">
          <ChatInterface />
        </div>
      ) : (
        <>
          <div className="mt-8 space-y-2 lg:hidden">
            <div className="flex justify-end">
              <NewConversationButton label="New chat" onClick={handleCreate} isCreating={isCreating} fullWidth={false} />
            </div>
            <div className="overflow-hidden rounded-2xl border border-border-subtle/70 bg-card shadow-xl shadow-black/20">
              <ConversationList
                conversations={conversations}
                activeId={activeId}
                isLoading={isLoadingList}
                error={listError}
                onSelect={handleSelect}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:mt-8 lg:grid-cols-[18rem_1fr]">
            <div className="hidden lg:flex lg:flex-col lg:gap-3 lg:self-start">
              <NewConversationButton label="New conversation" onClick={handleCreate} isCreating={isCreating} />
              <div className="overflow-hidden rounded-3xl border border-border-subtle/70 bg-card shadow-xl shadow-black/20">
                <ConversationList
                  conversations={conversations}
                  activeId={activeId}
                  isLoading={isLoadingList}
                  error={listError}
                  onSelect={handleSelect}
                  onRename={handleRename}
                  onDelete={handleDelete}
                />
              </div>
            </div>

            <div className="h-[36rem] overflow-hidden rounded-3xl border border-border-subtle/70 bg-card shadow-xl shadow-black/20">
              {activeId ? (
                <ChatInterface conversationId={activeId} onConversationUpdated={upsertConversation} />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ember/15 text-ember-light">
                    <ChefHatIcon className="h-6 w-6" />
                  </span>
                  <p className="text-sm text-muted">
                    {isLoadingList ? 'Loading...' : 'Start a new conversation to chat with Robo Chef.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
