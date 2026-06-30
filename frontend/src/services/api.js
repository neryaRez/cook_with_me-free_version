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
    author: data.author ?? 'You',
    text: data.text,
    date: data.date ?? new Date().toISOString().slice(0, 10),
  }

  recipe.comments.push(newComment)
  return newComment
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
