import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getServiceClient, getFirstPool } from './setup'

describe('Payment Operations', () => {
  const supabase = getServiceClient()
  let testPoolId: string
  const sessionsToCleanup: string[] = []
  const paymentsToCleanup: string[] = []

  beforeAll(async () => {
    const pool = await getFirstPool(supabase)
    testPoolId = pool.id
    console.log('Using pool:', testPoolId)
  })

  afterEach(async () => {
    // Cleanup payments first
    for (const paymentId of paymentsToCleanup) {
      await supabase.from('payments').delete().eq('id', paymentId)
    }
    paymentsToCleanup.length = 0

    // Then cleanup sessions
    for (const sessionId of sessionsToCleanup) {
      const { data: participants } = await supabase
        .from('session_participants')
        .select('id')
        .eq('session_id', sessionId)

      const participantIds = participants?.map(p => p.id) || []
      if (participantIds.length > 0) {
        await supabase.from('payments').delete().in('session_participant_id', participantIds)
      }

      await supabase.from('session_participants').delete().eq('session_id', sessionId)
      await supabase.from('sessions').delete().eq('id', sessionId)
      console.log('Cleaned up session:', sessionId)
    }
    sessionsToCleanup.length = 0
  })

  describe('Venmo Link Generation', () => {
    it('should generate a valid Venmo request link (txn=charge)', () => {
      const link = generateVenmoLink(
        'test-user',
        16.00,
        '2026-01-20',
        '18:00:00',
        'Weekend Warriors',
        'abc123-payment-id'
      )

      expect(link).toContain('https://venmo.com/test-user')
      expect(link).toContain('txn=charge') // Request money
      expect(link).toContain('amount=16.00')
      expect(link).toContain('note=')
      expect(link).toContain('Pickleball')
      expect(link).toContain('Weekend%20Warriors')
      expect(link).toContain('%23dinkup-abc123-payment-id') // Hashtag for auto-match
      
      console.log('Generated request link:', link)
    })

    it('should generate a Venmo pay link (txn=pay)', () => {
      const link = generateVenmoPayLink(
        'admin-user',
        16.00,
        'Pickleball - Weekend Warriors - Mon, Jan 20 @ 6:00 PM #dinkup-abc123'
      )

      expect(link).toContain('https://venmo.com/admin-user')
      expect(link).toContain('txn=pay') // Pay this person
      expect(link).toContain('amount=16.00')
      expect(link).toContain('note=')
      expect(link).toContain('%23dinkup-abc123')
      
      console.log('Generated pay link:', link)
    })

    it('should strip @ from Venmo username', () => {
      const link = generateVenmoLink(
        '@test-user', // With @ prefix
        10.00,
        '2026-01-20',
        '18:00:00',
        'Test Pool'
      )

      expect(link).toContain('https://venmo.com/test-user')
      expect(link).not.toContain('@@')
    })

    it('should format date correctly in note', () => {
      const link = generateVenmoLink(
        'test',
        10.00,
        '2026-01-20', // Tuesday
        '13:30:00',
        'Test Pool'
      )

      // Should contain formatted date like "Tue, Jan 20"
      expect(link).toContain('Tue')
      expect(link).toContain('Jan')
      expect(link).toContain('20')
    })

    it('should handle link without payment ID', () => {
      const link = generateVenmoLink(
        'test-user',
        15.00,
        '2026-01-20',
        '18:00:00',
        'Test Pool'
        // No payment ID
      )

      expect(link).toContain('https://venmo.com/test-user')
      expect(link).not.toContain('#dinkup-') // No hashtag without payment ID
    })
  })

  describe('Payment CRUD', () => {
    it('should create a payment record', async () => {
      // Create session first
      const { data: session } = await supabase
        .from('sessions')
        .insert({
          pool_id: testPoolId,
          proposed_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          proposed_time: '18:00',
        })
        .select()
        .single()

      sessionsToCleanup.push(session.id)

      // Get auto-created participant
      const { data: participant } = await supabase
        .from('session_participants')
        .select('id')
        .eq('session_id', session.id)
        .limit(1)
        .single()

      // Create payment
      const paymentId = crypto.randomUUID()
      const { data: payment, error } = await supabase
        .from('payments')
        .insert({
          id: paymentId,
          session_participant_id: participant.id,
          amount: 16.00,
          payment_method: 'venmo',
          status: 'pending',
          venmo_payment_link: `https://venmo.com/test?amount=16.00&note=Test%20%23dinkup-${paymentId}`,
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(payment).toBeDefined()
      expect(payment.amount).toBe(16.00)
      expect(payment.status).toBe('pending')
      expect(payment.venmo_payment_link).toContain('venmo.com')

      paymentsToCleanup.push(payment.id)
      console.log('Created payment:', payment.id)
    })

    it('should get payment by ID', async () => {
      // Create session and payment
      const { data: session } = await supabase
        .from('sessions')
        .insert({
          pool_id: testPoolId,
          proposed_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          proposed_time: '18:00',
        })
        .select()
        .single()

      sessionsToCleanup.push(session.id)

      const { data: participant } = await supabase
        .from('session_participants')
        .select('id')
        .eq('session_id', session.id)
        .limit(1)
        .single()

      const { data: created } = await supabase
        .from('payments')
        .insert({
          session_participant_id: participant.id,
          amount: 20.00,
          payment_method: 'venmo',
          status: 'pending',
        })
        .select()
        .single()

      paymentsToCleanup.push(created.id)

      // Get by ID
      const { data: payment, error } = await supabase
        .from('payments')
        .select('*')
        .eq('id', created.id)
        .single()

      expect(error).toBeNull()
      expect(payment.id).toBe(created.id)
      expect(payment.amount).toBe(20.00)
    })

    it('should get payments for a session', async () => {
      // Create session
      const { data: session } = await supabase
        .from('sessions')
        .insert({
          pool_id: testPoolId,
          proposed_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          proposed_time: '18:00',
        })
        .select()
        .single()

      sessionsToCleanup.push(session.id)

      // Get participants
      const { data: participants } = await supabase
        .from('session_participants')
        .select('id')
        .eq('session_id', session.id)

      // Create multiple payments
      for (const participant of participants || []) {
        const { data: payment } = await supabase
          .from('payments')
          .insert({
            session_participant_id: participant.id,
            amount: 15.00,
            payment_method: 'venmo',
            status: 'pending',
          })
          .select()
          .single()

        paymentsToCleanup.push(payment.id)
      }

      // Get all payments for session
      const { data: payments, error } = await supabase
        .from('payments')
        .select(`
          *,
          session_participants!inner (session_id)
        `)
        .eq('session_participants.session_id', session.id)

      expect(error).toBeNull()
      expect(payments.length).toBeGreaterThanOrEqual(1)
      console.log('Found', payments.length, 'payments for session')
    })

    it('should delete a payment', async () => {
      // Create session and payment
      const { data: session } = await supabase
        .from('sessions')
        .insert({
          pool_id: testPoolId,
          proposed_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          proposed_time: '18:00',
        })
        .select()
        .single()

      sessionsToCleanup.push(session.id)

      const { data: participant } = await supabase
        .from('session_participants')
        .select('id')
        .eq('session_id', session.id)
        .limit(1)
        .single()

      const { data: payment } = await supabase
        .from('payments')
        .insert({
          session_participant_id: participant.id,
          amount: 10.00,
          payment_method: 'venmo',
          status: 'pending',
        })
        .select()
        .single()

      // Delete payment
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', payment.id)

      expect(error).toBeNull()

      // Verify deleted
      const { data: check } = await supabase
        .from('payments')
        .select('id')
        .eq('id', payment.id)
        .single()

      expect(check).toBeNull()
    })
  })

  describe('Payment Status Updates', () => {
    async function createTestPayment(): Promise<{ sessionId: string; paymentId: string }> {
      const { data: session } = await supabase
        .from('sessions')
        .insert({
          pool_id: testPoolId,
          proposed_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          proposed_time: '18:00',
        })
        .select()
        .single()

      sessionsToCleanup.push(session.id)

      const { data: participant } = await supabase
        .from('session_participants')
        .select('id')
        .eq('session_id', session.id)
        .limit(1)
        .single()

      const { data: payment } = await supabase
        .from('payments')
        .insert({
          session_participant_id: participant.id,
          amount: 16.00,
          payment_method: 'venmo',
          status: 'pending',
        })
        .select()
        .single()

      paymentsToCleanup.push(payment.id)

      return { sessionId: session.id, paymentId: payment.id }
    }

    it('should update payment status to paid', async () => {
      const { paymentId } = await createTestPayment()

      const { data, error } = await supabase
        .from('payments')
        .update({
          status: 'paid',
          payment_date: new Date().toISOString(),
        })
        .eq('id', paymentId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.status).toBe('paid')
      expect(data.payment_date).not.toBeNull()
    })

    it('should update payment status to refunded', async () => {
      const { paymentId } = await createTestPayment()

      // First mark as paid
      await supabase
        .from('payments')
        .update({ status: 'paid', payment_date: new Date().toISOString() })
        .eq('id', paymentId)

      // Then refund
      const { data, error } = await supabase
        .from('payments')
        .update({
          status: 'refunded',
          refunded_at: new Date().toISOString(),
        })
        .eq('id', paymentId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.status).toBe('refunded')
      expect(data.refunded_at).not.toBeNull()
    })

    it('should update payment status to forgiven', async () => {
      const { paymentId } = await createTestPayment()

      const { data, error } = await supabase
        .from('payments')
        .update({
          status: 'forgiven',
          notes: 'First timer discount',
        })
        .eq('id', paymentId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.status).toBe('forgiven')
      expect(data.notes).toBe('First timer discount')
    })

    it('should mark request as sent', async () => {
      const { paymentId } = await createTestPayment()

      const sentAt = new Date().toISOString()
      const { data, error } = await supabase
        .from('payments')
        .update({ venmo_request_sent_at: sentAt })
        .eq('id', paymentId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.venmo_request_sent_at).not.toBeNull()
    })

    it('should add notes to payment', async () => {
      const { paymentId } = await createTestPayment()

      const { data, error } = await supabase
        .from('payments')
        .update({ notes: 'Paid via cash at session' })
        .eq('id', paymentId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.notes).toBe('Paid via cash at session')
    })
  })

  describe('Payment Summary', () => {
    it('should calculate payment summary for session', async () => {
      // Create session
      const { data: session } = await supabase
        .from('sessions')
        .insert({
          pool_id: testPoolId,
          proposed_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          proposed_time: '18:00',
        })
        .select()
        .single()

      sessionsToCleanup.push(session.id)

      // Get participants
      const { data: participants } = await supabase
        .from('session_participants')
        .select('id')
        .eq('session_id', session.id)

      // Create payments with different statuses
      const statuses = ['pending', 'paid', 'forgiven']
      for (let i = 0; i < Math.min(participants?.length || 0, 3); i++) {
        const { data: payment } = await supabase
          .from('payments')
          .insert({
            session_participant_id: participants![i].id,
            amount: 16.00,
            payment_method: 'venmo',
            status: statuses[i] || 'pending',
            payment_date: statuses[i] === 'paid' ? new Date().toISOString() : null,
          })
          .select()
          .single()

        paymentsToCleanup.push(payment.id)
      }

      // Get all payments and calculate summary
      const { data: payments } = await supabase
        .from('payments')
        .select(`
          *,
          session_participants!inner (session_id)
        `)
        .eq('session_participants.session_id', session.id)

      const summary = {
        total_owed: 0,
        total_paid: 0,
        total_pending: 0,
        total_forgiven: 0,
        paid_count: 0,
        pending_count: 0,
      }

      for (const payment of payments || []) {
        summary.total_owed += payment.amount
        if (payment.status === 'paid') {
          summary.total_paid += payment.amount
          summary.paid_count++
        } else if (payment.status === 'pending') {
          summary.total_pending += payment.amount
          summary.pending_count++
        } else if (payment.status === 'forgiven') {
          summary.total_forgiven += payment.amount
        }
      }

      expect(summary.total_owed).toBeGreaterThan(0)
      console.log('Payment summary:', summary)
    })
  })

  describe('Pending Payments', () => {
    it('should get pending payments for a player', async () => {
      // Create session
      const { data: session } = await supabase
        .from('sessions')
        .insert({
          pool_id: testPoolId,
          proposed_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          proposed_time: '18:00',
        })
        .select()
        .single()

      sessionsToCleanup.push(session.id)

      // Get a participant
      const { data: participant } = await supabase
        .from('session_participants')
        .select('id, player_id')
        .eq('session_id', session.id)
        .limit(1)
        .single()

      // Create pending payment
      const { data: payment } = await supabase
        .from('payments')
        .insert({
          session_participant_id: participant.id,
          amount: 16.00,
          payment_method: 'venmo',
          status: 'pending',
        })
        .select()
        .single()

      paymentsToCleanup.push(payment.id)

      // Get pending payments for this player
      const { data: pendingPayments, error } = await supabase
        .from('payments')
        .select(`
          *,
          session_participants!inner (
            player_id,
            session_id
          )
        `)
        .eq('session_participants.player_id', participant.player_id)
        .eq('status', 'pending')

      expect(error).toBeNull()
      expect(pendingPayments.length).toBeGreaterThanOrEqual(1)
      console.log('Pending payments for player:', pendingPayments.length)
    })
  })
})

// Helper functions (mimicking src/lib/payments.ts)
function generateVenmoLink(
  guestVenmoAccount: string,
  amount: number,
  sessionDate: string,
  sessionTime: string,
  poolName: string,
  paymentId?: string
): string {
  const date = new Date(sessionDate + 'T00:00:00')
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  const formattedTime = new Date(`2000-01-01T${sessionTime}`).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  let noteText = `Pickleball - ${poolName} - ${formattedDate} @ ${formattedTime}`
  if (paymentId) {
    noteText += ` #dinkup-${paymentId}`
  }
  const note = encodeURIComponent(noteText)
  const cleanUsername = guestVenmoAccount.replace('@', '')

  return `https://venmo.com/${cleanUsername}?txn=charge&amount=${amount.toFixed(2)}&note=${note}`
}

function generateVenmoPayLink(
  adminVenmoAccount: string,
  amount: number,
  note: string
): string {
  const cleanUsername = adminVenmoAccount.replace('@', '')
  const encodedNote = encodeURIComponent(note)

  return `https://venmo.com/${cleanUsername}?txn=pay&amount=${amount.toFixed(2)}&note=${encodedNote}`
}
