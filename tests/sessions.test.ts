import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getServiceClient } from './setup'

describe('Session Operations', () => {
  const supabase = getServiceClient()
  const sessionsToCleanup: string[] = []
  let testPoolId: string
  let testOwnerId: string

  beforeAll(async () => {
    // Get a pool from seed data
    const { data: pool } = await supabase
      .from('pools')
      .select('id, owner_id')
      .limit(1)
      .single()

    if (!pool) throw new Error('No pools in seed data')
    testPoolId = pool.id
    testOwnerId = pool.owner_id
    console.log('Using pool:', testPoolId)
  })

  afterEach(async () => {
    for (const sessionId of sessionsToCleanup) {
      try {
        // Delete payments first
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
      } catch (e) {
        // Ignore
      }
    }
    sessionsToCleanup.length = 0
  })

  describe('Create Session', () => {
    it('should create a session with required fields', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const dateStr = tomorrow.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('sessions')
        .insert({
          pool_id: testPoolId,
          proposed_date: dateStr,
          proposed_time: '18:00',
          min_players: 4,
          max_players: 8,
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.pool_id).toBe(testPoolId)
      expect(data.proposed_date).toBe(dateStr)
      expect(data.status).toBe('proposed') // Default status

      sessionsToCleanup.push(data.id)
      console.log('Created session:', data.id)
    })

    it('should auto-add pool members as participants on session creation', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { data: session } = await supabase
        .from('sessions')
        .insert({
          pool_id: testPoolId,
          proposed_date: tomorrow.toISOString().split('T')[0],
          proposed_time: '18:00',
        })
        .select()
        .single()

      sessionsToCleanup.push(session.id)

      // Check participants were auto-created
      const { data: participants, error } = await supabase
        .from('session_participants')
        .select('player_id, status')
        .eq('session_id', session.id)

      expect(error).toBeNull()
      expect(participants).toBeDefined()
      expect(participants.length).toBeGreaterThanOrEqual(1)
      console.log('Auto-created participants:', participants.length)
    })

    it('should create session with optional fields', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { data, error } = await supabase
        .from('sessions')
        .insert({
          pool_id: testPoolId,
          proposed_date: tomorrow.toISOString().split('T')[0],
          proposed_time: '19:30',
          duration_minutes: 90,
          court_location: 'Pickle Shack',
          court_numbers: ['1', '2'],
          min_players: 6,
          max_players: 12,
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.duration_minutes).toBe(90)
      expect(data.court_location).toBe('Pickle Shack')
      expect(data.court_numbers).toEqual(['1', '2'])

      sessionsToCleanup.push(data.id)
    })
  })

  describe('Get Session', () => {
    it('should get session by ID', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { data: session } = await supabase
        .from('sessions')
        .insert({
          pool_id: testPoolId,
          proposed_date: tomorrow.toISOString().split('T')[0],
          proposed_time: '18:00',
        })
        .select()
        .single()

      sessionsToCleanup.push(session.id)

      // Get by ID
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', session.id)
        .single()

      expect(error).toBeNull()
      expect(data.id).toBe(session.id)
    })

    it('should get session with pool info', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { data: session } = await supabase
        .from('sessions')
        .insert({
          pool_id: testPoolId,
          proposed_date: tomorrow.toISOString().split('T')[0],
          proposed_time: '18:00',
        })
        .select()
        .single()

      sessionsToCleanup.push(session.id)

      // Get with pool joined
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          pool:pools (id, name, slug)
        `)
        .eq('id', session.id)
        .single()

      expect(error).toBeNull()
      expect(data.pool).toBeDefined()
      expect(data.pool.id).toBe(testPoolId)
    })

    it('should get session with participants', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { data: session } = await supabase
        .from('sessions')
        .insert({
          pool_id: testPoolId,
          proposed_date: tomorrow.toISOString().split('T')[0],
          proposed_time: '18:00',
        })
        .select()
        .single()

      sessionsToCleanup.push(session.id)

      // Get with participants
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          session_participants (
            id,
            status,
            player:players (id, name, email)
          )
        `)
        .eq('id', session.id)
        .single()

      expect(error).toBeNull()
      expect(data.session_participants).toBeDefined()
      expect(data.session_participants.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Update Session', () => {
    it('should update session status', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { data: session } = await supabase
        .from('sessions')
        .insert({
          pool_id: testPoolId,
          proposed_date: tomorrow.toISOString().split('T')[0],
          proposed_time: '18:00',
        })
        .select()
        .single()

      sessionsToCleanup.push(session.id)

      // Update status to confirmed
      const { data, error } = await supabase
        .from('sessions')
        .update({ status: 'confirmed' })
        .eq('id', session.id)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.status).toBe('confirmed')
    })

    it('should update session time', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { data: session } = await supabase
        .from('sessions')
        .insert({
          pool_id: testPoolId,
          proposed_date: tomorrow.toISOString().split('T')[0],
          proposed_time: '18:00',
        })
        .select()
        .single()

      sessionsToCleanup.push(session.id)

      // Update time
      const { data, error } = await supabase
        .from('sessions')
        .update({ proposed_time: '19:30' })
        .eq('id', session.id)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.proposed_time).toBe('19:30:00')
    })

    it('should cancel session', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { data: session } = await supabase
        .from('sessions')
        .insert({
          pool_id: testPoolId,
          proposed_date: tomorrow.toISOString().split('T')[0],
          proposed_time: '18:00',
        })
        .select()
        .single()

      sessionsToCleanup.push(session.id)

      // Cancel
      const { data, error } = await supabase
        .from('sessions')
        .update({ status: 'cancelled' })
        .eq('id', session.id)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.status).toBe('cancelled')
    })
  })

  describe('Session Participants', () => {
    it('should update existing auto-added participant status', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { data: session } = await supabase
        .from('sessions')
        .insert({
          pool_id: testPoolId,
          proposed_date: tomorrow.toISOString().split('T')[0],
          proposed_time: '18:00',
        })
        .select()
        .single()

      sessionsToCleanup.push(session.id)

      // Get an auto-added participant (from trigger)
      const { data: autoParticipant } = await supabase
        .from('session_participants')
        .select('id, player_id, status')
        .eq('session_id', session.id)
        .limit(1)
        .single()

      expect(autoParticipant).toBeDefined()
      
      // Update their status to committed (in case it was maybe/pending)
      const { data, error } = await supabase
        .from('session_participants')
        .update({
          status: 'committed',
          opted_in_at: new Date().toISOString(),
        })
        .eq('id', autoParticipant.id)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.status).toBe('committed')
    })

    it('should update participant status', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { data: session } = await supabase
        .from('sessions')
        .insert({
          pool_id: testPoolId,
          proposed_date: tomorrow.toISOString().split('T')[0],
          proposed_time: '18:00',
        })
        .select()
        .single()

      sessionsToCleanup.push(session.id)

      // Get auto-created participant (owner)
      const { data: participant } = await supabase
        .from('session_participants')
        .select('id')
        .eq('session_id', session.id)
        .limit(1)
        .single()

      // Update to 'out'
      const { data, error } = await supabase
        .from('session_participants')
        .update({ status: 'out' })
        .eq('id', participant.id)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.status).toBe('out')
    })

    it('should remove participant from session', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { data: session } = await supabase
        .from('sessions')
        .insert({
          pool_id: testPoolId,
          proposed_date: tomorrow.toISOString().split('T')[0],
          proposed_time: '18:00',
        })
        .select()
        .single()

      sessionsToCleanup.push(session.id)

      // Get an auto-added participant
      const { data: participant } = await supabase
        .from('session_participants')
        .select('id')
        .eq('session_id', session.id)
        .limit(1)
        .single()

      expect(participant).toBeDefined()

      // Delete participant
      const { error } = await supabase
        .from('session_participants')
        .delete()
        .eq('id', participant.id)

      expect(error).toBeNull()

      // Verify deleted
      const { data: check } = await supabase
        .from('session_participants')
        .select('id')
        .eq('id', participant.id)
        .single()

      expect(check).toBeNull()
    })
  })

  describe('Cost Fields', () => {
    it('should store cost fields on session', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { data: session, error } = await supabase
        .from('sessions')
        .insert({
          pool_id: testPoolId,
          proposed_date: tomorrow.toISOString().split('T')[0],
          proposed_time: '18:00',
          min_players: 4,
          max_players: 8,
          admin_cost_per_court: 25.00,
          guest_pool_per_court: 5.00,
        })
        .select()
        .single()

      expect(error).toBeNull()
      sessionsToCleanup.push(session.id)

      expect(session.admin_cost_per_court).toBe(25.00)
      expect(session.guest_pool_per_court).toBe(5.00)
      console.log('Session costs:', {
        admin_cost: session.admin_cost_per_court,
        guest_cost: session.guest_pool_per_court,
      })
    })
  })

  describe('Session Queries', () => {
    it('should get upcoming sessions for a pool', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)

      // Create two sessions
      const { data: session1 } = await supabase
        .from('sessions')
        .insert({
          pool_id: testPoolId,
          proposed_date: tomorrow.toISOString().split('T')[0],
          proposed_time: '18:00',
        })
        .select()
        .single()

      const { data: session2 } = await supabase
        .from('sessions')
        .insert({
          pool_id: testPoolId,
          proposed_date: nextWeek.toISOString().split('T')[0],
          proposed_time: '18:00',
        })
        .select()
        .single()

      sessionsToCleanup.push(session1.id, session2.id)

      // Query upcoming sessions
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('sessions')
        .select('id, proposed_date, status')
        .eq('pool_id', testPoolId)
        .gte('proposed_date', today)
        .in('status', ['proposed', 'confirmed'])
        .order('proposed_date', { ascending: true })

      expect(error).toBeNull()
      expect(data?.length).toBeGreaterThanOrEqual(2)
    })

    it('should get sessions by status', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { data: session } = await supabase
        .from('sessions')
        .insert({
          pool_id: testPoolId,
          proposed_date: tomorrow.toISOString().split('T')[0],
          proposed_time: '18:00',
          status: 'confirmed',
        })
        .select()
        .single()

      sessionsToCleanup.push(session.id)

      // Query confirmed sessions
      const { data, error } = await supabase
        .from('sessions')
        .select('id, status')
        .eq('pool_id', testPoolId)
        .eq('status', 'confirmed')

      expect(error).toBeNull()
      expect(data?.some(s => s.id === session.id)).toBe(true)
    })
  })
})
