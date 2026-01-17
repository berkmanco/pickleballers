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
  
  // Run owned pools and player lookup in parallel
  const [ownedResult, playerResult] = await Promise.all([
    supabase
      .from('pools')
      .select('*')
      .eq('owner_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('players')
      .select('id')
      .eq('user_id', userId)
      .single()
  ])

  if (ownedResult.error) throw ownedResult.error
  const ownedPools = ownedResult.data

  let playerRecord = playerResult.data

  // If not found and email provided, try to link by email (rare case)
  if (!playerRecord && userEmail) {
    try {
      const playerId = await linkPlayerToUser(userId, userEmail)
      if (playerId) {
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

// Convert phone number to E.164 format
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `+1${digits}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }
  return phone
}

// Interface for creating a new player
export interface CreatePlayerData {
  name: string
  email?: string
  phone?: string
  venmo_account: string
}

// Create a new player and add them to a pool (admin action)
// Uses SECURITY DEFINER function to bypass RLS
export async function createPlayerAndAddToPool(
  poolId: string,
  playerData: CreatePlayerData
): Promise<Player> {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  // Format phone to E.164 if provided
  const formattedPhone = playerData.phone ? toE164(playerData.phone) : null

  // Strip @ from venmo if present
  const venmoAccount = playerData.venmo_account.replace(/^@/, '')

  // Use RPC function that bypasses RLS
  const { data: playerId, error: rpcError } = await supabase.rpc('create_player_for_pool', {
    p_pool_id: poolId,
    p_name: playerData.name,
    p_venmo_account: venmoAccount,
    p_email: playerData.email || null,
    p_phone: formattedPhone,
  })

  if (rpcError) {
    console.error('Error creating player:', rpcError)
    throw rpcError
  }

  // Fetch the created player to return
  const { data: player, error: fetchError } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .single()

  if (fetchError) {
    console.error('Error fetching created player:', fetchError)
    throw fetchError
  }

  return {
    ...player,
    joined_at: new Date().toISOString(),
  } as Player
}

// Get all players NOT in a specific pool (for adding existing players)
export async function getPlayersNotInPool(poolId: string): Promise<{ id: string; name: string; email: string | null }[]> {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  // Run both queries in parallel
  const [allPlayersResult, poolPlayersResult] = await Promise.all([
    supabase
      .from('players')
      .select('id, name, email')
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('pool_players')
      .select('player_id')
      .eq('pool_id', poolId)
      .eq('is_active', true)
  ])

  if (allPlayersResult.error) throw allPlayersResult.error
  if (poolPlayersResult.error) throw poolPlayersResult.error

  const poolPlayerIds = new Set((poolPlayersResult.data || []).map(pp => pp.player_id))

  // Filter to players not in pool
  return (allPlayersResult.data || []).filter(p => !poolPlayerIds.has(p.id))
}

// Add an existing player to a pool
export async function addExistingPlayerToPool(poolId: string, playerId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  // Check if already in pool (including inactive)
  const { data: existing } = await supabase
    .from('pool_players')
    .select('id, is_active')
    .eq('pool_id', poolId)
    .eq('player_id', playerId)
    .single()

  if (existing) {
    if (existing.is_active) {
      throw new Error('Player is already in this pool')
    }
    // Reactivate if inactive
    const { error } = await supabase
      .from('pool_players')
      .update({ is_active: true, joined_at: new Date().toISOString() })
      .eq('id', existing.id)

    if (error) throw error
  } else {
    // Add new pool_player record
    const { error } = await supabase
      .from('pool_players')
      .insert({
        pool_id: poolId,
        player_id: playerId,
        is_active: true,
      })

    if (error) throw error
  }
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

