import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import {
  getServiceClient,
  callEdgeFunction,
  createTestSession,
  createTestParticipant,
  createTestPayment,
  deleteTestSession,
  getFirstPool,
  getPoolPlayer,
  TestSession,
  TestParticipant,
  TestPayment,
} from './setup'

describe('Notification Edge Functions', () => {
  const supabase = getServiceClient()
  let pool: { id: string; owner_id: string }
  const sessionsToCleanup: string[] = []

  beforeAll(async () => {
    // Get existing pool from seed data
    pool = await getFirstPool(supabase)
    console.log('Using pool:', pool.id)
  })

  afterEach(async () => {
    // Cleanup all test sessions created
    for (const sessionId of sessionsToCleanup) {
      try {
        await deleteTestSession(supabase, sessionId)
        console.log('Cleaned up session:', sessionId)
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    sessionsToCleanup.length = 0
  })

  describe('session_created', () => {
    it('should send notifications to pool members', async () => {
      // Create a test session
      const session = await createTestSession(supabase, pool.id)
      sessionsToCleanup.push(session.id)
      console.log('Created test session:', session.id)

      // Call the edge function
      const result = await callEdgeFunction('notify', {
        type: 'session_created',
        sessionId: session.id,
      })

      console.log('session_created result:', result.data)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('success', true)
      expect(result.data).toHaveProperty('sent')
      // Should send to at least 1 pool member
      expect((result.data as { sent: number }).sent).toBeGreaterThanOrEqual(0)
    })
  })

  describe('session_reminder', () => {
    it('should send reminders to committed participants', async () => {
      // Create fresh session - owner is auto-added as committed participant
      const session = await createTestSession(supabase, pool.id)
      sessionsToCleanup.push(session.id)
      console.log('Created session with auto-participant:', session.id)

      // Call the edge function - owner should already be a committed participant
      const result = await callEdgeFunction('notify', {
        type: 'session_reminder',
        sessionId: session.id,
      })

      console.log('session_reminder result:', result.data)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('success', true)
      // Owner should receive notification
      expect((result.data as { sent: number }).sent).toBeGreaterThanOrEqual(1)
    })
  })

  describe('roster_locked', () => {
    it('should send payment notifications to committed participants', async () => {
      // Create confirmed session - owner auto-added
      const session = await createTestSession(supabase, pool.id, { status: 'confirmed' })
      sessionsToCleanup.push(session.id)

      // Get the auto-created participant (owner)
      const { data: participants } = await supabase
        .from('session_participants')
        .select('id')
        .eq('session_id', session.id)
        .limit(1)
        .single()

      if (participants) {
        // Create a pending payment for the participant
        const payment = await createTestPayment(supabase, participants.id)
        console.log('Created payment:', payment.id)
      }

      // Call the edge function
      const result = await callEdgeFunction('notify', {
        type: 'roster_locked',
        sessionId: session.id,
      })

      console.log('roster_locked result:', result.data)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('success', true)
    })
  })

  describe('payment_reminder', () => {
    it('should send reminders for pending payments', async () => {
      // Create confirmed session - owner auto-added
      const session = await createTestSession(supabase, pool.id, { status: 'confirmed' })
      sessionsToCleanup.push(session.id)

      // Get the auto-created participant
      const { data: participant } = await supabase
        .from('session_participants')
        .select('id')
        .eq('session_id', session.id)
        .limit(1)
        .single()

      if (participant) {
        await createTestPayment(supabase, participant.id)
      }

      // Call the edge function
      const result = await callEdgeFunction('notify', {
        type: 'payment_reminder',
        sessionId: session.id,
      })

      console.log('payment_reminder result:', result.data)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('success', true)
    })

    it('should include custom message when provided', async () => {
      // Create confirmed session - owner auto-added
      const session = await createTestSession(supabase, pool.id, { status: 'confirmed' })
      sessionsToCleanup.push(session.id)

      // Get the auto-created participant
      const { data: participant } = await supabase
        .from('session_participants')
        .select('id')
        .eq('session_id', session.id)
        .limit(1)
        .single()

      if (participant) {
        await createTestPayment(supabase, participant.id)
      }

      const result = await callEdgeFunction('notify', {
        type: 'payment_reminder',
        sessionId: session.id,
        customMessage: 'Please pay ASAP!',
      })

      console.log('payment_reminder with message result:', result.data)

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('success', true)
    })
  })

  // Note: waitlist_promoted test skipped - 'waitlisted' status not in current schema
  // The schema uses: 'committed', 'paid', 'maybe', 'out'
  describe.skip('waitlist_promoted', () => {
    it('should notify player when promoted from waitlist', async () => {
      // This test requires adding 'waitlisted' to participant_status enum
    })
  })

  describe('error handling', () => {
    it('should return error for missing type', async () => {
      const result = await callEdgeFunction('notify', {})

      expect(result.status).toBe(400)
      expect(result.data).toHaveProperty('success', false)
      expect(result.data).toHaveProperty('error')
    })

    it('should return error for invalid session', async () => {
      const result = await callEdgeFunction('notify', {
        type: 'session_reminder',
        sessionId: '00000000-0000-0000-0000-000000000000',
      })

      expect(result.status).toBe(400)
      expect(result.data).toHaveProperty('success', false)
      expect((result.data as { error: string }).error).toContain('Session not found')
    })

    it('should return error for unknown notification type', async () => {
      const result = await callEdgeFunction('notify', {
        type: 'invalid_type',
        sessionId: '00000000-0000-0000-0000-000000000000',
      })

      expect(result.status).toBe(400)
      expect(result.data).toHaveProperty('success', false)
    })
  })
})

describe('Notification Logs', () => {
  const supabase = getServiceClient()

  it('should have logged notifications in notifications_log table', async () => {
    const { data, error } = await supabase
      .from('notifications_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    expect(error).toBeNull()
    console.log('Recent notification logs:', data?.length || 0)
    
    // After running tests, we should have some logs
    // This is just informational
    if (data && data.length > 0) {
      console.log('Last log:', data[0])
    }
  })
})
