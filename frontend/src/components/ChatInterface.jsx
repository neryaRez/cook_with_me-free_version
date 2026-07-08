import { useState, useRef, useEffect } from 'react'
import { askRoboChef, getConversation, sendConversationMessage, retryConversationMessage } from '../services/api.js'
import { SendIcon, SparklesIcon, ChefHatIcon } from './icons.jsx'

const STARTER_PROMPTS = [
  'What can I substitute for eggs?',
  'Give me a quick vegan dinner idea',
  'How do I store leftover pasta?',
  'How can I make this dish spicier?',
]

const INITIAL_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  text: "Hi, I'm Robo Chef! Ask me about ingredient swaps, techniques, storage tips, or what to cook with what you have on hand.",
}

function messageFromServer(message) {
  return { id: message.id, role: message.role, text: message.content }
}

export default function ChatInterface({ compact = false, conversationId = null, onConversationUpdated }) {
  const [messages, setMessages] = useState([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [hasPendingReply, setHasPendingReply] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isThinking])

  useEffect(() => {
    if (!conversationId) {
      setMessages([INITIAL_MESSAGE])
      setHasPendingReply(false)
      setLoadError(null)
      return
    }

    let isMounted = true
    setIsLoadingMessages(true)
    setLoadError(null)
    setHasPendingReply(false)

    getConversation(conversationId)
      .then((data) => {
        if (!isMounted) return
        const serverMessages = data.messages || []
        setMessages(serverMessages.length > 0 ? serverMessages.map(messageFromServer) : [INITIAL_MESSAGE])
        const last = serverMessages[serverMessages.length - 1]
        setHasPendingReply(Boolean(last && last.role === 'user'))
      })
      .catch(() => {
        if (isMounted) setLoadError("Could not load this conversation.")
      })
      .finally(() => {
        if (isMounted) setIsLoadingMessages(false)
      })

    return () => {
      isMounted = false
    }
  }, [conversationId])

  async function sendPersistentMessage(text) {
    const optimisticId = `local-${Date.now()}`
    setMessages((prev) => [...prev, { id: optimisticId, role: 'user', text }])
    setIsThinking(true)
    setHasPendingReply(false)

    try {
      const result = await sendConversationMessage(conversationId, text)
      setMessages((prev) => [
        ...prev.filter((message) => message.id !== optimisticId),
        messageFromServer(result.userMessage),
        messageFromServer(result.assistantMessage),
      ])
      onConversationUpdated?.(result.conversation)
    } catch (err) {
      // On an OpenAI failure (502) the backend persisted our user message
      // and returns it - swap the optimistic bubble for the real one. On a
      // pending-conflict (409) nothing new was persisted (a reply is
      // already pending from an earlier message), so there is nothing to
      // swap it for - drop the optimistic bubble entirely rather than
      // re-adding a fake one that doesn't correspond to anything saved.
      const savedUserMessage = err.data?.userMessage
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((message) => message.id !== optimisticId)
        return savedUserMessage ? [...withoutOptimistic, messageFromServer(savedUserMessage)] : withoutOptimistic
      })
      setHasPendingReply(true)
      if (err.data?.conversation) onConversationUpdated?.(err.data.conversation)
    } finally {
      setIsThinking(false)
    }
  }

  async function sendLocalMessage(text) {
    const userMessage = { id: `u-${messages.length}`, role: 'user', text }
    setMessages((prev) => [...prev, userMessage])
    setIsThinking(true)

    try {
      const { reply } = await askRoboChef({ message: text })
      setMessages((prev) => [...prev, { id: `a-${prev.length}`, role: 'assistant', text: reply }])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${prev.length}`,
          role: 'assistant',
          text: "Sorry, I'm having trouble responding right now. Please try again in a moment.",
        },
      ])
    } finally {
      setIsThinking(false)
    }
  }

  async function sendMessage(text) {
    const trimmed = text.trim()
    if (!trimmed || isThinking || isRetrying || hasPendingReply) return

    setInput('')

    if (conversationId) {
      await sendPersistentMessage(trimmed)
    } else {
      await sendLocalMessage(trimmed)
    }
  }

  async function handleRetry() {
    if (isRetrying || isThinking || !conversationId) return

    setIsRetrying(true)
    try {
      const result = await retryConversationMessage(conversationId)
      setMessages((prev) => [...prev, messageFromServer(result.assistantMessage)])
      setHasPendingReply(false)
      onConversationUpdated?.(result.conversation)
    } catch {
      setHasPendingReply(true)
    } finally {
      setIsRetrying(false)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (isThinking || isRetrying || hasPendingReply) return
    sendMessage(input)
  }

  // While a reply is pending (an earlier message failed or hit a 409
  // conflict), sending is disabled in favor of Retry - this both matches
  // what the backend already enforces server-side and avoids ever
  // triggering that 409 from the normal send flow.
  const isBusy = isThinking || isRetrying || hasPendingReply

  return (
    <div className="flex h-full flex-col">
      <div
        ref={scrollRef}
        className={`flex-1 space-y-4 overflow-y-auto ${compact ? 'p-4' : 'p-6'}`}
      >
        {isLoadingMessages && (
          <div className="flex items-center justify-center py-8 text-sm text-muted">Loading conversation...</div>
        )}

        {!isLoadingMessages && loadError && (
          <p className="text-center text-sm text-red-400">{loadError}</p>
        )}

        {!isLoadingMessages &&
          !loadError &&
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start gap-2.5 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ember/15 text-ember-light">
                  <ChefHatIcon className="h-4 w-4" />
                </span>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'bg-ember text-cream'
                    : 'border border-border-subtle/70 bg-surface text-cream'
                }`}
              >
                {message.text}
              </div>
            </div>
          ))}

        {!isLoadingMessages && !loadError && isThinking && (
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ember/15 text-ember-light">
              <ChefHatIcon className="h-4 w-4" />
            </span>
            <div className="flex items-center gap-1 rounded-2xl border border-border-subtle/70 bg-surface px-4 py-3">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
            </div>
          </div>
        )}

        {!isLoadingMessages && !loadError && !isThinking && hasPendingReply && (
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ember/15 text-ember-light">
              <ChefHatIcon className="h-4 w-4" />
            </span>
            <div className="flex items-center gap-3 rounded-2xl border border-border-subtle/70 bg-surface px-4 py-2.5 text-sm text-muted">
              Robo Chef couldn&apos;t reply.
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="font-semibold text-ember-light transition-colors hover:text-ember disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isRetrying ? 'Retrying...' : 'Retry'}
              </button>
            </div>
          </div>
        )}

        {!isLoadingMessages && !loadError && messages.length === 1 && !isThinking && !hasPendingReply && (
          <div className="grid gap-2 pt-2 sm:grid-cols-2">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => sendMessage(prompt)}
                className="flex items-center gap-2 rounded-xl border border-border-subtle/70 bg-surface px-3 py-2.5 text-left text-xs text-muted transition-colors hover:border-ember/40 hover:text-cream"
              >
                <SparklesIcon className="h-3.5 w-3.5 shrink-0 text-ember-light" />
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-border-subtle/70 p-3">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={isBusy}
          placeholder={
            hasPendingReply
              ? 'Retry the pending reply above to continue...'
              : 'Ask Robo Chef anything about cooking...'
          }
          className="flex-1 rounded-full border border-border-subtle/70 bg-surface px-4 py-2.5 text-sm text-cream placeholder:text-muted/70 outline-none focus:border-ember/50 focus:ring-2 focus:ring-ember/20 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isBusy || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ember text-cream transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendIcon className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}
