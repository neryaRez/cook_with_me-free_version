import { mockRecipes } from '../data/mockRecipes'
import { chatKeywordResponses, defaultChatReply } from '../data/mockChatResponses'
import { getIdToken } from './tokenStore.js'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
export const USE_REAL_API =
  import.meta.env.VITE_USE_REAL_API === 'true' || Boolean(API_BASE_URL)

const MOCK_DELAY_MS = 500

const recipesStore = mockRecipes.map((recipe) => ({
  ...recipe,
  comments: [...recipe.comments],
}))

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const generateId = () => `id-${Date.now()}-${Math.floor(Math.random() * 10000)}`

async function request(path, options = {}) {
  const idToken = getIdToken()
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (idToken) headers.Authorization = `Bearer ${idToken}`

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  let json = null

  try {
    json = await response.json()
  } catch {
    json = null
  }

  if (!response.ok) {
    const message = json?.error || `${response.status} ${response.statusText}`
    throw new Error(`Request failed: ${message}`)
  }

  return json?.data ?? json
}

export async function getRecipes() {
  if (USE_REAL_API) {
    return request('/api/recipes')
  }

  await delay(MOCK_DELAY_MS)
  return recipesStore
}

export async function getRecipeById(id) {
  if (USE_REAL_API) {
    return request(`/api/recipes/${id}`)
  }

  await delay(MOCK_DELAY_MS)
  const recipe = recipesStore.find((item) => item.id === id)

  if (!recipe) {
    throw new Error(`Recipe with id "${id}" not found`)
  }

  return recipe
}

