import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { linkPlayerToUser } from '../lib/pools'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

// Create context with a default value to prevent HMR issues
const defaultValue: AuthContextType = {
  user: null,
  session: null,
  loading: true,
  signIn: async () => { throw new Error('AuthProvider not initialized') },
  signOut: async () => { throw new Error('AuthProvider not initialized') },
}

const AuthContext = createContext<AuthContextType>(defaultValue)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      
      // Link player record in background (don't await - non-blocking)
      if (session?.user?.email && _event === 'SIGNED_IN') {
        linkPlayerToUser(session.user.id, session.user.email).catch(() => {
          // Silently fail - linking is best effort
        })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string) => {
    if (!supabase) {
      throw new Error('Supabase not initialized. Check your environment variables.')
    }
    // For local dev, use localhost:5173 to match Supabase config
    // In production, this will use the actual origin
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    const redirectUrl = isLocal 
      ? `http://localhost:5173/dashboard`
      : `${window.location.origin}/dashboard`
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    })
    if (error) throw error
  }

  const signOut = async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

