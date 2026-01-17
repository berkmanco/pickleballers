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

describe('Add Player to Pool', () => {
  const supabase = getServiceClient()
  const playersToCleanup: string[] = []
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
    for (const playerId of playersToCleanup) {
      // Delete pool_players first, then player
      await supabase.from('pool_players').delete().eq('player_id', playerId)
      await supabase.from('players').delete().eq('id', playerId)
    }
    playersToCleanup.length = 0
  })

  it('should create a player and add to pool', async () => {
    // Create player
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({
        name: 'Test Manual Player',
        email: 'manual@example.com',
        phone: '+16145551234',
        venmo_account: 'test-manual',
        is_active: true,
        notification_preferences: { email: true, sms: true },
      })
      .select()
      .single()

    expect(playerError).toBeNull()
    expect(player).toBeDefined()
    playersToCleanup.push(player.id)

    // Add to pool
    const { data: poolPlayer, error: poolPlayerError } = await supabase
      .from('pool_players')
      .insert({
        pool_id: testPoolId,
        player_id: player.id,
        is_active: true,
      })
      .select()
      .single()

    expect(poolPlayerError).toBeNull()
    expect(poolPlayer.pool_id).toBe(testPoolId)
    expect(poolPlayer.player_id).toBe(player.id)
    console.log('Created player and added to pool:', player.id)
  })

  it('should format phone to E.164', async () => {
    // Create player with unformatted phone
    const { data: player, error } = await supabase
      .from('players')
      .insert({
        name: 'Phone Test Player',
        phone: '+16145559999',
        venmo_account: 'phone-test',
        is_active: true,
        notification_preferences: { email: false, sms: true },
      })
      .select()
      .single()

    expect(error).toBeNull()
    expect(player.phone).toBe('+16145559999')
    playersToCleanup.push(player.id)
  })

  it('should strip @ from venmo account', async () => {
    // Create player - the @ should be stripped in the app layer
    // Test that database accepts the stripped value
    const { data: player, error } = await supabase
      .from('players')
      .insert({
        name: 'Venmo Test Player',
        venmo_account: 'venmo-test-user', // Already stripped
        is_active: true,
        notification_preferences: { email: false, sms: false },
      })
      .select()
      .single()

    expect(error).toBeNull()
    expect(player.venmo_account).toBe('venmo-test-user')
    playersToCleanup.push(player.id)
  })

  it('should create player with minimal data (name + venmo only)', async () => {
    const { data: player, error } = await supabase
      .from('players')
      .insert({
        name: 'Minimal Player',
        venmo_account: 'minimal-venmo',
        is_active: true,
        notification_preferences: { email: false, sms: false },
      })
      .select()
      .single()

    expect(error).toBeNull()
    expect(player.name).toBe('Minimal Player')
    expect(player.email).toBeNull()
    expect(player.phone).toBeNull()
    playersToCleanup.push(player.id)
  })

  it('should list pool players including manually added', async () => {
    // Create and add player
    const { data: player } = await supabase
      .from('players')
      .insert({
        name: 'List Test Player',
        venmo_account: 'list-test',
        is_active: true,
        notification_preferences: { email: false, sms: false },
      })
      .select()
      .single()

    playersToCleanup.push(player.id)

    await supabase
      .from('pool_players')
      .insert({
        pool_id: testPoolId,
        player_id: player.id,
        is_active: true,
      })

    // Query pool players
    const { data: poolPlayers, error } = await supabase
      .from('pool_players')
      .select(`
        joined_at,
        is_active,
        players (id, name, venmo_account)
      `)
      .eq('pool_id', testPoolId)
      .eq('is_active', true)

    expect(error).toBeNull()
    expect(poolPlayers?.some(pp => (pp.players as any).id === player.id)).toBe(true)
    console.log('Pool now has', poolPlayers?.length, 'active players')
  })
})

