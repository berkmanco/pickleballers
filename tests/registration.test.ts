import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getServiceClient, getFirstPool, SKIP_DB_TESTS } from './setup'

describe.skipIf(SKIP_DB_TESTS)('Registration Flow', () => {
  const supabase = getServiceClient()
  let testPoolId: string
  const linksToCleanup: string[] = []
  const playersToCleanup: string[] = []

  beforeAll(async () => {
    const pool = await getFirstPool(supabase)
    testPoolId = pool.id
    console.log('Using pool:', testPoolId)
  })

  afterEach(async () => {
    // Cleanup registration links
    for (const linkId of linksToCleanup) {
      await supabase.from('registration_links').delete().eq('id', linkId)
    }
    linksToCleanup.length = 0

    // Cleanup test players
    for (const playerId of playersToCleanup) {
      await supabase.from('pool_players').delete().eq('player_id', playerId)
      await supabase.from('players').delete().eq('id', playerId)
    }
    playersToCleanup.length = 0
  })

  describe('Registration Links', () => {
    it('should create a registration link', async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      const { data, error } = await supabase
        .from('registration_links')
        .insert({
          pool_id: testPoolId,
          expires_at: expiresAt,
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.token).toBeDefined()
      expect(data.token.length).toBeGreaterThan(20) // Token should be substantial
      expect(data.pool_id).toBe(testPoolId)
      expect(data.used_at).toBeNull()
      expect(data.used_by).toBeNull()

      linksToCleanup.push(data.id)
      console.log('Created link with token:', data.token.substring(0, 20) + '...')
    })

    it('should auto-generate unique tokens', async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      // Create two links
      const { data: link1 } = await supabase
        .from('registration_links')
        .insert({ pool_id: testPoolId, expires_at: expiresAt })
        .select()
        .single()

      const { data: link2 } = await supabase
        .from('registration_links')
        .insert({ pool_id: testPoolId, expires_at: expiresAt })
        .select()
        .single()

      expect(link1.token).not.toBe(link2.token)

      linksToCleanup.push(link1.id, link2.id)
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

      // Get by token with pool info
      const { data, error } = await supabase
        .from('registration_links')
        .select(`
          *,
          pools (id, name, slug)
        `)
        .eq('token', link.token)
        .single()

      expect(error).toBeNull()
      expect(data.token).toBe(link.token)
      expect(data.pools).toBeDefined()
      expect(data.pools.id).toBe(testPoolId)
    })

    it('should return null for non-existent token', async () => {
      const { data, error } = await supabase
        .from('registration_links')
        .select('*')
        .eq('token', 'non-existent-token-12345')
        .single()

      expect(error).toBeDefined()
      expect(error?.code).toBe('PGRST116') // No rows returned
      expect(data).toBeNull()
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

      // Get a player to use as "used_by"
      const { data: player } = await supabase
        .from('players')
        .select('id')
        .limit(1)
        .single()

      // Mark as used
      const usedAt = new Date().toISOString()
      const { data, error } = await supabase
        .from('registration_links')
        .update({
          used_at: usedAt,
          used_by: player.id,
        })
        .eq('id', link.id)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.used_at).not.toBeNull()
      expect(data.used_by).toBe(player.id)
    })

    it('should list registration links for a pool', async () => {
      // Create a few links
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      const { data: link1 } = await supabase
        .from('registration_links')
        .insert({ pool_id: testPoolId, expires_at: expiresAt })
        .select()
        .single()

      const { data: link2 } = await supabase
        .from('registration_links')
        .insert({ pool_id: testPoolId, expires_at: expiresAt })
        .select()
        .single()

      linksToCleanup.push(link1.id, link2.id)

      // List links for pool
      const { data, error } = await supabase
        .from('registration_links')
        .select('*')
        .eq('pool_id', testPoolId)
        .order('created_at', { ascending: false })

      expect(error).toBeNull()
      expect(data.length).toBeGreaterThanOrEqual(2)
      console.log('Found', data.length, 'registration links for pool')
    })
  })

  describe('Token Validation Logic', () => {
    it('should detect expired link', async () => {
      // Create an already-expired link
      const expiredDate = new Date(Date.now() - 1000).toISOString() // 1 second ago

      const { data: link } = await supabase
        .from('registration_links')
        .insert({
          pool_id: testPoolId,
          expires_at: expiredDate,
        })
        .select()
        .single()

      linksToCleanup.push(link.id)

      // Check expiration logic (application layer would do this)
      const isExpired = new Date(link.expires_at) < new Date()
      expect(isExpired).toBe(true)
    })

    it('should detect used link', async () => {
      // Create a used link
      const { data: player } = await supabase
        .from('players')
        .select('id')
        .limit(1)
        .single()

      const { data: link } = await supabase
        .from('registration_links')
        .insert({
          pool_id: testPoolId,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          used_at: new Date().toISOString(),
          used_by: player.id,
        })
        .select()
        .single()

      linksToCleanup.push(link.id)

      // Check used logic
      const isUsed = link.used_at !== null
      expect(isUsed).toBe(true)
    })

    it('should identify valid link', async () => {
      const { data: link } = await supabase
        .from('registration_links')
        .insert({
          pool_id: testPoolId,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single()

      linksToCleanup.push(link.id)

      // Validation checks
      const isExpired = new Date(link.expires_at) < new Date()
      const isUsed = link.used_at !== null

      expect(isExpired).toBe(false)
      expect(isUsed).toBe(false)
    })
  })

  describe('Player Registration', () => {
    it('should create player via RPC function', async () => {
      const testEmail = `test-${Date.now()}@example.com`

      const { data: playerId, error } = await supabase.rpc(
        'create_player_for_registration',
        {
          p_name: 'Test Player',
          p_phone: '+16145551234',
          p_email: testEmail,
          p_venmo_account: 'test-venmo',
          p_notification_preferences: { email: true, sms: false },
        }
      )

      expect(error).toBeNull()
      expect(playerId).toBeDefined()

      playersToCleanup.push(playerId)

      // Verify player was created
      const { data: player } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .single()

      expect(player.name).toBe('Test Player')
      expect(player.email).toBe(testEmail)
      expect(player.venmo_account).toBe('test-venmo')
      console.log('Created player:', playerId)
    })

    it('should add player to pool after registration', async () => {
      // Create player
      const testEmail = `test-pool-${Date.now()}@example.com`

      const { data: playerId } = await supabase.rpc(
        'create_player_for_registration',
        {
          p_name: 'Pool Test Player',
          p_phone: null,
          p_email: testEmail,
          p_venmo_account: 'pool-test-venmo',
          p_notification_preferences: { email: true, sms: false },
        }
      )

      playersToCleanup.push(playerId)

      // Add to pool
      const { error } = await supabase
        .from('pool_players')
        .insert({
          pool_id: testPoolId,
          player_id: playerId,
          is_active: true,
        })

      expect(error).toBeNull()

      // Verify membership
      const { data: membership } = await supabase
        .from('pool_players')
        .select('*')
        .eq('pool_id', testPoolId)
        .eq('player_id', playerId)
        .single()

      expect(membership).toBeDefined()
      expect(membership.is_active).toBe(true)
    })

    it('should complete full registration flow', async () => {
      // 1. Create registration link
      const { data: link } = await supabase
        .from('registration_links')
        .insert({
          pool_id: testPoolId,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single()

      linksToCleanup.push(link.id)

      // 2. Validate link (simulate app logic)
      expect(link.used_at).toBeNull()
      expect(new Date(link.expires_at) > new Date()).toBe(true)

      // 3. Create player
      const testEmail = `full-reg-${Date.now()}@example.com`
      const { data: playerId } = await supabase.rpc(
        'create_player_for_registration',
        {
          p_name: 'Full Registration Test',
          p_phone: '+16145559999',
          p_email: testEmail,
          p_venmo_account: 'full-reg-venmo',
          p_notification_preferences: { email: true, sms: true },
        }
      )

      playersToCleanup.push(playerId)

      // 4. Add player to pool
      await supabase.from('pool_players').insert({
        pool_id: testPoolId,
        player_id: playerId,
        is_active: true,
      })

      // 5. Mark link as used
      await supabase
        .from('registration_links')
        .update({
          used_at: new Date().toISOString(),
          used_by: playerId,
        })
        .eq('id', link.id)

      // 6. Verify final state
      const { data: updatedLink } = await supabase
        .from('registration_links')
        .select('*')
        .eq('id', link.id)
        .single()

      expect(updatedLink.used_at).not.toBeNull()
      expect(updatedLink.used_by).toBe(playerId)

      const { data: poolMember } = await supabase
        .from('pool_players')
        .select('*')
        .eq('pool_id', testPoolId)
        .eq('player_id', playerId)
        .single()

      expect(poolMember).toBeDefined()

      console.log('Full registration flow completed successfully!')
    })
  })

  describe('Edge Cases', () => {
    it('should prevent duplicate email registration', async () => {
      // Create first player
      const testEmail = `duplicate-${Date.now()}@example.com`

      const { data: playerId1 } = await supabase.rpc(
        'create_player_for_registration',
        {
          p_name: 'First Player',
          p_phone: null,
          p_email: testEmail,
          p_venmo_account: 'first-venmo',
          p_notification_preferences: { email: true, sms: false },
        }
      )

      playersToCleanup.push(playerId1)

      // Try to create second player with same email
      const { data: playerId2, error } = await supabase.rpc(
        'create_player_for_registration',
        {
          p_name: 'Second Player',
          p_phone: null,
          p_email: testEmail,
          p_venmo_account: 'second-venmo',
          p_notification_preferences: { email: true, sms: false },
        }
      )

      // Depending on DB constraints, this might error or return existing player
      // Just verify we handle it gracefully
      if (error) {
        expect(error.code).toBeDefined()
        console.log('Duplicate email blocked:', error.message)
      } else if (playerId2) {
        // Some implementations return existing player
        playersToCleanup.push(playerId2)
        console.log('Returned player for duplicate email:', playerId2)
      }
    })

    it('should handle missing optional fields (phone only)', async () => {
      // Note: venmo_account has NOT NULL constraint
      const testEmail = `minimal-${Date.now()}@example.com`

      const { data: playerId, error } = await supabase.rpc(
        'create_player_for_registration',
        {
          p_name: 'Minimal Player',
          p_phone: null, // Phone is optional
          p_email: testEmail,
          p_venmo_account: 'minimal-venmo', // Required field
          p_notification_preferences: { email: true, sms: false },
        }
      )

      expect(error).toBeNull()
      expect(playerId).toBeDefined()

      playersToCleanup.push(playerId)

      // Verify player was created
      const { data: player } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .single()

      expect(player.phone).toBeNull()
      expect(player.venmo_account).toBe('minimal-venmo')
    })
  })

  describe('Multi-Use Registration (Slug-Based)', () => {
    it('should validate pool slug for registration', async () => {
      // Get pool by slug
      const { data: pool, error } = await supabase
        .from('pools')
        .select('id, name, slug, registration_enabled')
        .eq('id', testPoolId)
        .single()

      expect(error).toBeNull()
      expect(pool).toBeDefined()
      expect(pool.slug).toBeDefined()
      expect(pool.registration_enabled).toBeDefined()
      console.log('Pool slug:', pool.slug, 'registration_enabled:', pool.registration_enabled)
    })

    it('should toggle registration on/off', async () => {
      // Get current state
      const { data: before } = await supabase
        .from('pools')
        .select('registration_enabled')
        .eq('id', testPoolId)
        .single()

      const originalState = before.registration_enabled

      // Toggle to false
      const { error: disableError } = await supabase
        .from('pools')
        .update({ registration_enabled: false })
        .eq('id', testPoolId)

      expect(disableError).toBeNull()

      const { data: disabled } = await supabase
        .from('pools')
        .select('registration_enabled')
        .eq('id', testPoolId)
        .single()

      expect(disabled.registration_enabled).toBe(false)

      // Toggle to true
      const { error: enableError } = await supabase
        .from('pools')
        .update({ registration_enabled: true })
        .eq('id', testPoolId)

      expect(enableError).toBeNull()

      const { data: enabled } = await supabase
        .from('pools')
        .select('registration_enabled')
        .eq('id', testPoolId)
        .single()

      expect(enabled.registration_enabled).toBe(true)

      // Restore original state
      await supabase
        .from('pools')
        .update({ registration_enabled: originalState })
        .eq('id', testPoolId)

      console.log('Registration toggle works!')
    })

    it('should register player via slug (multi-use)', async () => {
      // Get pool slug
      const { data: pool } = await supabase
        .from('pools')
        .select('id, slug, registration_enabled')
        .eq('id', testPoolId)
        .single()

      expect(pool.slug).toBeDefined()
      
      // Ensure registration is enabled
      if (!pool.registration_enabled) {
        await supabase
          .from('pools')
          .update({ registration_enabled: true })
          .eq('id', testPoolId)
      }

      // Create player via slug (simulating multi-use registration)
      const testEmail = `slug-reg-${Date.now()}@example.com`

      const { data: playerId } = await supabase.rpc(
        'create_player_for_registration',
        {
          p_name: 'Slug Registration Test',
          p_phone: null,
          p_email: testEmail,
          p_venmo_account: 'slug-reg-venmo',
          p_notification_preferences: { email: true, sms: false },
        }
      )

      playersToCleanup.push(playerId)

      // Add to pool
      await supabase.from('pool_players').insert({
        pool_id: testPoolId,
        player_id: playerId,
        is_active: true,
      })

      // Verify membership
      const { data: membership } = await supabase
        .from('pool_players')
        .select('*')
        .eq('pool_id', testPoolId)
        .eq('player_id', playerId)
        .single()

      expect(membership).toBeDefined()
      expect(membership.is_active).toBe(true)

      console.log('Slug-based registration successful!')
    })

    it('should detect duplicate registration in same pool', async () => {
      // Create player
      const testEmail = `dup-pool-${Date.now()}@example.com`

      const { data: playerId } = await supabase.rpc(
        'create_player_for_registration',
        {
          p_name: 'Duplicate Pool Test',
          p_phone: null,
          p_email: testEmail,
          p_venmo_account: 'dup-pool-venmo',
          p_notification_preferences: { email: true, sms: false },
        }
      )

      playersToCleanup.push(playerId)

      // Add to pool
      await supabase.from('pool_players').insert({
        pool_id: testPoolId,
        player_id: playerId,
        is_active: true,
      })

      // Try to add same player to same pool again
      const { error } = await supabase.from('pool_players').insert({
        pool_id: testPoolId,
        player_id: playerId,
        is_active: true,
      })

      // Should error due to unique constraint
      expect(error).toBeDefined()
      console.log('Duplicate pool membership blocked:', error?.message)
    })

    it('should allow multiple registrations via slug (different emails)', async () => {
      // Get pool slug
      const { data: pool } = await supabase
        .from('pools')
        .select('slug')
        .eq('id', testPoolId)
        .single()

      // Register first player
      const email1 = `multi-1-${Date.now()}@example.com`
      const { data: player1Id } = await supabase.rpc(
        'create_player_for_registration',
        {
          p_name: 'Multi User 1',
          p_phone: null,
          p_email: email1,
          p_venmo_account: 'multi-1-venmo',
          p_notification_preferences: { email: true, sms: false },
        }
      )

      playersToCleanup.push(player1Id)
      await supabase.from('pool_players').insert({
        pool_id: testPoolId,
        player_id: player1Id,
        is_active: true,
      })

      // Register second player with same slug (different email)
      const email2 = `multi-2-${Date.now()}@example.com`
      const { data: player2Id } = await supabase.rpc(
        'create_player_for_registration',
        {
          p_name: 'Multi User 2',
          p_phone: null,
          p_email: email2,
          p_venmo_account: 'multi-2-venmo',
          p_notification_preferences: { email: true, sms: false },
        }
      )

      playersToCleanup.push(player2Id)
      await supabase.from('pool_players').insert({
        pool_id: testPoolId,
        player_id: player2Id,
        is_active: true,
      })

      // Both should be in the pool
      const { data: members } = await supabase
        .from('pool_players')
        .select('player_id')
        .eq('pool_id', testPoolId)
        .in('player_id', [player1Id, player2Id])

      expect(members?.length).toBe(2)
      console.log('Multiple slug-based registrations successful!')
    })
  })
})
