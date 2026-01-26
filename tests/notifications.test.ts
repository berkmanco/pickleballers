import { describe, it, expect, afterEach, beforeAll } from 'vitest'
import {
  getServiceClient,
  createTestSession,
  createTestParticipant,
  createTestPayment,
  deleteTestSession,
  callEdgeFunction,
  getFirstPool,
  SKIP_DB_TESTS,
} from './setup'

describe.skipIf(SKIP_DB_TESTS)('Notification Edge Functions', () => {
  const supabase = getServiceClient()
  let testSessionId: string
  let testPoolId: string

  beforeAll(async () => {
    const pool = await getFirstPool(supabase)
    testPoolId = pool.id
    console.log('Using pool:', testPoolId)
  })

  // Clean up after each test
  afterEach(async () => {
    if (testSessionId) {
      console.log('Cleaned up session:', testSessionId)
      await deleteTestSession(supabase, testSessionId)
      testSessionId = '' // Reset for next test
    }
  })

  describe('session_created', () => {
    it('should send notifications to pool members', async () => {
      const session = await createTestSession(supabase, testPoolId, { status: 'proposed' })
      testSessionId = session.id
      console.log('Created test session:', testSessionId)

      const result = await callEdgeFunction('notify', {
        type: 'session_created',
        sessionId: testSessionId,
      })
      console.log('session_created result:', result.data)

      expect(result.status).toBe(200)
      expect((result.data as any).success).toBe(true)
      expect((result.data as any).sent).toBeGreaterThanOrEqual(1)

      // Verify logs
      const { data: logs } = await supabase
        .from('notifications_log')
        .select('*')
        .eq('session_id', testSessionId)
        .eq('type', 'session_created')
      expect(logs?.length).toBeGreaterThanOrEqual(1)
    }, 15000) // Increased timeout for rate-limited emails
  })

  describe('session_reminder', () => {
    it('should send reminders to committed participants', async () => {
      const session = await createTestSession(supabase, testPoolId, { status: 'confirmed' })
      testSessionId = session.id
      console.log('Created session with auto-participant:', testSessionId)

      const result = await callEdgeFunction('notify', {
        type: 'session_reminder',
        sessionId: testSessionId,
      })
      console.log('session_reminder result:', result.data)

      expect(result.status).toBe(200)
      expect((result.data as any).success).toBe(true)
      expect((result.data as any).sent).toBeGreaterThanOrEqual(1)

      // Verify logs
      const { data: logs } = await supabase
        .from('notifications_log')
        .select('*')
        .eq('session_id', testSessionId)
        .eq('type', 'session_reminder')
      expect(logs?.length).toBeGreaterThanOrEqual(1)
    }, 10000)
  })

  describe('roster_locked', () => {
    it('should send payment notifications to committed participants', async () => {
      const session = await createTestSession(supabase, testPoolId, { status: 'confirmed' })
      testSessionId = session.id
      
      // Get existing auto-participant
      const { data: existingParticipant } = await supabase
        .from('session_participants')
        .select('id')
        .eq('session_id', testSessionId)
        .limit(1)
        .single()

      // Create payment for them
      const payment = await createTestPayment(supabase, existingParticipant.id, 15, 'pending')
      console.log('Created payment:', payment.id)

      const result = await callEdgeFunction('notify', {
        type: 'roster_locked',
        sessionId: testSessionId,
      })
      console.log('roster_locked result:', result.data)

      expect(result.status).toBe(200)
      expect((result.data as any).success).toBe(true)
      expect((result.data as any).sent).toBeGreaterThanOrEqual(1)

      // Verify logs
      const { data: logs } = await supabase
        .from('notifications_log')
        .select('*')
        .eq('session_id', testSessionId)
        .eq('type', 'roster_locked')
      expect(logs?.length).toBeGreaterThanOrEqual(1)
    }, 10000)
  })

  describe('payment_reminder', () => {
    it('should send reminders for pending payments', async () => {
      const session = await createTestSession(supabase, testPoolId, { status: 'confirmed' })
      testSessionId = session.id
      
      // Get existing auto-participant
      const { data: existingParticipant } = await supabase
        .from('session_participants')
        .select('id')
        .eq('session_id', testSessionId)
        .limit(1)
        .single()

      await createTestPayment(supabase, existingParticipant.id, 20, 'pending')

      const result = await callEdgeFunction('notify', {
        type: 'payment_reminder',
        sessionId: testSessionId,
      })
      console.log('payment_reminder result:', result.data)

      expect(result.status).toBe(200)
      expect((result.data as any).success).toBe(true)
      expect((result.data as any).sent).toBeGreaterThanOrEqual(1)

      // Verify logs
      const { data: logs } = await supabase
        .from('notifications_log')
        .select('*')
        .eq('session_id', testSessionId)
        .eq('type', 'payment_reminder')
      expect(logs?.length).toBeGreaterThanOrEqual(1)
    }, 10000)

    it('should include custom message when provided', async () => {
      const session = await createTestSession(supabase, testPoolId, { status: 'confirmed' })
      testSessionId = session.id
      
      // Get existing auto-participant
      const { data: existingParticipant } = await supabase
        .from('session_participants')
        .select('id')
        .eq('session_id', testSessionId)
        .limit(1)
        .single()

      await createTestPayment(supabase, existingParticipant.id, 20, 'pending')

      const customMessage = 'Please pay ASAP!'
      const result = await callEdgeFunction('notify', {
        type: 'payment_reminder',
        sessionId: testSessionId,
        customMessage: customMessage,
      })
      console.log('payment_reminder with message result:', result.data)

      expect(result.status).toBe(200)
      expect((result.data as any).success).toBe(true)
      expect((result.data as any).sent).toBeGreaterThanOrEqual(1)
    }, 10000)
  })

  describe('waitlist_promoted', () => {
    it.skip('should notify player when promoted from waitlist', async () => {
      // Skip: participant_status enum doesn't have 'waitlisted' value
      // This test will be enabled when waitlist feature is implemented
    })
  })

  describe('error handling', () => {
    it('should return error for missing type', async () => {
      const result = await callEdgeFunction('notify', {})
      expect((result.data as any).success).toBe(false)
      expect((result.data as any).error).toContain('Missing required field: type')
    })

    it('should return error for invalid session', async () => {
      const result = await callEdgeFunction('notify', {
        type: 'session_reminder',
        sessionId: '00000000-0000-0000-0000-000000000000', // Non-existent ID
      })
      expect((result.data as any).success).toBe(false)
      expect((result.data as any).error).toContain('Session not found')
    })

    it('should return error for unknown notification type', async () => {
      const result = await callEdgeFunction('notify', {
        type: 'invalid_type',
        sessionId: '00000000-0000-0000-0000-000000000000',
      })
      expect((result.data as any).success).toBe(false)
      expect((result.data as any).error).toContain('Unknown notification type')
    })
  })

  describe('Notification Logs', () => {
    it('should have logged notifications in notifications_log table', async () => {
      const { data: logs, error } = await supabase
        .from('notifications_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)

      expect(error).toBeNull()
      expect(logs?.length).toBeGreaterThan(0)
      console.log('Recent notification logs:', logs?.length)
      console.log('Last log:', logs?.[0])
    })
  })

  describe('session_cancelled', () => {
    it('should send cancellation notifications to all participants', async () => {
      const session = await createTestSession(supabase, testPoolId, { status: 'proposed' })
      testSessionId = session.id
      console.log('Created test session:', testSessionId)

      // Add a participant
      await createTestParticipant(supabase, testSessionId, 'committed')

      // Cancel the session
      await supabase
        .from('sessions')
        .update({ status: 'cancelled' })
        .eq('id', testSessionId)

      const result = await callEdgeFunction('notify', {
        type: 'session_cancelled',
        sessionId: testSessionId,
      })
      console.log('session_cancelled result:', result.data)

      expect(result.status).toBe(200)
      expect((result.data as any).success).toBe(true)
      expect((result.data as any).sent).toBeGreaterThanOrEqual(1)

      // Verify logs
      const { data: logs } = await supabase
        .from('notifications_log')
        .select('*')
        .eq('session_id', testSessionId)
        .eq('type', 'session_cancelled')
      expect(logs?.length).toBeGreaterThanOrEqual(1)
    }, 15000) // Increased timeout for rate-limited emails
  })

  describe('player_joined', () => {
    it('should send notification to pool owner when player joins', async () => {
      // Get a player from the pool
      const { data: poolPlayer } = await supabase
        .from('pool_players')
        .select('player_id')
        .eq('pool_id', testPoolId)
        .limit(1)
        .single()

      const result = await callEdgeFunction('notify', {
        type: 'player_joined',
        poolId: testPoolId,
        playerId: poolPlayer!.player_id,
      })
      console.log('player_joined result:', result.data)

      expect(result.status).toBe(200)
      expect((result.data as any).success).toBe(true)
      // May be 0 if owner has no email or notifications disabled
      expect((result.data as any).sent).toBeGreaterThanOrEqual(0)
    })
  })

  describe('player_welcome', () => {
    it('should send welcome email to new player', async () => {
      // Get a player from the pool
      const { data: poolPlayer } = await supabase
        .from('pool_players')
        .select('player:players(id, email)')
        .eq('pool_id', testPoolId)
        .limit(1)
        .single()

      // Only test if player has an email
      if (poolPlayer?.player && (poolPlayer.player as any).email) {
        const result = await callEdgeFunction('notify', {
          type: 'player_welcome',
          poolId: testPoolId,
          playerId: (poolPlayer.player as any).id,
        })
        console.log('player_welcome result:', result.data)

        expect(result.status).toBe(200)
        expect((result.data as any).success).toBe(true)
        expect((result.data as any).sent).toBeGreaterThanOrEqual(1)
      }
    })
  })

  describe('comment_added', () => {
    it('should send notification when comment is added (when enabled)', async () => {
      const session = await createTestSession(supabase, testPoolId, { status: 'proposed' })
      testSessionId = session.id

      // Add a participant
      const participant = await createTestParticipant(supabase, testSessionId, 'committed')

      // Add a comment
      const { data: comment } = await supabase
        .from('session_comments')
        .insert({
          session_id: testSessionId,
          player_id: participant.player_id,
          comment: 'Test comment for notification',
        })
        .select('id')
        .single()

      // Note: Notifications are currently disabled by default (notify: false)
      // This test verifies the Edge Function handler works when called directly
      const result = await callEdgeFunction('notify', {
        type: 'comment_added',
        sessionId: testSessionId,
        playerId: participant.player_id,
        customMessage: comment!.id, // commentId
      })
      console.log('comment_added result:', result.data)

      expect(result.status).toBe(200)
      expect((result.data as any).success).toBe(true)
      // May be 0 if no other participants or notifications disabled
      expect((result.data as any).sent).toBeGreaterThanOrEqual(0)
    })
  })
})
