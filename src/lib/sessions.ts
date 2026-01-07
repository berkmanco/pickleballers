import { supabase } from './supabase'

export interface Session {
  id: string
  pool_id: string
  proposed_date: string
  proposed_time: string
  duration_minutes: number
  min_players: number
  max_players: number
  status: 'proposed' | 'confirmed' | 'cancelled' | 'completed'
  court_booking_ids: string[] | null
  court_numbers: string[] | null
  court_location: string | null
  courts_needed: number
  admin_cost_per_court: number
  guest_pool_per_court: number
  payment_deadline: string | null
  roster_locked: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SessionWithPool extends Session {
  pools: {
    id: string
    name: string
    slug: string
  }
}

export interface CreateSessionData {
  pool_id: string
  proposed_date: string
  proposed_time: string
  duration_minutes?: number
  min_players?: number
  max_players?: number
  court_location?: string
  courts_needed?: number
  admin_cost_per_court?: number
  guest_pool_per_court?: number
  payment_deadline?: string
}

// Create a new session
export async function createSession(sessionData: CreateSessionData) {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  // Get current user ID
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('User must be authenticated to create sessions')
  }

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      pool_id: sessionData.pool_id,
      proposed_date: sessionData.proposed_date,
      proposed_time: sessionData.proposed_time,
      duration_minutes: sessionData.duration_minutes || 60,
      min_players: sessionData.min_players || 4,
      max_players: sessionData.max_players || 7,
      court_location: sessionData.court_location || null,
      courts_needed: sessionData.courts_needed || 1,
      admin_cost_per_court: sessionData.admin_cost_per_court || 9.0,
      guest_pool_per_court: sessionData.guest_pool_per_court || 48.0,
      payment_deadline: sessionData.payment_deadline || null,
      status: 'proposed',
      roster_locked: false,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Session creation error:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    console.error('Pool ID:', sessionData.pool_id)
    console.error('User ID:', user.id)
    console.error('Session data:', JSON.stringify(sessionData, null, 2))
    
    // Try to verify pool ownership
    if (supabase) {
      const { data: poolCheck, error: poolError } = await supabase
        .from('pools')
        .select('id, owner_id')
        .eq('id', sessionData.pool_id)
        .single()
      console.error('Pool check result:', poolCheck)
      console.error('Pool check error:', poolError)
      console.error('Is owner?', poolCheck?.owner_id === user.id)
    }
    
    throw error
  }
  return data as Session
}

// Get a single session by ID
export async function getSession(sessionId: string) {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  const { data, error } = await supabase
    .from('sessions')
    .select(`
      *,
      pools (
        id,
        name,
        slug
      )
    `)
    .eq('id', sessionId)
    .single()

  if (error) throw error
  return data as SessionWithPool
}

// Get all sessions for a pool
export async function getSessions(poolId: string) {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('pool_id', poolId)
    .order('proposed_date', { ascending: true })
    .order('proposed_time', { ascending: true })

  if (error) throw error
  return data as Session[]
}

// Get upcoming sessions for a pool (not cancelled or completed)
export async function getUpcomingSessions(poolId: string) {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('pool_id', poolId)
    .in('status', ['proposed', 'confirmed'])
    .gte('proposed_date', today)
    .order('proposed_date', { ascending: true })
    .order('proposed_time', { ascending: true })

  if (error) throw error
  return data as Session[]
}

// Get session cost summary
export interface SessionCostSummary {
  total_players: number
  guest_count: number
  courts_needed: number
  admin_cost: number
  guest_pool: number
  guest_cost: number
}

export async function getSessionCostSummary(sessionId: string): Promise<SessionCostSummary> {
  if (!supabase) {
    throw new Error('Database connection not available')
  }
  const { data, error } = await supabase.rpc('get_session_cost_summary', {
    p_session_id: sessionId,
  })

  if (error) throw error
  
  // RPC returns a table (array), get first row
  if (!data || !Array.isArray(data) || data.length === 0) {
    // Return default values if no data
    return {
      total_players: 0,
      guest_count: 0,
      courts_needed: 0,
      admin_cost: 0,
      guest_pool: 0,
      guest_cost: 0,
    }
  }
  
  return data[0] as SessionCostSummary
}

