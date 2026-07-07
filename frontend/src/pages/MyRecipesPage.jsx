import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteRecipe, getMyRecipes } from '../services/api.js'
import RecipeCard from '../components/RecipeCard.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import Loader from '../components/Loader.jsx'
import { PlusIcon } from '../components/icons.jsx'

export default function MyRecipesPage() {
  const { user } = useAuth()
  const [recipes, setRecipes] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deletingRecipeId, setDeletingRecipeId] = useState(null)

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)
    getMyRecipes()
      .then((data) => {
        if (isMounted) setRecipes(data)
      })
      .catch(() => {
        if (isMounted) setError('Could not load your recipes right now. Please try again later.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [])

  async function handleDeleteRecipe(recipe) {
    if (
      deletingRecipeId ||
      !user?.sub ||
      recipe?.ownerSub !== user.sub
    ) {
      return
    }

    const confirmed = window.confirm(
      `Delete "${recipe.title}" permanently? This action cannot be undone.`
    )

    if (!confirmed) return

    setDeletingRecipeId(recipe.id)
    setError(null)

    try {
      await deleteRecipe(recipe.id)
      setRecipes((current) =>
        current.filter((item) => String(item.id) !== String(recipe.id))
      )
    } catch {
      setError('Could not delete the recipe. Please try again.')
    } finally {
      setDeletingRecipeId(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl font-bold text-cream sm:text-4xl">My Recipes</h1>
          <p className="mt-2 text-sm text-muted">Recipes you've published to the Cook With Me community.</p>
        </div>
        <Link
          to="/create"
          className="flex items-center gap-1.5 rounded-full bg-ember px-4 py-2 text-sm font-semibold text-cream shadow-md shadow-ember/25 transition-transform hover:scale-[1.03]"
        >
          <PlusIcon className="h-4 w-4" />
          New Recipe
        </Link>
      </div>

      <div className="mt-8">
        {isLoading && <Loader label="Loading your recipes..." />}

        {!isLoading && error && (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        )}

        {!isLoading && !error && recipes.length === 0 && (
          <div className="rounded-2xl border border-border-subtle/70 bg-card px-6 py-12 text-center">
            <p className="font-display text-lg font-semibold text-cream">You haven't published any recipes yet</p>
            <p className="mt-1 text-sm text-muted">Share your first dish with the community.</p>
            <Link
              to="/create"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ember px-4 py-2 text-sm font-semibold text-cream"
            >
              <PlusIcon className="h-4 w-4" />
              Create a recipe
            </Link>
          </div>
        )}

        {!isLoading && !error && recipes.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((recipe) => {
              const isOwner =
                Boolean(user?.sub) &&
                recipe?.ownerSub === user.sub

              return (
                <div key={recipe.id} className="relative">
                  <RecipeCard recipe={recipe} currentUser={user} />

                  {isOwner ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteRecipe(recipe)}
                      disabled={deletingRecipeId === recipe.id}
                      aria-label={`Delete ${recipe.title}`}
                      title="Delete recipe"
                      className="absolute bottom-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-white/95 text-rose-600 shadow-md backdrop-blur-sm transition hover:scale-105 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingRecipeId === recipe.id ? (
                        <span className="text-xs font-semibold">...</span>
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v5" />
                          <path d="M14 11v5" />
                        </svg>
                      )}
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
