import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    // Handle the auth callback from magic link
    // Supabase processes the token in the URL automatically
    const handleAuthCallback = async () => {
      if (!supabase) {
        navigate('/login', { replace: true })
        return
      }

      // Get the hash fragment from URL (Supabase puts tokens there)
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const error = hashParams.get('error')

      if (error) {
        console.error('Auth error:', error)
        navigate('/login?error=' + encodeURIComponent(error), { replace: true })
        return
      }

      if (accessToken) {
        // Token is in the URL, Supabase will handle it
        // Wait a moment for Supabase to process it
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
              // Successfully authenticated, redirect to dashboard
              navigate('/dashboard', { replace: true })
            } else {
              // No session, redirect to login
              navigate('/login', { replace: true })
            }
          })
        }, 500)
      } else {
        // No token, check if we already have a session
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            navigate('/dashboard', { replace: true })
          } else {
            navigate('/login', { replace: true })
          }
        })
      }
    }

    handleAuthCallback()
  }, [navigate, searchParams])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3CBBB1] mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  )
}

