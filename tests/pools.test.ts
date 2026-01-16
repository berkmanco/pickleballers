import { describe, it, expect, beforeAll } from 'vitest'
import { getServiceClient } from './setup'

describe('Pool Operations', () => {
  const supabase = getServiceClient()
  let testPoolId: string
  let testOwnerId: string

  beforeAll(async () => {
    // Get an existing pool from seed data (can't create new pools without auth user)
    const { data: pool } = await supabase
      .from('pools')
      .select('id, owner_id, slug')
      .limit(1)
      .single()
    
    if (!pool) throw new Error('No pools in seed data')
    testPoolId = pool.id
    testOwnerId = pool.owner_id
    console.log('Using pool:', testPoolId, 'owner:', testOwnerId)
  })

  // Note: Pool creation requires an auth.users entry, which isn't available in local tests
  // These tests use existing seed data instead
  describe('Get Pool', () => {
    it('should get pool by ID', async () => {
      const { data, error } = await supabase
        .from('pools')
        .select('*')
        .eq('id', testPoolId)
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.id).toBe(testPoolId)
    })

    it('should get pool by slug', async () => {
      // First get the slug
      const { data: pool } = await supabase
        .from('pools')
        .select('slug')
        .eq('id', testPoolId)
        .single()

      // Then query by slug
      const { data, error } = await supabase
        .from('pools')
        .select('*')
        .eq('slug', pool.slug)
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.slug).toBe(pool.slug)
    })

    it('should get pool with players', async () => {
      const { data, error } = await supabase
        .from('pools')
        .select(`
          *,
          pool_players (
            player:players (id, name, email)
          )
        `)
        .eq('id', testPoolId)
        .single()

      expect(error).toBeNull()
      expect(data.pool_players).toBeDefined()
      expect(data.pool_players.length).toBeGreaterThanOrEqual(1)
      console.log('Pool has', data.pool_players.length, 'players')
    })

    it('should get pool with owner_id', async () => {
      // Note: pools.owner_id references auth.users, not players table
      // To get owner player info, join through the matching player
      const { data, error } = await supabase
        .from('pools')
        .select('id, name, owner_id')
        .eq('id', testPoolId)
        .single()

      expect(error).toBeNull()
      expect(data.owner_id).toBeDefined()
      
      // Get owner's player record (same auth_user_id)
      const { data: ownerPlayer } = await supabase
        .from('players')
        .select('id, name, email')
        .eq('auth_user_id', data.owner_id)
        .single()

      expect(ownerPlayer).toBeDefined()
      console.log('Pool owner:', ownerPlayer?.name)
    })
  })

  describe('Update Pool', () => {
    it('should update pool name', async () => {
      // Get current name
      const { data: before } = await supabase
        .from('pools')
        .select('name')
        .eq('id', testPoolId)
        .single()

      const originalName = before.name
      const newName = `Updated ${Date.now()}`

      // Update
      const { data, error } = await supabase
        .from('pools')
        .update({ name: newName })
        .eq('id', testPoolId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.name).toBe(newName)

      // Restore original name
      await supabase
        .from('pools')
        .update({ name: originalName })
        .eq('id', testPoolId)
    })
  })

  describe('Pool Players', () => {
    it('should list pool players', async () => {
      const { data, error } = await supabase
        .from('pool_players')
        .select(`
          is_active,
          joined_at,
          player:players (id, name, email)
        `)
        .eq('pool_id', testPoolId)
        .eq('is_active', true)

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.length).toBeGreaterThanOrEqual(1)
      console.log('Active players:', data.length)
    })

    it('should check if player is in pool', async () => {
      // Get any player that's in the pool
      const { data: poolPlayer } = await supabase
        .from('pool_players')
        .select('player_id')
        .eq('pool_id', testPoolId)
        .limit(1)
        .single()

      expect(poolPlayer).toBeDefined()
      
      // Check they're in the pool
      const { data, error } = await supabase
        .from('pool_players')
        .select('player_id, is_active')
        .eq('pool_id', testPoolId)
        .eq('player_id', poolPlayer.player_id)
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.player_id).toBe(poolPlayer.player_id)
    })
  })

  describe('Pool Queries', () => {
    it('should list all pools', async () => {
      const { data, error } = await supabase
        .from('pools')
        .select('id, name, slug')

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.length).toBeGreaterThanOrEqual(1)
      console.log('Total pools:', data.length)
    })

    it('should get pools for a specific owner', async () => {
      const { data, error } = await supabase
        .from('pools')
        .select('id, name')
        .eq('owner_id', testOwnerId)

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.length).toBeGreaterThanOrEqual(1)
    })
  })
})

describe('Registration Links', () => {
  const supabase = getServiceClient()
  const linksToCleanup: string[] = []
  let testPoolId: string

  beforeAll(async () => {
    // Get a pool from seed data
    const { data: pool } = await supabase
      .from('pools')
      .select('id')
      .limit(1)
      .single()

    if (!pool) throw new Error('No pools in seed data')
    testPoolId = pool.id
  })

  afterEach(async () => {
    for (const linkId of linksToCleanup) {
      await supabase.from('registration_links').delete().eq('id', linkId)
    }
    linksToCleanup.length = 0
  })

  it('should create a registration link', async () => {
    const { data, error } = await supabase
      .from('registration_links')
      .insert({
        pool_id: testPoolId,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      })
      .select()
      .single()

    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data.token).toBeDefined()
    expect(data.pool_id).toBe(testPoolId)
    expect(data.used_at).toBeNull()

    linksToCleanup.push(data.id)
    console.log('Created registration link:', data.token)
  })

  it('should get registration link by token', async () => {
    // Create link
    const { data: link } = await supabase
      .from('registration_links')
      .insert({
        pool_id: testPoolId,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    linksToCleanup.push(link.id)

    // Get by token
    const { data, error } = await supabase
      .from('registration_links')
      .select('*, pool:pools(id, name)')
      .eq('token', link.token)
      .single()

    expect(error).toBeNull()
    expect(data.token).toBe(link.token)
    expect(data.pool).toBeDefined()
  })

  it('should mark link as used', async () => {
    // Create link
    const { data: link } = await supabase
      .from('registration_links')
      .insert({
        pool_id: testPoolId,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    linksToCleanup.push(link.id)

    // Mark as used
    const { data, error } = await supabase
      .from('registration_links')
      .update({ used_at: new Date().toISOString() })
      .eq('id', link.id)
      .select()
      .single()

    expect(error).toBeNull()
    expect(data.used_at).not.toBeNull()
  })
})