export async function createRecipe(data) {
  if (USE_REAL_API) {
    return request('/api/recipes', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  await delay(MOCK_DELAY_MS)

  const newRecipe = {
    id: generateId(),
    rating: 0,
    comments: [],
    author: data.author ?? { name: 'You', avatar: 'https://i.pravatar.cc/100?img=68' },
    ...data,
  }

  recipesStore.unshift(newRecipe)
  return newRecipe
}

export async function updateRecipe(recipeId, data) {
  if (USE_REAL_API) {
    return request(`/api/recipes/${recipeId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  await delay(MOCK_DELAY_MS)

  const recipe = recipesStore.find((item) => item.id === recipeId)

  if (!recipe) {
    throw new Error(`Recipe with id "${recipeId}" not found`)
  }

  Object.assign(recipe, data)
  return recipe
}


export async function deleteRecipe(recipeId) {
  if (USE_REAL_API) {
    return request(`/api/recipes/${recipeId}`, {
      method: 'DELETE',
    })
  }

  await delay(MOCK_DELAY_MS)

  const recipeIndex = recipesStore.findIndex(
    (item) => String(item.id) === String(recipeId)
  )

  if (recipeIndex === -1) {
    throw new Error(`Recipe with id "${recipeId}" not found`)
  }

  recipesStore.splice(recipeIndex, 1)
  return null
}


export async function createComment(recipeId, data) {
  if (USE_REAL_API) {
    return request(`/api/recipes/${recipeId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  await delay(MOCK_DELAY_MS)

  const recipe = recipesStore.find((item) => item.id === recipeId)

  if (!recipe) {
    throw new Error(`Recipe with id "${recipeId}" not found`)
  }

  const newComment = {
    id: generateId(),
    authorName: data.authorName ?? 'You',
    text: data.text,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  recipe.comments.push(newComment)
  return newComment
}

export async function updateComment(recipeId, commentId, payload) {
  if (USE_REAL_API) {
    return request(`/api/recipes/${recipeId}/comments/${commentId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  await delay(MOCK_DELAY_MS)

  const recipe = recipesStore.find((item) => item.id === recipeId)
  if (!recipe) throw new Error(`Recipe with id "${recipeId}" not found`)
  const comment = recipe.comments.find((c) => c.id === commentId)
  if (!comment) throw new Error('Comment not found')
  comment.text = payload.text
  comment.updatedAt = new Date().toISOString()
  return comment
}

export async function deleteComment(recipeId, commentId) {
  if (USE_REAL_API) {
    return request(`/api/recipes/${recipeId}/comments/${commentId}`, {
      method: 'DELETE',
    })
  }

  await delay(MOCK_DELAY_MS)

  const recipe = recipesStore.find((item) => item.id === recipeId)
  if (!recipe) throw new Error(`Recipe with id "${recipeId}" not found`)
  recipe.comments = recipe.comments.filter((c) => c.id !== commentId)
  return null
}

export async function askRoboChef(data) {
  if (USE_REAL_API) {
    const result = await request('/api/ai/ask', {
      method: 'POST',
      body: JSON.stringify(data),
    })

    return {
      id: generateId(),
      reply: result.answer ?? result.reply ?? 'Robo Chef did not return an answer.',
    }
  }

  await delay(MOCK_DELAY_MS)

  const message = (data.message ?? '').toLowerCase()
  const match = chatKeywordResponses.find((entry) =>
    entry.keywords.some((keyword) => message.includes(keyword))
  )

  return {
    id: generateId(),
    reply: match ? match.reply : defaultChatReply,
  }
}

export async function getConversations() {
  if (!USE_REAL_API) return []
  return request('/api/ai/conversations')
}

export async function createConversation() {
  if (!USE_REAL_API) throw new Error('Conversations are not available in mock mode')
  return request('/api/ai/conversations', { method: 'POST' })
}

export async function getConversation(conversationId) {
  if (!USE_REAL_API) throw new Error('Conversations are not available in mock mode')
  return request(`/api/ai/conversations/${conversationId}`)
}

export async function renameConversation(conversationId, title) {
  if (!USE_REAL_API) throw new Error('Conversations are not available in mock mode')
  return request(`/api/ai/conversations/${conversationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  })
}

export async function deleteConversation(conversationId) {
  if (!USE_REAL_API) throw new Error('Conversations are not available in mock mode')
  return request(`/api/ai/conversations/${conversationId}`, { method: 'DELETE' })
}

export async function sendConversationMessage(conversationId, message) {
  if (!USE_REAL_API) throw new Error('Conversations are not available in mock mode')

  const idToken = getIdToken()
  const headers = { 'Content-Type': 'application/json' }
  if (idToken) headers.Authorization = `Bearer ${idToken}`

  const response = await fetch(`${API_BASE_URL}/api/ai/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message }),
  })

  let json = null
  try {
    json = await response.json()
  } catch {
    json = null
  }

  if (!response.ok) {
    // On an AI failure the backend still returns the persisted user message
    // (see backend/app/routes/ai_conversations.py::send_message) so the
    // caller can render it as sent even though the reply failed.
    const error = new Error(json?.error || `Request failed: ${response.status} ${response.statusText}`)
    error.data = json?.data ?? null
    throw error
  }

  return json?.data ?? json
}

export async function retryConversationMessage(conversationId) {
  if (!USE_REAL_API) throw new Error('Conversations are not available in mock mode')
  return request(`/api/ai/conversations/${conversationId}/messages/retry`, { method: 'POST' })
}

export async function getMemory() {
  if (!USE_REAL_API) return { memory: {} }
  return request('/api/ai/memory')
}

export async function updateMemory(memory) {
  if (!USE_REAL_API) throw new Error('Memory is not available in mock mode')
  return request('/api/ai/memory', { method: 'PATCH', body: JSON.stringify({ memory }) })
}

export async function getMyRecipes() {
  if (!USE_REAL_API) {
    await delay(MOCK_DELAY_MS)
    return []
  }
  return request('/api/recipes/mine')
}

export async function getMe() {
  if (!USE_REAL_API) return null
  return request('/api/me')
}

export async function updateMe(payload) {
  if (!USE_REAL_API) return payload
  return request('/api/me', { method: 'PUT', body: JSON.stringify(payload) })
}

export async function requestAvatarUploadUrl({ contentType, fileSize }) {
  if (!USE_REAL_API) throw new Error('Avatar upload is not available in mock mode')
  return request('/api/me/avatar/upload-url', {
    method: 'POST',
    body: JSON.stringify({ contentType, fileSize }),
  })
}


export async function requestRecipeImageUploadUrl({ contentType, fileSize }) {
  if (!USE_REAL_API) throw new Error('Recipe image upload is not available in mock mode')
  return request('/api/recipes/image/upload-url', {
    method: 'POST',
    body: JSON.stringify({ contentType, fileSize }),
  })
}
