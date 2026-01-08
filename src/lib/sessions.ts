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
  court_numbers?: string[]
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
      court_numbers: sessionData.court_numbers?.length ? sessionData.court_numbers : null,
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

/**
 * Lock the roster for a session.
 * This freezes the participant list and triggers payment creation.
 * Admin only - called when confirming the session.
 */
export async function lockRoster(sessionId: string): Promise<Session> {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  const { data, error } = await supabase
    .from('sessions')
    .update({
      roster_locked: true,
      status: 'confirmed',
    })
    .eq('id', sessionId)
    .select()
    .single()

  if (error) throw error
  return data as Session
}

/**
 * Unlock the roster (admin only, for corrections)
 */
export async function unlockRoster(sessionId: string): Promise<Session> {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  const { data, error } = await supabase
    .from('sessions')
    .update({
      roster_locked: false,
    })
    .eq('id', sessionId)
    .select()
    .single()

  if (error) throw error
  return data as Session
}

/**
 * Update session status
 */
export async function updateSessionStatus(
  sessionId: string,
  status: Session['status']
): Promise<Session> {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  const { data, error } = await supabase
    .from('sessions')
    .update({ status })
    .eq('id', sessionId)
    .select()
    .single()

  if (error) throw error
  return data as Session
}

/**
 * Get upcoming sessions the user is committed to
 */
export interface UserSession extends SessionWithPool {
  participant_status: 'committed' | 'paid' | 'maybe'
  is_admin: boolean
}

export async function getUserCommittedSessions(playerId: string): Promise<UserSession[]> {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('session_participants')
    .select(`
      status,
      is_admin,
      sessions!inner (
        *,
        pools (
          id,
          name,
          slug
        )
      )
    `)
    .eq('player_id', playerId)
    .in('status', ['committed', 'paid'])
    .gte('sessions.proposed_date', today)
    .in('sessions.status', ['proposed', 'confirmed'])
    .order('sessions(proposed_date)', { ascending: true })

  if (error) throw error

  // Transform the data structure
  return (data || []).map((row: any) => ({
    ...row.sessions,
    participant_status: row.status,
    is_admin: row.is_admin,
  })) as UserSession[]
}

/**
 * Get open sessions in user's pools that they haven't joined yet
 */
export async function getOpenSessionsToJoin(playerId: string): Promise<SessionWithPool[]> {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  const today = new Date().toISOString().split('T')[0]

  // First get all pools the user is in
  const { data: poolData, error: poolError } = await supabase
    .from('pool_players')
    .select('pool_id')
    .eq('player_id', playerId)
    .eq('is_active', true)

  if (poolError) throw poolError
  if (!poolData || poolData.length === 0) return []

  const poolIds = poolData.map(p => p.pool_id)

  // Get all upcoming sessions in those pools
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select(`
      *,
      pools (
        id,
        name,
        slug
      )
    `)
    .in('pool_id', poolIds)
    .in('status', ['proposed', 'confirmed'])
    .eq('roster_locked', false)  // Only open sessions
    .gte('proposed_date', today)
    .order('proposed_date', { ascending: true })
    .order('proposed_time', { ascending: true })

  if (sessionsError) throw sessionsError
  if (!sessions || sessions.length === 0) return []

  // Get sessions the user is already in
  const { data: participations, error: partError } = await supabase
    .from('session_participants')
    .select('session_id')
    .eq('player_id', playerId)
    .in('status', ['committed', 'paid', 'maybe'])

  if (partError) throw partError

  const joinedSessionIds = new Set((participations || []).map(p => p.session_id))

  // Filter out sessions user has already joined
  return sessions.filter(s => !joinedSessionIds.has(s.id)) as SessionWithPool[]
}

