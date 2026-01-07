import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Pools from './pages/Pools'
import CreatePool from './pages/CreatePool'
import PoolDetails from './pages/PoolDetails'
import AuthCallback from './pages/AuthCallback'
import Register from './pages/Register'
import CreateSession from './pages/CreateSession'
import SessionDetails from './pages/SessionDetails'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <AuthProvider>
      <Analytics />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            <Route path="auth/callback" element={<AuthCallback />} />
            <Route path="register/:token" element={<Register />} />
            <Route
              path="dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="pools"
              element={
                <ProtectedRoute>
                  <Pools />
                </ProtectedRoute>
              }
            />
            <Route
              path="pools/new"
              element={
                <ProtectedRoute>
                  <CreatePool />
                </ProtectedRoute>
              }
            />
            <Route
              path="pools/:id"
              element={
                <ProtectedRoute>
                  <PoolDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="p/:slug"
              element={
                <ProtectedRoute>
                  <PoolDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="s/new"
              element={
                <ProtectedRoute>
                  <CreateSession />
                </ProtectedRoute>
              }
            />
            <Route
              path="s/:id"
              element={
                <ProtectedRoute>
                  <SessionDetails />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
