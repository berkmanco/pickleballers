import { supabase } from './supabase'
import { getSessionCostSummary } from './sessions'

export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'forgiven'

export interface Payment {
  id: string
  session_participant_id: string
  amount: number
  payment_method: 'venmo' | 'stripe'
  venmo_transaction_id: string | null
  venmo_payment_link: string | null
  venmo_request_sent_at: string | null
  payment_date: string | null
  refunded_at: string | null
  status: PaymentStatus
  replacement_found: boolean
  notes: string | null
  created_at: string
}

export interface PaymentWithParticipant extends Payment {
  session_participants: {
    id: string
    player_id: string
    is_admin: boolean
    status: string
    players: {
      id: string
      name: string
      venmo_account: string
      email: string | null
    }
  }
}

/**
 * Generate a Venmo payment link
 * Format: venmo://paycharge?txn=pay&recipients=USERNAME&amount=AMOUNT&note=NOTE
 * Web fallback: https://venmo.com/USERNAME?txn=pay&amount=AMOUNT&note=NOTE
 */
export function generateVenmoLink(
  adminVenmoAccount: string,
  amount: number,
  sessionDate: string,
  sessionTime: string,
  poolName: string
): string {
  // Format date nicely: "Sat Jan 11"
  const date = new Date(sessionDate + 'T00:00:00')
  const formattedDate = date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  })
  
  // Format time: "1:00 PM"
  const formattedTime = new Date(`2000-01-01T${sessionTime}`).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })
  
  // Note format: "Pickleball - Weekend Warriors - Sat Jan 11 @ 1:00 PM"
  const note = encodeURIComponent(`Pickleball - ${poolName} - ${formattedDate} @ ${formattedTime}`)
  const cleanUsername = adminVenmoAccount.replace('@', '')
  
  // Use web link for better cross-platform support
  return `https://venmo.com/${cleanUsername}?txn=pay&amount=${amount.toFixed(2)}&note=${note}`
}

/**
 * Get all payments for a session
 */
export async function getSessionPayments(sessionId: string): Promise<PaymentWithParticipant[]> {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      session_participants!inner (
        id,
        player_id,
        is_admin,
        status,
        session_id,
        players (
          id,
          name,
          venmo_account,
          email
        )
      )
    `)
    .eq('session_participants.session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data || []) as PaymentWithParticipant[]
}

/**
 * Get a single payment by ID
 */
export async function getPayment(paymentId: string): Promise<Payment | null> {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw error
  }

  return data as Payment | null
}

/**
 * Create payment records for all committed guests when roster locks.
 * This should only be called by the admin when locking the roster.
 */
export async function createPaymentsForSession(
  sessionId: string,
  adminVenmoAccount: string,
  sessionDate: string,
  sessionTime: string,
  poolName: string
): Promise<Payment[]> {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  // Get cost summary to determine per-guest amount
  const costSummary = await getSessionCostSummary(sessionId)
  
  if (costSummary.guest_count === 0) {
    return [] // No guests, no payments needed
  }

  // Get all committed guests (non-admin players)
  const { data: participants, error: participantsError } = await supabase
    .from('session_participants')
    .select(`
      id,
      player_id,
      is_admin,
      status,
      players (
        id,
        name,
        venmo_account
      )
    `)
    .eq('session_id', sessionId)
    .in('status', ['committed', 'paid'])
    .eq('is_admin', false)

  if (participantsError) throw participantsError

  if (!participants || participants.length === 0) {
    return []
  }

  // Create payment records for each guest
  const payments = participants.map((participant: { id: string }) => ({
    session_participant_id: participant.id,
    amount: costSummary.guest_cost,
    payment_method: 'venmo' as const,
    venmo_payment_link: generateVenmoLink(
      adminVenmoAccount,
      costSummary.guest_cost,
      sessionDate,
      sessionTime,
      poolName
    ),
    status: 'pending' as PaymentStatus,
  }))

  const { data, error } = await supabase
    .from('payments')
    .insert(payments)
    .select()

  if (error) throw error
  return data as Payment[]
}

/**
 * Update payment status (admin only)
 */
export async function updatePaymentStatus(
  paymentId: string,
  status: PaymentStatus,
  notes?: string
): Promise<Payment> {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  const updateData: Record<string, unknown> = { status }
  
  if (status === 'paid') {
    updateData.payment_date = new Date().toISOString()
  } else if (status === 'refunded') {
    updateData.refunded_at = new Date().toISOString()
  }
  
  if (notes !== undefined) {
    updateData.notes = notes
  }

  const { data, error } = await supabase
    .from('payments')
    .update(updateData)
    .eq('id', paymentId)
    .select()
    .single()

  if (error) throw error
  return data as Payment
}

/**
 * Mark payment as paid
 */
export async function markPaymentPaid(paymentId: string, notes?: string): Promise<Payment> {
  return updatePaymentStatus(paymentId, 'paid', notes)
}

/**
 * Forgive a payment (e.g., first-timer discount, replacement found)
 */
export async function forgivePayment(paymentId: string, notes?: string): Promise<Payment> {
  return updatePaymentStatus(paymentId, 'forgiven', notes)
}

/**
 * Mark that a payment request was sent (e.g., Venmo request opened)
 */
export async function markRequestSent(paymentId: string): Promise<Payment> {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  const { data, error } = await supabase
    .from('payments')
    .update({ venmo_request_sent_at: new Date().toISOString() })
    .eq('id', paymentId)
    .select()
    .single()

  if (error) throw error
  return data as Payment
}

/**
 * Get payment summary for a session
 */
export interface PaymentSummary {
  total_owed: number
  total_paid: number
  total_pending: number
  total_forgiven: number
  payments_count: number
  paid_count: number
  pending_count: number
}

export async function getPaymentSummary(sessionId: string): Promise<PaymentSummary> {
  const payments = await getSessionPayments(sessionId)
  
  const summary: PaymentSummary = {
    total_owed: 0,
    total_paid: 0,
    total_pending: 0,
    total_forgiven: 0,
    payments_count: payments.length,
    paid_count: 0,
    pending_count: 0,
  }
  
  for (const payment of payments) {
    summary.total_owed += payment.amount
    
    switch (payment.status) {
      case 'paid':
        summary.total_paid += payment.amount
        summary.paid_count++
        break
      case 'pending':
        summary.total_pending += payment.amount
        summary.pending_count++
        break
      case 'forgiven':
        summary.total_forgiven += payment.amount
        break
    }
  }
  
  return summary
}

/**
 * Payment with session info for user's pending payments view
 */
export interface UserPendingPayment extends Payment {
  session: {
    id: string
    proposed_date: string
    proposed_time: string
    pools: {
      id: string
      name: string
      slug: string
    }
  }
}

/**
 * Get all pending payments for a player
 */
export async function getUserPendingPayments(playerId: string): Promise<UserPendingPayment[]> {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      session_participants!inner (
        player_id,
        sessions!inner (
          id,
          proposed_date,
          proposed_time,
          pools (
            id,
            name,
            slug
          )
        )
      )
    `)
    .eq('session_participants.player_id', playerId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) throw error

  // Transform the nested structure
  // Note: session_participants is a single object (not array) due to !inner join on FK
  return (data || []).map((row: any) => ({
    ...row,
    session: row.session_participants?.sessions,
    session_participants: undefined,
  })).filter((p: any) => p.session?.pools) as UserPendingPayment[]
}

