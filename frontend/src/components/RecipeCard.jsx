import { Link } from 'react-router-dom'
import { ClockIcon, StarIcon, FlameIcon } from './icons.jsx'
import { getTotalTime } from '../utils/recipe.js'

const difficultyStyles = {
  Easy: 'bg-sage-light text-sage',
  Medium: 'bg-amber/15 text-amber',
  Hard: 'bg-rose-100 text-rose-600',
}

function isFakeAvatar(url) {
  return typeof url === 'string' && url.includes('i.pravatar.cc')
}

export default function RecipeCard({ recipe, currentUser }) {
  const totalTime = getTotalTime(recipe)
  const isOwnRecipe =
    recipe?.isMine === true ||
    recipe?.ownerSub === currentUser?.sub ||
    recipe?.author?.email === currentUser?.email ||
    recipe?.author?.name === 'You' ||
    recipe?.author?.name === currentUser?.username ||
    recipe?.author?.name === currentUser?.displayName

  const authorName =
    isOwnRecipe
      ? currentUser?.username || currentUser?.displayName || recipe?.author?.name || 'You'
      : recipe?.author?.name || 'Cook'

  const authorAvatar =
    isOwnRecipe && currentUser?.avatarUrl
      ? currentUser.avatarUrl
      : !isFakeAvatar(recipe?.author?.avatar) && recipe?.author?.avatar
        ? recipe.author.avatar
        : null

  const authorInitial = (authorName || 'C').charAt(0).toUpperCase()

  return (
    <Link
      to={`/recipes/${recipe.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border-subtle/70 bg-card transition-all duration-300 hover:-translate-y-1 hover:border-ember/40 hover:bg-card-hover hover:shadow-xl hover:shadow-black/30"
    >
      <div className="relative h-48 w-full overflow-hidden">
        <img
          src={recipe.image}
          alt={recipe.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/0 to-ink/0" />
        <span className="absolute left-3 top-3 rounded-full bg-ink/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ember-light backdrop-blur-sm">
          {recipe.category}
        </span>
        <span
          className={`absolute right-3 top-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur-sm ${difficultyStyles[recipe.difficulty] ?? 'bg-surface text-muted'}`}
        >
          <FlameIcon className="h-3.5 w-3.5" />
          {recipe.difficulty}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="font-display text-lg font-bold leading-snug text-cream transition-colors group-hover:text-ember-light">
          {recipe.title}
        </h3>
        <p className="line-clamp-2 text-sm leading-relaxed text-muted">{recipe.description}</p>

        <div className="mt-auto flex items-center justify-between border-t border-border-subtle/60 pt-4">
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1">
              <ClockIcon className="h-3.5 w-3.5" />
              {totalTime} min
            </span>
            <span className="flex items-center gap-1 text-amber">
              <StarIcon className="h-3.5 w-3.5" />
              {recipe.rating.toFixed(1)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-border-subtle/70 bg-ember/10 text-[10px] font-semibold text-ember">
              {authorAvatar ? (
                <img
                  src={authorAvatar}
                  alt={authorName}
                  className="h-full w-full object-cover"
                />
              ) : (
                authorInitial
              )}
            </div>
            <span className="text-xs font-medium text-muted">{authorName}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
