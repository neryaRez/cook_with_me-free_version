import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMyRecipes } from '../services/api.js'
import RecipeCard from '../components/RecipeCard.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import Loader from '../components/Loader.jsx'
import { PlusIcon } from '../components/icons.jsx'

export default function MyRecipesPage() {
  const { user } = useAuth()
  const [recipes, setRecipes] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

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
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} currentUser={user} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
