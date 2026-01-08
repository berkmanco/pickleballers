import { supabase } from './supabase'

export interface Pool {
  id: string
  name: string
  slug: string
  description: string | null
  owner_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreatePoolData {
  name: string
  description?: string
}

// Get all pools the user owns or is a member of
export async function getPools(userId: string, userEmail?: string) {
  if (!supabase) {
    throw new Error('Database not initialized')
  }
  
  // Get pools user owns
  const { data: ownedPools, error: ownedError } = await supabase
    .from('pools')
    .select('*')
    .eq('owner_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (ownedError) throw ownedError

  // Get pools user is a member of (via pool_players)
  // First try to find player record by user_id
  let { data: playerRecord } = await supabase
    .from('players')
    .select('id')
    .eq('user_id', userId)
    .single()

  // If not found and email provided, try to link by email
  if (!playerRecord && userEmail) {
    try {
      const playerId = await linkPlayerToUser(userId, userEmail)
      if (playerId) {
        // Retry the query after linking
        const { data: retryRecord } = await supabase
          .from('players')
          .select('id')
          .eq('user_id', userId)
          .single()
        playerRecord = retryRecord
      }
    } catch (err) {
      // Silently fail - linking is best effort
    }
  }

  if (!playerRecord) {
    return ownedPools || []
  }

  const { data: memberPools, error: memberError } = await supabase
    .from('pool_players')
    .select(`
      pool_id,
      pools (*)
    `)
    .eq('player_id', playerRecord.id)
    .eq('is_active', true)

  if (memberError) throw memberError

  // Combine and deduplicate
  const allPools = [
    ...(ownedPools || []),
    ...(memberPools?.map((mp: any) => mp.pools).filter((p: any) => p && p.is_active) || [])
  ]

  // Remove duplicates by id
  const uniquePools = Array.from(
    new Map(allPools.map((pool: any) => [pool.id, pool])).values()
  )

  return uniquePools as Pool[]
}

// Check if string is a UUID
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

// Get a single pool by ID or slug
export async function getPool(identifier: string) {
  // Check if it's a UUID or slug
  const isId = isUUID(identifier)
  
  const { data, error } = await supabase
    .from('pools')
    .select('*')
    .eq(isId ? 'id' : 'slug', identifier)
    .single()

  if (error) throw error
  return data as Pool
}

// Create a new pool
// Note: owner_id is automatically set by database trigger from auth.uid()
export async function createPool(poolData: CreatePoolData) {
  const { data, error } = await supabase
    .from('pools')
    .insert({
      name: poolData.name,
      description: poolData.description || null,
      is_active: true,
    })
    .select()
    .single()

  if (error) throw error
  return data as Pool
}

// Check if user is pool owner
export async function isPoolOwner(poolId: string, userId: string) {
  const { data, error } = await supabase
    .from('pools')
    .select('owner_id')
    .eq('id', poolId)
    .single()

  if (error) throw error
  return data?.owner_id === userId
}

// Player interface
export interface Player {
  id: string
  name: string
  phone: string | null
  email: string | null
  venmo_account: string
  notification_preferences: {
    email: boolean
    sms: boolean
  }
  is_active: boolean
  created_at: string
  joined_at: string // from pool_players
}

// Link player record to user account (by email)
// This is called after sign-in to connect the player record created during registration
// Uses a SECURITY DEFINER function to bypass RLS (users can't see unlinked player records)
export async function linkPlayerToUser(_userId: string, email: string): Promise<string | null> {
  const { data: playerId, error } = await supabase.rpc('link_player_to_user', {
    p_email: email
  })

  if (error) {
    console.error('Error linking player to user:', error)
    throw error
  }

  return playerId
}

// Get player ID for current user
// If not found, tries to link by email first
export async function getCurrentPlayerId(userId: string, email?: string): Promise<string | null> {
  // First, try to find existing linked player
  const { data: existingPlayer, error: findError } = await supabase
    .from('players')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (!findError && existingPlayer) {
    return existingPlayer.id
  }

  // If not found and email provided, try to link by email
  if (email && findError?.code === 'PGRST116') {
    try {
      return await linkPlayerToUser(userId, email)
    } catch (err) {
      // If linking fails, return null
      return null
    }
  }

  return null
}

// Get all players in a pool
export async function getPoolPlayers(poolId: string) {
  const { data, error } = await supabase
    .from('pool_players')
    .select(`
      joined_at,
      is_active,
      players (
        id,
        name,
        phone,
        email,
        venmo_account,
        notification_preferences,
        is_active,
        created_at
      )
    `)
    .eq('pool_id', poolId)
    .eq('is_active', true)
    .order('joined_at', { ascending: true })

  if (error) throw error

  // Transform the data to flatten the structure
  return (data || []).map((pp: any) => ({
    ...pp.players,
    joined_at: pp.joined_at,
  })) as Player[]
}

// Get pool owner's player record (for Venmo account)
export async function getPoolOwnerPlayer(poolId: string): Promise<Player | null> {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  // Get pool owner ID
  const { data: pool, error: poolError } = await supabase
    .from('pools')
    .select('owner_id')
    .eq('id', poolId)
    .single()

  if (poolError) throw poolError
  if (!pool?.owner_id) return null

  // Get owner's player record
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('*')
    .eq('user_id', pool.owner_id)
    .single()

  if (playerError && playerError.code !== 'PGRST116') {
    throw playerError
  }

  return player as Player | null
}

