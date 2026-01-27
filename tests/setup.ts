import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Local Supabase configuration
export const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
export const LOCAL_ANON_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
export const LOCAL_SERVICE_KEY = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz'

// Check if we're in CI or if local Supabase is not available
export const IS_CI = process.env.CI === 'true'
export const SKIP_DB_TESTS = IS_CI // Skip DB tests in CI (no local Supabase)

// Create clients
export function getAnonClient(): SupabaseClient {
  return createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY)
}

export function getServiceClient(): SupabaseClient {
  return createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY)
}

// Edge function caller
export async function callEdgeFunction(
  functionName: string,
  payload: Record<string, unknown>
): Promise<{ data: unknown; error: unknown; status: number }> {
  const response = await fetch(
    `${LOCAL_SUPABASE_URL}/functions/v1/${functionName}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOCAL_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    }
  )

  const data = await response.json().catch(() => null)
  return {
    data,
    error: response.ok ? null : data,
    status: response.status,
  }
}

// Test data helpers
export interface TestSession {
  id: string
  pool_id: string
  proposed_date: string
  proposed_time: string
  status: string
}

export interface TestPlayer {
  id: string
  name: string
  email: string
  phone: string | null
}

export interface TestParticipant {
  id: string
  session_id: string
  player_id: string
  status: string
}

export interface TestPayment {
  id: string
  session_participant_id: string
  amount: number
  status: string
}

// Create test data
export async function createTestSession(
  supabase: SupabaseClient,
  poolId: string,
  overrides: Partial<TestSession> = {}
): Promise<TestSession> {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dateStr = tomorrow.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      pool_id: poolId,
      proposed_date: dateStr,
      proposed_time: '18:00',
      duration_minutes: 60, // 60 min = $9 admin + $48 guest pool
      status: 'proposed',
      min_players: 4,
      max_players: 8,
      admin_cost_per_court: 9.00,
      guest_pool_per_court: 48.00,
      ...overrides,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create test session: ${error.message}`)
  return data as TestSession
}

export async function createTestParticipant(
  supabase: SupabaseClient,
  sessionId: string,
  playerId: string,
  status: string = 'committed'
): Promise<TestParticipant> {
  const { data, error } = await supabase
    .from('session_participants')
    .insert({
      session_id: sessionId,
      player_id: playerId,
      status,
      opted_in_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create participant: ${error.message}`)
  return data as TestParticipant
}

export async function createTestPayment(
  supabase: SupabaseClient,
  participantId: string,
  amount: number = 16,
  status: string = 'pending'
): Promise<TestPayment> {
  const paymentId = crypto.randomUUID()
  const { data, error } = await supabase
    .from('payments')
    .insert({
      id: paymentId,
      session_participant_id: participantId,
      amount,
      payment_method: 'venmo',
      status,
      venmo_payment_link: `https://venmo.com/test?amount=${amount}&note=Test%20%23dinkup-${paymentId}`,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create payment: ${error.message}`)
  return data as TestPayment
}

// Cleanup helpers
export async function deleteTestSession(supabase: SupabaseClient, sessionId: string): Promise<void> {
  // Get participant IDs first
  const { data: participants } = await supabase
    .from('session_participants')
    .select('id')
    .eq('session_id', sessionId)
  
  const participantIds = participants?.map(p => p.id) || []
  
  // Delete in order: payments -> participants -> session
  if (participantIds.length > 0) {
    await supabase
      .from('payments')
      .delete()
      .in('session_participant_id', participantIds)
  }
  
  await supabase
    .from('session_participants')
    .delete()
    .eq('session_id', sessionId)
  
  await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId)
}

// Get first pool (from seed data)
export async function getFirstPool(supabase: SupabaseClient): Promise<{ id: string; owner_id: string }> {
  const { data, error } = await supabase
    .from('pools')
    .select('id, owner_id')
    .limit(1)
    .single()

  if (error) throw new Error(`No pools found: ${error.message}`)
  return data
}

// Get a player from pool (not owner)
export async function getPoolPlayer(
  supabase: SupabaseClient,
  poolId: string,
  excludeOwnerId?: string
): Promise<TestPlayer> {
  let query = supabase
    .from('pool_players')
    .select('player:players(id, name, email, phone)')
    .eq('pool_id', poolId)
    .eq('is_active', true)
    .limit(1)

  if (excludeOwnerId) {
    query = query.neq('player_id', excludeOwnerId)
  }

  const { data, error } = await query.single()

  if (error) throw new Error(`No pool player found: ${error.message}`)
  return (data as { player: TestPlayer }).player
}
