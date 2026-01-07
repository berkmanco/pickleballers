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
export async function getPools(userId: string) {
  // Get pools user owns
  const { data: ownedPools, error: ownedError } = await supabase
    .from('pools')
    .select('*')
    .eq('owner_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (ownedError) throw ownedError

  // Get pools user is a member of (via pool_players)
  const { data: playerRecord } = await supabase
    .from('players')
    .select('id')
    .eq('user_id', userId)
    .single()

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

