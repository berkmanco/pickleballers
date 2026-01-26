import { describe, it, expect, beforeAll } from 'vitest'
import { getServiceClient, getFirstPool, SKIP_DB_TESTS } from './setup'
import { getSessionComments, addSessionComment, deleteSessionComment } from '../src/lib/comments'

describe.skipIf(SKIP_DB_TESTS)('Session Comments', () => {
  const supabase = getServiceClient()
  let testPoolId: string
  let testSessionId: string
  let testUserId: string
  let testPlayerId: string

  beforeAll(async () => {
    // Get a test pool
    const pool = await getFirstPool(supabase)
    testPoolId = pool.id
    testUserId = pool.owner_id

    // Get the player for this user
    const { data: player } = await supabase
      .from('players')
      .select('id')
      .eq('user_id', testUserId)
      .single()
    
    testPlayerId = player!.id

    // Get or create a test session
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('pool_id', testPoolId)
      .limit(1)

    if (sessions && sessions.length > 0) {
      testSessionId = sessions[0].id
    } else {
      // Create a test session
      const { data: newSession } = await supabase
        .from('sessions')
        .insert({
          pool_id: testPoolId,
          proposed_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          proposed_time: '18:00:00',
          duration_minutes: 120,
          courts_needed: 2,
        })
        .select('id')
        .single()
      
      testSessionId = newSession!.id
    }

    // Clean up any existing comments for this session
    await supabase
      .from('session_comments')
      .delete()
      .eq('session_id', testSessionId)
  })

  it('should fetch comments for a session (empty initially)', async () => {
    const comments = await getSessionComments(testSessionId)
    expect(Array.isArray(comments)).toBe(true)
    expect(comments.length).toBe(0)
  })

  it('should add a comment to a session', async () => {
    // Mock auth for the test (service client bypasses RLS)
    const { data: comment } = await supabase
      .from('session_comments')
      .insert({
        session_id: testSessionId,
        player_id: testPlayerId,
        comment: 'Test comment from automated test',
      })
      .select(`
        *,
        player:players(id, name, user_id)
      `)
      .single()

    expect(comment).toBeDefined()
    expect(comment!.comment).toBe('Test comment from automated test')
    expect(comment!.session_id).toBe(testSessionId)
    expect(comment!.player_id).toBe(testPlayerId)
  })

  it('should retrieve comments with player info', async () => {
    const comments = await getSessionComments(testSessionId)
    expect(comments.length).toBeGreaterThan(0)
    expect(comments[0].player).toBeDefined()
    expect(comments[0].player?.name).toBeDefined()
    expect(comments[0].comment).toBe('Test comment from automated test')
  })

  it('should add multiple comments in chronological order', async () => {
    // Add another comment
    await supabase
      .from('session_comments')
      .insert({
        session_id: testSessionId,
        player_id: testPlayerId,
        comment: 'Second test comment',
      })

    const comments = await getSessionComments(testSessionId)
    expect(comments.length).toBeGreaterThanOrEqual(2)
    
    // Comments should be in chronological order (oldest first)
    const dates = comments.map(c => new Date(c.created_at).getTime())
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1])
    }
  })

  it('should delete a comment', async () => {
    const comments = await getSessionComments(testSessionId)
    const commentToDelete = comments[0]

    await deleteSessionComment(commentToDelete.id)

    const updatedComments = await getSessionComments(testSessionId)
    expect(updatedComments.length).toBe(comments.length - 1)
    expect(updatedComments.find(c => c.id === commentToDelete.id)).toBeUndefined()
  })

  it('should handle empty comment text gracefully', async () => {
    // The library trims comments, so empty/whitespace should be rejected by the database NOT NULL constraint
    await expect(async () => {
      await supabase
        .from('session_comments')
        .insert({
          session_id: testSessionId,
          player_id: testPlayerId,
          comment: '',
        })
    }).rejects.toThrow()
  })

  it('should update updated_at timestamp on edit', async () => {
    // Add a comment
    const { data: comment } = await supabase
      .from('session_comments')
      .insert({
        session_id: testSessionId,
        player_id: testPlayerId,
        comment: 'Original comment',
      })
      .select()
      .single()

    const originalUpdatedAt = comment!.updated_at

    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 100))

    // Update the comment
    await supabase
      .from('session_comments')
      .update({ comment: 'Updated comment' })
      .eq('id', comment!.id)

    const { data: updated } = await supabase
      .from('session_comments')
      .select()
      .eq('id', comment!.id)
      .single()

    expect(updated!.comment).toBe('Updated comment')
    expect(new Date(updated!.updated_at).getTime()).toBeGreaterThan(new Date(originalUpdatedAt).getTime())
  })
})
