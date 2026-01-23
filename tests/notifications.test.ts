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
})
