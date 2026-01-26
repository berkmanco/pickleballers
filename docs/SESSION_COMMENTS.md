# Session Comments

## Overview

Session comments allow pool members to discuss and coordinate around specific sessions. Any pool member can add comments to sessions they're part of, creating a discussion thread visible to all participants.

## Features

### Comment Management
- **Add comments**: Any pool member can comment on sessions they're part of
- **Delete comments**: Users can delete their own comments
- **Real-time updates**: UI refreshes after posting/deleting
- **Chronological order**: Comments displayed oldest-first with timestamps

### UI/UX
- **Relative timestamps**: "2h ago", "1d ago", or full date for older comments
- **Clean interface**: Comment form with submit button, chronological list below
- **Empty states**: Friendly message when no comments exist yet
- **Loading states**: Spinner while fetching comments

### Security (RLS)
- **Read**: Only pool members can see comments on their sessions
- **Create**: Only pool members can comment on their sessions
- **Update**: Users can only edit their own comments
- **Delete**: Users can only delete their own comments

## Database Schema

```sql
CREATE TABLE session_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes:**
- `idx_session_comments_session_id` - Fast lookups by session
- `idx_session_comments_player_id` - Fast lookups by player
- `idx_session_comments_created_at` - Efficient chronological sorting

**Triggers:**
- `update_session_comment_updated_at` - Auto-updates `updated_at` on edit

## API

### Client Library (`src/lib/comments.ts`)

```typescript
// Get all comments for a session
const comments = await getSessionComments(sessionId: string)

// Add a comment (notify parameter controls email notifications, default: false)
const comment = await addSessionComment(sessionId: string, comment: string, notify?: boolean)

// Update a comment (edit)
await updateSessionComment(commentId: string, newComment: string)

// Delete a comment
await deleteSessionComment(commentId: string)
```

### Comment Object

```typescript
interface Comment {
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
```

## Email Notifications

### Current Status
**Email notifications for comments are currently DISABLED by default.**

The infrastructure is fully implemented but inactive. To enable:
- Change `notify` default in `addSessionComment()` from `false` to `true`, or
- Pass `notify: true` when calling the function

### When Enabled
When a user adds a comment (and `notify: true`):
1. Email sent to **all session participants** except the commenter
2. Email includes:
   - Commenter name
   - Session date, time, pool name
   - Comment preview (first 100 characters)
   - Link to session page

**Notification Type**: `comment_added`

**Edge Function**: `supabase/functions/notify/index.ts` → `notifyCommentAdded()`

## Usage Examples

### Basic Comment Flow

```typescript
// Load session page
const session = await getSession(sessionId)
const comments = await getSessionComments(sessionId)

// User posts a comment
await addSessionComment(sessionId, "I'll bring extra balls!")

// Reload comments to show the new one
const updatedComments = await getSessionComments(sessionId)

// User deletes their comment
await deleteSessionComment(commentId)
```

### UI Integration (SessionDetails.tsx)

```typescript
// State
const [comments, setComments] = useState<Comment[]>([])
const [newComment, setNewComment] = useState('')
const [addingComment, setAddingComment] = useState(false)

// Load comments
useEffect(() => {
  loadComments(sessionId)
}, [sessionId])

// Add comment handler
async function handleAddComment(e: React.FormEvent) {
  e.preventDefault()
  if (!session || !newComment.trim() || addingComment) return

  try {
    setAddingComment(true)
    await addSessionComment(session.id, newComment)
    setNewComment('')
    await loadComments(session.id) // Reload to show new comment
  } catch (err: any) {
    setError(err.message || 'Failed to add comment')
  } finally {
    setAddingComment(false)
  }
}
```

## Use Cases

1. **Court changes**: "Court 3 instead of Court 1!"
2. **Arrival coordination**: "Running 10 min late"
3. **Equipment**: "I'll bring an extra paddle for anyone who needs one"
4. **Weather updates**: "Forecast shows rain, anyone want to reschedule?"
5. **Social**: "Great game last week! Let's do it again"
6. **Logistics**: "Parking lot is full, try the overflow lot"

## Future Enhancements

- **Edit comments**: UI for editing (backend already supports it)
- **@mentions**: Notify specific players
- **Rich text**: Basic formatting (bold, italics)
- **Reactions**: 👍 emoji reactions instead of "+1" comments
- **Comment count badge**: Show "(3 comments)" on session cards
- **Real-time updates**: WebSocket for live comment feed
- **Push notifications**: Mobile push for comment replies

## Testing

**Test file**: `tests/comments.test.ts`

**Coverage**:
- Fetch comments (empty state)
- Add comments
- Retrieve with player info
- Chronological ordering
- Delete comments
- Empty text validation
- Timestamp updates on edit

**Run tests**:
```bash
npm test -- comments.test.ts
```

## Migration

**File**: `supabase/migrations/20260126100000_session_comments.sql`

**Apply**:
```bash
supabase db push
```

Or in production:
```bash
# Supabase dashboard → Database → Migrations → Run
```

## Notes

- Comments are **not** deleted when a user leaves a pool (historical record)
- Comments **are** deleted when a session is deleted (CASCADE)
- Comments **are** deleted when a player is deleted (CASCADE)
- No character limit on comments (though UI could add one)
- Markdown/HTML is stored as plain text (not rendered)
