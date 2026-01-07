import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Pools from './pages/Pools'
import CreatePool from './pages/CreatePool'
import PoolDetails from './pages/PoolDetails'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
