import { supabase } from './supabase'

export interface Comment {
  id: string
  session_id: string
  player_id: string
  comment: string
  created_at: string
  updated_at: string
  player?: {
    id: string
    name: string
    user_id: string | null
  }
}

/**
 * Get all comments for a session
 */
export async function getSessionComments(sessionId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('session_comments')
    .select(`
      *,
      player:players(id, name, user_id)
    `)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data as Comment[]
}

/**
 * Add a comment to a session
 */
export async function addSessionComment(sessionId: string, comment: string): Promise<Comment> {
  // First, get the current user's player ID
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (playerError || !player) throw new Error('Player not found')

  const { data, error } = await supabase
    .from('session_comments')
    .insert({
      session_id: sessionId,
      player_id: player.id,
      comment: comment.trim(),
    })
    .select(`
      *,
      player:players(id, name, user_id)
    `)
    .single()

  if (error) throw error
  return data as Comment
}

/**
 * Update a comment (user can only update their own)
 */
export async function updateSessionComment(commentId: string, newComment: string): Promise<void> {
  const { error } = await supabase
    .from('session_comments')
    .update({
      comment: newComment.trim(),
    })
    .eq('id', commentId)

  if (error) throw error
}

/**
 * Delete a comment (user can only delete their own)
 */
export async function deleteSessionComment(commentId: string): Promise<void> {
  const { error } = await supabase
    .from('session_comments')
    .delete()
    .eq('id', commentId)

  if (error) throw error
}