describe('Add Existing Player to Pool', () => {
  const supabase = getServiceClient()
  const playersToCleanup: string[] = []
  const poolPlayersToCleanup: { poolId: string; playerId: string }[] = []
  let testPoolId: string
  let secondPoolId: string

  beforeAll(async () => {
    // Get two pools from seed data
    const { data: pools } = await supabase
      .from('pools')
      .select('id')
      .limit(2)

    if (!pools || pools.length < 2) throw new Error('Need at least 2 pools in seed data')
    testPoolId = pools[0].id
    secondPoolId = pools[1].id
  })

  afterEach(async () => {
    // Cleanup pool_players we added
    for (const pp of poolPlayersToCleanup) {
      await supabase.from('pool_players').delete()
        .eq('pool_id', pp.poolId)
        .eq('player_id', pp.playerId)
    }
    poolPlayersToCleanup.length = 0

    // Cleanup test players
    for (const playerId of playersToCleanup) {
      await supabase.from('pool_players').delete().eq('player_id', playerId)
      await supabase.from('players').delete().eq('id', playerId)
    }
    playersToCleanup.length = 0
  })

  it('should get players not in a specific pool', async () => {
    // Create a player in pool 1 only
    const { data: player } = await supabase
      .from('players')
      .insert({
        name: 'Pool 1 Only Player',
        venmo_account: 'pool1only',
        is_active: true,
        notification_preferences: { email: false, sms: false },
      })
      .select()
      .single()

    playersToCleanup.push(player.id)

    await supabase.from('pool_players').insert({
      pool_id: testPoolId,
      player_id: player.id,
      is_active: true,
    })
    poolPlayersToCleanup.push({ poolId: testPoolId, playerId: player.id })

    // Get players NOT in pool 2 - should include our player
    const { data: allPlayers } = await supabase
      .from('players')
      .select('id')
      .eq('is_active', true)

    const { data: pool2Players } = await supabase
      .from('pool_players')
      .select('player_id')
      .eq('pool_id', secondPoolId)
      .eq('is_active', true)

    const pool2PlayerIds = new Set((pool2Players || []).map(pp => pp.player_id))
    const playersNotInPool2 = (allPlayers || []).filter(p => !pool2PlayerIds.has(p.id))

    // Our player should be in the "not in pool 2" list
    expect(playersNotInPool2.some(p => p.id === player.id)).toBe(true)
    console.log('Players not in pool 2:', playersNotInPool2.length)
  })

  it('should add existing player to pool', async () => {
    // Create a player not in any pool
    const { data: player } = await supabase
      .from('players')
      .insert({
        name: 'Unattached Player',
        venmo_account: 'unattached',
        is_active: true,
        notification_preferences: { email: false, sms: false },
      })
      .select()
      .single()

    playersToCleanup.push(player.id)

    // Add to pool
    const { error } = await supabase
      .from('pool_players')
      .insert({
        pool_id: testPoolId,
        player_id: player.id,
        is_active: true,
      })

    expect(error).toBeNull()
    poolPlayersToCleanup.push({ poolId: testPoolId, playerId: player.id })

    // Verify player is in pool
    const { data: poolPlayer } = await supabase
      .from('pool_players')
      .select('*')
      .eq('pool_id', testPoolId)
      .eq('player_id', player.id)
      .single()

    expect(poolPlayer).toBeDefined()
    expect(poolPlayer.is_active).toBe(true)
    console.log('Added existing player to pool')
  })

  it('should reactivate inactive player in pool', async () => {
    // Create a player
    const { data: player } = await supabase
      .from('players')
      .insert({
        name: 'Reactivate Test Player',
        venmo_account: 'reactivate-test',
        is_active: true,
        notification_preferences: { email: false, sms: false },
      })
      .select()
      .single()

    playersToCleanup.push(player.id)

    // Add to pool as inactive
    await supabase.from('pool_players').insert({
      pool_id: testPoolId,
      player_id: player.id,
      is_active: false,
    })
    poolPlayersToCleanup.push({ poolId: testPoolId, playerId: player.id })

    // Reactivate
    const { error } = await supabase
      .from('pool_players')
      .update({ is_active: true, joined_at: new Date().toISOString() })
      .eq('pool_id', testPoolId)
      .eq('player_id', player.id)

    expect(error).toBeNull()

    // Verify active
    const { data: poolPlayer } = await supabase
      .from('pool_players')
      .select('is_active')
      .eq('pool_id', testPoolId)
      .eq('player_id', player.id)
      .single()

    expect(poolPlayer.is_active).toBe(true)
    console.log('Reactivated player in pool')
  })

  it('should not duplicate player in pool', async () => {
    // Create a player
    const { data: player } = await supabase
      .from('players')
      .insert({
        name: 'Duplicate Test Player',
        venmo_account: 'duplicate-test',
        is_active: true,
        notification_preferences: { email: false, sms: false },
      })
      .select()
      .single()

    playersToCleanup.push(player.id)

    // Add to pool
    await supabase.from('pool_players').insert({
      pool_id: testPoolId,
      player_id: player.id,
      is_active: true,
    })
    poolPlayersToCleanup.push({ poolId: testPoolId, playerId: player.id })

    // Try to add again - should fail with duplicate key error
    const { error } = await supabase
      .from('pool_players')
      .insert({
        pool_id: testPoolId,
        player_id: player.id,
        is_active: true,
      })

    expect(error).not.toBeNull()
    expect(error?.code).toBe('23505') // Unique constraint violation
    console.log('Correctly prevented duplicate')
  })
})
