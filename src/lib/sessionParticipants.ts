import { supabase } from './supabase'

// Helper: Get player ID for current user
export async function getCurrentPlayerId(userId: string): Promise<string | null> {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  const { data, error } = await supabase
    .from('players')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned
    throw error
  }

  return data?.id || null
}

export type ParticipantStatus = 'committed' | 'paid' | 'maybe' | 'out'

export interface SessionParticipant {
  id: string
  session_id: string
  player_id: string
  is_admin: boolean
  status: ParticipantStatus
  status_changed_at: string
  opted_in_at: string
  waitlist_position: number | null
  // Joined from players table
  players?: {
    id: string
    name: string
    venmo_account: string
    email: string | null
    phone: string | null
  }
}

export interface SessionParticipantWithPlayer extends SessionParticipant {
  players: {
    id: string
    name: string
    venmo_account: string
    email: string | null
    phone: string | null
  }
}

// Get all participants for a session
export async function getSessionParticipants(sessionId: string) {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  const { data, error } = await supabase
    .from('session_participants')
    .select(`
      *,
      players (
        id,
        name,
        venmo_account,
        email,
        phone
      )
    `)
    .eq('session_id', sessionId)
    .order('opted_in_at', { ascending: true })

  if (error) throw error

  return (data || []) as SessionParticipantWithPlayer[]
}

// Get current player's participation status for a session
export async function getCurrentPlayerStatus(
  sessionId: string,
  playerId: string
) {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  const { data, error } = await supabase
    .from('session_participants')
    .select('*')
    .eq('session_id', sessionId)
    .eq('player_id', playerId)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned, which is fine (player hasn't opted in yet)
    throw error
  }

  return data as SessionParticipant | null
}

// Opt in to a session (commit or maybe)
// If playerId is not provided, will look up from current user
export async function optInToSession(
  sessionId: string,
  status: 'committed' | 'maybe',
  playerId?: string
) {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  // Get player ID from user if not provided
  if (!playerId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('User must be authenticated')
    }
    const pid = await getCurrentPlayerId(user.id)
    if (!pid) {
      throw new Error('Player record not found for user')
    }
    playerId = pid
  }

  // Check if player already has a record
  const existing = await getCurrentPlayerStatus(sessionId, playerId)

  if (existing) {
    // Update existing record
    const { data, error } = await supabase
      .from('session_participants')
      .update({
        status,
        status_changed_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) throw error
    return data as SessionParticipant
  } else {
    // Create new record
    const { data, error } = await supabase
      .from('session_participants')
      .insert({
        session_id: sessionId,
        player_id: playerId,
        status,
        opted_in_at: new Date().toISOString(),
        status_changed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return data as SessionParticipant
  }
}

// Opt out of a session
// If playerId is not provided, will look up from current user
export async function optOutOfSession(
  sessionId: string,
  playerId?: string
) {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  // Get player ID from user if not provided
  if (!playerId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('User must be authenticated')
    }
    const pid = await getCurrentPlayerId(user.id)
    if (!pid) {
      throw new Error('Player record not found for user')
    }
    playerId = pid
  }

  const existing = await getCurrentPlayerStatus(sessionId, playerId)

  if (!existing) {
    throw new Error('Player is not currently opted in to this session')
  }

  const { data, error } = await supabase
    .from('session_participants')
    .update({
      status: 'out',
      status_changed_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .select()
    .single()

  if (error) throw error
  return data as SessionParticipant
}


// Get pool players who are not yet actively in a session
// Returns players who either: have no participant record, or have status 'out'
export async function getPoolPlayersNotInSession(
  poolId: string,
  sessionId: string
): Promise<{ id: string; name: string }[]> {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  // Run both queries in parallel
  const [poolPlayersResult, participantsResult] = await Promise.all([
    supabase
      .from('pool_players')
      .select('player:players(id, name)')
      .eq('pool_id', poolId)
      .eq('is_active', true),
    supabase
      .from('session_participants')
      .select('player_id, status')
      .eq('session_id', sessionId)
      .in('status', ['committed', 'paid', 'maybe'])
  ])

  if (poolPlayersResult.error) throw poolPlayersResult.error
  if (participantsResult.error) throw participantsResult.error

  const activeParticipantIds = new Set(
    (participantsResult.data || []).map(p => p.player_id)
  )

  // Filter to players not actively in session
  const availablePlayers = (poolPlayersResult.data || [])
    .map((pp: any) => pp.player)
    .filter((player: any) => player && !activeParticipantIds.has(player.id))

  return availablePlayers as { id: string; name: string }[]
}

// Add a player to a session (admin action)
// Used when admin wants to manually add a pool member
export async function addPlayerToSession(
  sessionId: string,
  playerId: string,
  status: 'committed' | 'maybe' = 'committed'
): Promise<SessionParticipant> {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  // Check if player already has a record (might be 'out')
  const existing = await getCurrentPlayerStatus(sessionId, playerId)

  if (existing) {
    // Update existing record to new status
    const { data, error } = await supabase
      .from('session_participants')
      .update({
        status,
        status_changed_at: new Date().toISOString(),
        opted_in_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) throw error
    return data as SessionParticipant
  } else {
    // Create new participant record
    const { data, error } = await supabase
      .from('session_participants')
      .insert({
        session_id: sessionId,
        player_id: playerId,
        status,
        is_admin: false,
        opted_in_at: new Date().toISOString(),
        status_changed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return data as SessionParticipant
  }
}
