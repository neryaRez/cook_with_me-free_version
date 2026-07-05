import { Routes, Route } from 'react-router-dom'
import HomePage from '../pages/HomePage.jsx'
import RecipesFeedPage from '../pages/RecipesFeedPage.jsx'
import RecipeDetailsPage from '../pages/RecipeDetailsPage.jsx'
import CreateRecipePage from '../pages/CreateRecipePage.jsx'
import MyRecipesPage from '../pages/MyRecipesPage.jsx'
import RoboChefPage from '../pages/RoboChefPage.jsx'
import NotFoundPage from '../pages/NotFoundPage.jsx'
import SignInPage from '../pages/auth/SignInPage.jsx'
import SignUpPage from '../pages/auth/SignUpPage.jsx'
import VerifyCodePage from '../pages/auth/VerifyCodePage.jsx'
import SetupProfilePage from '../pages/auth/SetupProfilePage.jsx'
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage.jsx'
import ResetPasswordPage from '../pages/auth/ResetPasswordPage.jsx'
import RequireAuth from '../components/auth/RequireAuth.jsx'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/recipes" element={<RecipesFeedPage />} />
      <Route path="/recipes/:id" element={<RecipeDetailsPage />} />
      <Route
        path="/recipes/:id/edit"
        element={
          <RequireAuth>
            <CreateRecipePage editMode />
          </RequireAuth>
        }
      />
      <Route
        path="/create"
        element={
          <RequireAuth>
            <CreateRecipePage />
          </RequireAuth>
        }
      />
      <Route
        path="/my-recipes"
        element={
          <RequireAuth>
            <MyRecipesPage />
          </RequireAuth>
        }
      />
      <Route path="/robo-chef" element={<RoboChefPage />} />
      <Route path="/login" element={<SignInPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/verify" element={<VerifyCodePage />} />
      <Route path="/setup-profile" element={<SetupProfilePage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
