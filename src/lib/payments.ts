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
 * Generate a Venmo payment REQUEST link (admin requesting money FROM guest)
 * Format: https://venmo.com/GUEST_USERNAME?txn=charge&amount=AMOUNT&note=NOTE
 * 
 * txn=charge means "request money from this person"
 * 
 * Includes a hashtag with the payment ID for automatic reconciliation:
 * #dinkup-{payment_id}
 */
export function generateVenmoLink(
  guestVenmoAccount: string,
  amount: number,
  sessionDate: string,
  sessionTime: string,
  poolName: string,
  paymentId?: string
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
  
  // Note format: "Pickleball - Weekend Warriors - Sat Jan 11 @ 1:00 PM #dinkup-xxx"
  // The hashtag enables automatic payment matching from Venmo emails
  let noteText = `Pickleball - ${poolName} - ${formattedDate} @ ${formattedTime}`
  if (paymentId) {
    noteText += ` #dinkup-${paymentId}`
  }
  const note = encodeURIComponent(noteText)
  const cleanUsername = guestVenmoAccount.replace('@', '')
  
  // txn=charge requests money FROM this user (vs txn=pay which pays them)
  return `https://venmo.com/${cleanUsername}?txn=charge&amount=${amount.toFixed(2)}&note=${note}`
}

/**
 * Generate a Venmo PAY link (guest paying the admin)
 * Used by players on their dashboard to pay what they owe.
 * Uses the same hashtag as the request link for reconciliation.
 */
export function generateVenmoPayLink(
  adminVenmoAccount: string,
  amount: number,
  note: string
): string {
  const cleanUsername = adminVenmoAccount.replace('@', '')
  const encodedNote = encodeURIComponent(note)
  
  // txn=pay means "pay this person"
  return `https://venmo.com/${cleanUsername}?txn=pay&amount=${amount.toFixed(2)}&note=${encodedNote}`
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
 * Generates Venmo REQUEST links (admin requesting money FROM each guest).
 */
export async function createPaymentsForSession(
  sessionId: string,
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
  // Generate UUIDs client-side so we can include them in Venmo links for auto-matching
  const payments = participants.map((participant: { id: string; players: { venmo_account: string | null } }) => {
    const paymentId = crypto.randomUUID()
    const guestVenmo = participant.players?.venmo_account
    
    return {
      id: paymentId,
      session_participant_id: participant.id,
      amount: costSummary.guest_cost,
      payment_method: 'venmo' as const,
      // Generate request link if guest has Venmo, otherwise null
      venmo_payment_link: guestVenmo ? generateVenmoLink(
        guestVenmo,
        costSummary.guest_cost,
        sessionDate,
        sessionTime,
        poolName,
        paymentId // Include payment ID for auto-matching
      ) : null,
      status: 'pending' as PaymentStatus,
    }
  })

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
      owner_id: string
    }
  }
  // Admin's Venmo for generating pay links (fetched separately)
  adminVenmoAccount?: string
}

/**
 * Get all pending payments for a player, including admin's Venmo for pay links
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
            slug,
            owner_id
          )
        )
      )
    `)
    .eq('session_participants.player_id', playerId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) throw error

  // Transform the nested structure
  const payments = (data || []).map((row: any) => ({
    ...row,
    session: row.session_participants?.sessions,
    session_participants: undefined,
  })).filter((p: any) => p.session?.pools) as UserPendingPayment[]

  // Get unique owner IDs and fetch their Venmo accounts
  const ownerIds = [...new Set(payments.map(p => p.session.pools.owner_id))]
  
  if (ownerIds.length > 0) {
    const { data: ownerPlayers } = await supabase
      .from('players')
      .select('user_id, venmo_account')
      .in('user_id', ownerIds)

    // Create a map of owner_id -> venmo_account
    const venmoMap = new Map<string, string>()
    ownerPlayers?.forEach((p: { user_id: string; venmo_account: string }) => {
      if (p.venmo_account) venmoMap.set(p.user_id, p.venmo_account)
    })

    // Attach admin's Venmo to each payment
    payments.forEach(p => {
      p.adminVenmoAccount = venmoMap.get(p.session.pools.owner_id)
    })
  }

  return payments
}

