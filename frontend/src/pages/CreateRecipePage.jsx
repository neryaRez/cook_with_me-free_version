import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createRecipe, getRecipeById, requestRecipeImageUploadUrl, updateRecipe } from '../services/api.js'
import { categories, tags as tagOptions } from '../data/categories.js'
import { ChefHatIcon, PlusIcon, CloseIcon } from '../components/icons.jsx'

const DIFFICULTIES = ['Easy', 'Medium', 'Hard']

const EMPTY_INGREDIENT = { item: '', amount: '' }
const ALLOWED_RECIPE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_RECIPE_IMAGE_BYTES = 8 * 1024 * 1024

const initialFormState = {
  title: '',
  description: '',
  image: '',
  category: categories[1],
  cuisine: '',
  difficulty: 'Easy',
  prepTime: '',
  cookTime: '',
  servings: '',
}

export default function CreateRecipePage({ editMode = false }) {
  const imageInputRef = useRef(null)
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(initialFormState)
  const [selectedTags, setSelectedTags] = useState([])
  const [ingredients, setIngredients] = useState([{ ...EMPTY_INGREDIENT }])
  const [steps, setSteps] = useState([''])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingRecipe, setIsLoadingRecipe] = useState(editMode)
  const [createdRecipe, setCreatedRecipe] = useState(null)
  const [error, setError] = useState(null)
  const [recipeImageFile, setRecipeImageFile] = useState(null)
  const [recipeImagePreviewUrl, setRecipeImagePreviewUrl] = useState('')

  useEffect(() => {
    if (!editMode) return

    let isMounted = true
    setIsLoadingRecipe(true)
    setError(null)

    getRecipeById(id)
      .then((recipe) => {
        if (!isMounted) return

        setForm({
          title: recipe.title || '',
          description: recipe.description || '',
          image: recipe.imageKey ? '' : recipe.image || '',
          category: recipe.category || categories[1],
          cuisine: recipe.cuisine || '',
          difficulty: recipe.difficulty || 'Easy',
          prepTime: recipe.prepTime ?? '',
          cookTime: recipe.cookTime ?? '',
          servings: recipe.servings ?? '',
        })

        setSelectedTags(recipe.tags || [])
        setIngredients(
          recipe.ingredients?.length
            ? recipe.ingredients
            : [{ ...EMPTY_INGREDIENT }]
        )
        setSteps(recipe.steps?.length ? recipe.steps : [''])
        setRecipeImagePreviewUrl(recipe.image || '')
      })
      .catch(() => {
        if (isMounted) {
          setError('Could not load this recipe for editing.')
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingRecipe(false)
      })

    return () => {
      isMounted = false
    }
  }, [editMode, id])

  function handleRecipeImageChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)

    if (!ALLOWED_RECIPE_IMAGE_TYPES.has(file.type)) {
      setError('Please upload a JPEG, PNG, or WebP recipe image.')
      return
    }

    if (file.size > MAX_RECIPE_IMAGE_BYTES) {
      setError('Recipe image must be 8 MB or less.')
      return
    }

    setRecipeImageFile(file)
    setRecipeImagePreviewUrl(URL.createObjectURL(file))
    updateField('image', '')
  }

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function updateIngredient(index, field, value) {
    setIngredients((prev) =>
      prev.map((ingredient, i) => (i === index ? { ...ingredient, [field]: value } : ingredient))
    )
  }

  function addIngredient() {
    setIngredients((prev) => [...prev, { ...EMPTY_INGREDIENT }])
  }

  function removeIngredient(index) {
    setIngredients((prev) => prev.filter((_, i) => i !== index))
  }

  function updateStep(index, value) {
    setSteps((prev) => prev.map((step, i) => (i === index ? value : step)))
  }

  function addStep() {
    setSteps((prev) => [...prev, ''])
  }

  function removeStep(index) {
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  function toggleTag(tag) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((entry) => entry !== tag) : [...prev, tag]
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (isSubmitting) return
    setError(null)

    if (!form.title.trim() || !form.description.trim()) {
      setError('Please add a title and description for your recipe.')
      return
    }

    const validIngredients = ingredients.filter((ingredient) => ingredient.item.trim())
    const validSteps = steps.filter((step) => step.trim())

    if (validIngredients.length === 0) {
      setError('Please add at least one ingredient.')
      return
    }

    if (validSteps.length === 0) {
      setError('Please add at least one instruction step.')
      return
    }

    setIsSubmitting(true)

    try {
      let imageKey

      if (recipeImageFile) {
        const { uploadUrl, imageKey: key, headers } = await requestRecipeImageUploadUrl({
          contentType: recipeImageFile.type,
          fileSize: recipeImageFile.size,
        })

        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers,
          body: recipeImageFile,
        })

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload recipe image.')
        }

        imageKey = key
      }

      const recipePayload = {
        title: form.title.trim(),
        description: form.description.trim(),
        image:
          imageKey
            ? ''
            : form.image.trim() ||
              'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=1200&q=80',
        ...(imageKey ? { imageKey } : {}),
        category: form.category,
        cuisine: form.cuisine.trim() || 'Fusion',
        difficulty: form.difficulty,
        prepTime: Number(form.prepTime) || 0,
        cookTime: Number(form.cookTime) || 0,
        servings: Number(form.servings) || 1,
        tags: selectedTags,
        ingredients: validIngredients,
        steps: validSteps,
      }

      const savedRecipe = editMode
        ? await updateRecipe(id, recipePayload)
        : await createRecipe(recipePayload)

      if (editMode) {
        navigate(`/recipes/${savedRecipe.id}`, { replace: true })
        return
      }

      setCreatedRecipe(savedRecipe)
    } catch {
      setError('Something went wrong while publishing your recipe. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function resetForm() {
    setForm(initialFormState)
    setSelectedTags([])
    setIngredients([{ ...EMPTY_INGREDIENT }])
    setSteps([''])
    setRecipeImageFile(null)
    setRecipeImagePreviewUrl('')
    setCreatedRecipe(null)
  }

  if (editMode && isLoadingRecipe) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-muted">
        Loading recipe...
      </div>
    )
  }

  if (createdRecipe) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ember/15 text-ember-light">
          <ChefHatIcon className="h-8 w-8" />
        </span>
        <h1 className="mt-6 font-display text-3xl font-bold text-cream">Recipe published!</h1>
        <p className="mt-2 text-sm text-muted">
          &ldquo;{createdRecipe.title}&rdquo; is now live in the Cook With Me feed.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to={`/recipes/${createdRecipe.id}`}
            className="flex items-center gap-2 rounded-full bg-ember px-5 py-2.5 text-sm font-semibold text-cream"
          >
            View recipe
          </Link>
          <button
            type="button"
            onClick={resetForm}
            className="flex items-center gap-2 rounded-full border border-border-subtle/70 bg-card px-5 py-2.5 text-sm font-semibold text-cream hover:border-ember/40"
          >
            Create another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-bold text-cream sm:text-4xl">{editMode ? 'Edit Recipe' : 'Create a Recipe'}</h1>
      <p className="mt-2 text-sm text-muted">
        {editMode
          ? 'Update your recipe details, instructions, and photo.'
          : 'Share your dish with the Cook With Me community. Add ingredients, step-by-step instructions, and a photo if you have one.'}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        {error && (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        )}

        <section className="space-y-4 rounded-2xl border border-border-subtle/70 bg-card p-6">
          <h2 className="font-display text-lg font-bold text-cream">Basics</h2>

          <Field label="Recipe title">
            <input
              type="text"
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              placeholder="e.g. Smoky Chipotle Black Bean Tacos"
              className={inputClass}
            />
          </Field>

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
              placeholder="A short, mouth-watering description of your dish."
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </Field>

          <Field label="Recipe photo">
            <div className="space-y-3">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleRecipeImageChange}
                className="hidden"
              />

              {recipeImagePreviewUrl ? (
                <div className="overflow-hidden rounded-2xl border border-border-subtle/70 bg-surface">
                  <img
                    src={recipeImagePreviewUrl}
                    alt=""
                    className="h-56 w-full object-cover"
                  />
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="rounded-full bg-ember px-4 py-2 text-sm font-semibold text-cream hover:bg-ember-dark"
                >
                  {recipeImagePreviewUrl ? 'Change photo' : 'Upload photo'}
                </button>

                {recipeImagePreviewUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRecipeImageFile(null)
                      setRecipeImagePreviewUrl('')
                    }}
                    className="rounded-full border border-border-subtle/70 bg-card px-4 py-2 text-sm font-semibold text-cream hover:border-ember/40"
                  >
                    Remove photo
                  </button>
                ) : null}
              </div>

              <input
                type="url"
                value={form.image}
                onChange={(event) => {
                  setRecipeImageFile(null)
                  setRecipeImagePreviewUrl('')
                  updateField('image', event.target.value)
                }}
                placeholder="Or paste an image URL"
                className={inputClass}
              />
            </div>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Category">
              <select
                value={form.category}
                onChange={(event) => updateField('category', event.target.value)}
                className={inputClass}
              >
                {categories
                  .filter((category) => category !== 'All')
                  .map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
              </select>
            </Field>

            <Field label="Cuisine">
              <input
                type="text"
                value={form.cuisine}
                onChange={(event) => updateField('cuisine', event.target.value)}
                placeholder="e.g. Mexican"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Difficulty">
              <select
                value={form.difficulty}
                onChange={(event) => updateField('difficulty', event.target.value)}
                className={inputClass}
              >
                {DIFFICULTIES.map((difficulty) => (
                  <option key={difficulty} value={difficulty}>
                    {difficulty}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Prep (min)">
              <input
                type="number"
                min="0"
                value={form.prepTime}
                onChange={(event) => updateField('prepTime', event.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Cook (min)">
              <input
                type="number"
                min="0"
                value={form.cookTime}
                onChange={(event) => updateField('cookTime', event.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Servings">
              <input
                type="number"
                min="1"
                value={form.servings}
                onChange={(event) => updateField('servings', event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-cream">Tags (optional)</span>
            <div className="flex flex-wrap gap-2">
              {tagOptions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedTags.includes(tag)
                      ? 'border-ember bg-ember text-cream'
                      : 'border-border-subtle/70 bg-surface text-muted hover:border-ember/40 hover:text-cream'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-border-subtle/70 bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-cream">Ingredients</h2>
            <button type="button" onClick={addIngredient} className={addButtonClass}>
              <PlusIcon className="h-4 w-4" />
              Add ingredient
            </button>
          </div>

          <div className="space-y-3">
            {ingredients.map((ingredient, index) => (
              <div
                key={index}
                className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]"
              >
                <input
                  type="text"
                  value={ingredient.item}
                  onChange={(event) => updateIngredient(index, 'item', event.target.value)}
                  placeholder="Ingredient, e.g. potatoes"
                  aria-label={`Ingredient ${index + 1}`}
                  className={inputClass}
                />
                <input
                  type="text"
                  value={ingredient.amount}
                  onChange={(event) => updateIngredient(index, 'amount', event.target.value)}
                  placeholder="Amount, e.g. 500 g"
                  aria-label={`Amount for ingredient ${index + 1}`}
                  className={inputClass}
                />
                <RemoveButton
                  onClick={() => removeIngredient(index)}
                  disabled={ingredients.length === 1}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-border-subtle/70 bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-cream">Instructions</h2>
            <button type="button" onClick={addStep} className={addButtonClass}>
              <PlusIcon className="h-4 w-4" />
              Add step
            </button>
          </div>

          <div className="space-y-5">
            {steps.map((step, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="mt-2.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ember/15 text-xs font-bold text-ember-light">
                  {index + 1}
                </span>
                <textarea
                  value={step}
                  onChange={(event) => updateStep(index, event.target.value)}
                  placeholder={`Describe step ${index + 1}...`}
                  rows={2}
                  className={`${inputClass} flex-1 resize-none`}
                />
                <RemoveButton onClick={() => removeStep(index)} disabled={steps.length === 1} />
              </div>
            ))}
          </div>
        </section>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-ember px-6 py-3.5 text-sm font-semibold text-cream shadow-md shadow-ember/25 transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (editMode ? 'Saving...' : 'Publishing...') : (editMode ? 'Save changes' : 'Publish recipe')}
        </button>
      </form>
    </div>
  )
}

const inputClass =
  'w-full rounded-xl border border-border-subtle/70 bg-surface px-4 py-2.5 text-sm text-cream placeholder:text-muted/70 outline-none focus:border-ember/50 focus:ring-2 focus:ring-ember/20'

const addButtonClass =
  'flex items-center gap-1.5 rounded-full border border-border-subtle/70 px-3 py-1.5 text-xs font-semibold text-cream transition-colors hover:border-ember/40 hover:text-ember-light'

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-cream">{label}</span>
      {children}
    </label>
  )
}

function RemoveButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-subtle/70 text-muted transition-colors hover:border-rose-300 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30"
      aria-label="Remove"
    >
      <CloseIcon className="h-4 w-4" />
    </button>
  )
}
