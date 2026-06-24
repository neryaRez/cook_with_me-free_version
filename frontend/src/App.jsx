import MainLayout from './layouts/MainLayout.jsx'
import AppRoutes from './router/AppRoutes.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

export default function App() {
  return (
    <AuthProvider>
      <MainLayout>
        <AppRoutes />
      </MainLayout>
    </AuthProvider>
  )
}
