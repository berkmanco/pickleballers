import { supabase } from './supabase'
import { notifyPlayerJoined, notifyPlayerWelcome } from './notifications'

export interface RegistrationLink {
  id: string
  pool_id: string
  token: string
  created_by: string | null
  expires_at: string
  used_at: string | null
  used_by: string | null
  created_at: string
}

export interface RegistrationLinkWithPool extends RegistrationLink {
  pools: {
    id: string
    name: string
    slug: string
  }
}

export interface RegistrationData {
  name: string
  phone?: string
  email: string
  venmo_account: string
  notification_preferences?: {
    email: boolean
    sms: boolean
  }
}

// Create a registration link for a pool
export async function createRegistrationLink(poolId: string) {
  const { data, error } = await supabase
    .from('registration_links')
    .insert({
      pool_id: poolId,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    })
    .select()
    .single()

  if (error) throw error
  return data as RegistrationLink
}

// Validate a registration token OR pool slug
export async function validateRegistrationToken(tokenOrSlug: string) {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  // Check if it's a UUID (token) or a slug
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tokenOrSlug)

  if (isUUID) {
    // Token-based registration (legacy)
    const { data, error } = await supabase
      .from('registration_links')
      .select(`
        *,
        pools (
          id,
          name,
          slug
        )
      `)
      .eq('token', tokenOrSlug)
      .single()

    if (error) {
      console.error('Supabase error validating token:', error)
      throw error
    }

    if (!data) {
      throw new Error('Registration link not found')
    }

    const link = data as RegistrationLinkWithPool

    // Check if already used
    if (link.used_at) {
      throw new Error('This registration link has already been used')
    }

    // Check if expired
    if (new Date(link.expires_at) < new Date()) {
      throw new Error('This registration link has expired')
    }

    return link
  } else {
    // Slug-based registration (new multi-use flow)
    const { data: pool, error } = await supabase
      .from('pools')
      .select('id, name, slug, registration_enabled')
      .eq('slug', tokenOrSlug)
      .single()

    if (error || !pool) {
      throw new Error('Pool not found')
    }

    if (!pool.registration_enabled) {
      throw new Error('Registration is currently closed for this pool')
    }

    // Return a pseudo-link object for compatibility
    return {
      id: '', // Not needed for slug-based
      pool_id: pool.id,
      token: tokenOrSlug,
      created_by: null,
      expires_at: '', // Never expires
      used_at: null,
      used_by: null,
      created_at: '',
      pools: {
        id: pool.id,
        name: pool.name,
        slug: pool.slug,
      }
    } as RegistrationLinkWithPool
  }
}

// Register a player using a token or slug
export async function registerPlayer(tokenOrSlug: string, registrationData: RegistrationData) {
  // First validate the token/slug
  const link = await validateRegistrationToken(tokenOrSlug)

  // Check if UUID (token-based) or slug-based
  const isTokenBased = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tokenOrSlug)

  // Check if email already in this pool
  const { data: existingPlayer } = await supabase
    .from('players')
    .select('id')
    .eq('email', registrationData.email)
    .single()

  if (existingPlayer) {
    // Check if already in this pool
    const { data: existingPoolPlayer } = await supabase
      .from('pool_players')
      .select('id')
      .eq('pool_id', link.pool_id)
      .eq('player_id', existingPlayer.id)
      .eq('is_active', true)
      .single()

    if (existingPoolPlayer) {
      throw new Error('This email is already registered in this pool. Please log in instead.')
    }
  }

  // Create player record using security definer function to bypass RLS
  const { data: playerId, error: functionError } = await supabase.rpc(
    'create_player_for_registration',
    {
      p_name: registrationData.name,
      p_phone: registrationData.phone || null,
      p_email: registrationData.email,
      p_venmo_account: registrationData.venmo_account,
      p_notification_preferences: registrationData.notification_preferences || {
        email: true,
        sms: false,
      },
    }
  )

  if (functionError) {
    console.error('Error creating player:', functionError)
    throw functionError
  }
  if (!playerId) throw new Error('Failed to create player')

  // Fetch the created player (need to use the public RLS policy or another function)
  // Since we just created it, we can construct the player object from what we know
  // Or use a function to fetch it
  const player = {
    id: playerId,
    name: registrationData.name,
    phone: registrationData.phone || null,
    email: registrationData.email,
    venmo_account: registrationData.venmo_account,
    notification_preferences: registrationData.notification_preferences || {
      email: true,
      sms: false,
    },
    user_id: null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // Add player to pool
  const { error: poolPlayerError } = await supabase
    .from('pool_players')
    .insert({
      pool_id: link.pool_id,
      player_id: player.id,
      is_active: true,
    })

  if (poolPlayerError) throw poolPlayerError

  // Send notifications (fire-and-forget)
  // 1. Notify pool owner about new player
  notifyPlayerJoined(link.pool_id, player.id).catch((err) => {
    console.error('Failed to send player joined notification:', err)
  })
  
  // 2. Send welcome email to new player with upcoming sessions
  notifyPlayerWelcome(link.pool_id, player.id).catch((err) => {
    console.error('Failed to send welcome notification:', err)
  })

  // Only mark link as used if it's a token-based link
  if (isTokenBased && link.id) {
    const { error: linkError } = await supabase
      .from('registration_links')
      .update({
        used_at: new Date().toISOString(),
        used_by: player.id,
      })
      .eq('id', link.id)

    if (linkError) console.error('Error marking link as used:', linkError)
  }
  // Slug-based links are multi-use, so we don't mark them as used

  return {
    player,
    pool: link.pools,
  }
}

// Get registration links for a pool (admin only)
export async function getRegistrationLinks(poolId: string) {
  const { data, error } = await supabase
    .from('registration_links')
    .select('*')
    .eq('pool_id', poolId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as RegistrationLink[]
}

