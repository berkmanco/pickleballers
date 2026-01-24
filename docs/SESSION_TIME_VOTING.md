# Session Time Voting Feature

## Core Concept

Instead of creating a session with a fixed time, admin creates a **"time proposal"** with 2-3 options. Players vote, then system either auto-picks or admin confirms.

---

## User Flow

### Admin Side

#### 1. Create Session with Time Voting
- Goes to "Create Session" page
- Toggle: `[ ] Let players vote on time`
- If toggled:
  - Add 2-3 time slots (date + time for each)
  - Set voting deadline (e.g., "Votes due by Tue 6pm")
  - Everything else same (location, courts, cost)
- Click "Create & Send to Players"

#### 2. Voting Period
- Notification sent: "Mike proposed a session - vote on your preferred time!"
- Admin can see real-time vote counts
- Admin can close voting early if consensus is clear

#### 3. Pick Winner
- **Option A (Auto)**: System auto-picks when deadline hits (most votes wins)
- **Option B (Manual)**: Admin reviews votes and clicks "Lock in Tuesday 6pm"
- System converts proposal → confirmed session with winning time
- Sends notification: "Session confirmed for Tuesday 6pm! Opt in now."

### Player Side

#### 1. Receive Notification
- Email: "Mike wants to play - which time works for you?"
- Lists options with vote buttons

#### 2. Vote
- Click link → lands on session voting page
- See options:
  ```
  ⭕ Tuesday, Jan 28 at 6:00 PM    [5 votes]
  ⭕ Wednesday, Jan 29 at 7:00 PM  [2 votes]
  ⭕ Thursday, Jan 30 at 6:00 PM   [3 votes]
  ```
- Select one, click "Submit Vote"
- Can change vote until deadline

#### 3. Winner Announced
- Email: "Tuesday 6pm won! Are you in?"
- Normal opt-in flow continues

---

## Database Schema

### New Tables

```sql
-- session_time_proposals: Stores proposed time options
CREATE TABLE session_time_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  proposed_datetime TIMESTAMPTZ NOT NULL,
  vote_count INT DEFAULT 0,
  is_winner BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- session_votes: Tracks player votes
CREATE TABLE session_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES session_time_proposals(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  voted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, player_id) -- One vote per player per session
);

CREATE INDEX idx_session_votes_proposal ON session_votes(proposal_id);
CREATE INDEX idx_session_votes_player ON session_votes(player_id);
```

### Modify Existing Tables

```sql
-- Add voting fields to sessions table
ALTER TABLE sessions 
  ADD COLUMN voting_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN voting_deadline TIMESTAMPTZ,
  ADD COLUMN voting_status TEXT CHECK (voting_status IN ('voting', 'completed', NULL)) DEFAULT NULL;

-- Update session status enum to include 'voting'
-- Current statuses: 'proposed', 'locked', 'cancelled'
-- New status: 'voting' (used while voting is active)
```

---

## Edge Cases & Decisions

### What if there's a tie?
**Options:**
1. Admin manually breaks tie
2. System picks earliest time
3. System picks time with most "committed" votes (vs "maybe")

**Recommendation:** Admin manually breaks tie (most flexible).

### Can players vote "none of these work"?
**Yes!** Add a "Can't make any of these" option.
- If many players pick this, admin knows to propose new times
- Shows as separate count: "3 players can't make any of these times"

### What if not everyone votes by deadline?
- Send reminder 24h before deadline
- Non-voters are treated as "any time works"
- Admin can see who hasn't voted
- Admin can extend deadline if needed

### What about the opt-in flow?
**Two Approaches:**

#### Approach A: Two-Step (Recommended)
1. **Voting period**: Players vote on time
2. **Winner announced**: Players opt in as committed/maybe (normal flow)

**Pros:** Clean separation, familiar flow after voting
**Cons:** Extra step

#### Approach B: Combined
- Vote = commitment
- Options: "I'm in for Tue 6pm", "I'm in for Wed 7pm", "Maybe any", "Can't make it"
- Winner time = auto-committed those voters

**Pros:** Faster, one step
**Cons:** Complex UX, what if winner changes?

**Recommendation:** **Approach A** - cleaner separation of concerns.

### Do waitlisted players vote?
**Yes** - their vote helps pick a time they can make, even if they're on waitlist initially. Once time is picked, normal waitlist logic applies.

---

## UI States

### Session Card States
- **Voting**: Shows "🗳️ Vote by Jan 25" badge, click to vote
- **Voting Closed**: Shows "Counting votes..." or "Winner: Tuesday 6pm - Opt in!"
- **Confirmed**: Shows final time, "Opt in now!"
- **Locked**: Normal locked session

### Session Details Page
**During Voting:**
```
┌─────────────────────────────────────┐
│ 🗳️ Vote on Time                    │
│ Voting closes Jan 25 at 6:00 PM    │
│                                     │
│ ⭕ Tuesday, Jan 28 at 6:00 PM       │
│    5 votes                          │
│                                     │
│ ⭕ Wednesday, Jan 29 at 7:00 PM     │
│    2 votes                          │
│                                     │
│ ⭕ Thursday, Jan 30 at 6:00 PM      │
│    3 votes                          │
│                                     │
│ [ ] None of these work for me      │
│                                     │
│        [Submit Vote]                │
│                                     │
│ 10 of 15 players have voted        │
└─────────────────────────────────────┘
```

**After Winner Selected:**
```
┌─────────────────────────────────────┐
│ ✅ Time Confirmed!                  │
│ Tuesday, Jan 28 at 6:00 PM         │
│ (8 votes - winner!)                │
│                                     │
│ Are you in?                        │
│ [Committed] [Maybe] [Drop Out]     │
└─────────────────────────────────────┘
```

---

## Alternative: "Doodle-style" Voting

Instead of radio buttons (pick one):
- Show calendar grid with checkboxes
- Players check **ALL** times that work for them
- System picks time with most checkmarks
- More flexible but more complex UI

**Pros:**
- Players express full availability
- Better data for admin to make decision

**Cons:**
- More complex UX
- Harder to show results clearly
- Mobile UI challenges

**Recommendation:** Save for v2.

---

## MVP Implementation Plan

### Phase 1: Core Voting
1. Admin can enable voting when creating session
2. Admin adds 2-3 time options
3. Players receive "Vote now" notification
4. Players can vote (one choice)
5. Players can change vote before deadline
6. Show real-time vote counts

### Phase 2: Winner Selection
1. **Auto-pick** winner when deadline hits (most votes)
2. Convert session from `voting` → `proposed` status
3. Update session datetime to winning time
4. Send "Time confirmed!" notification
5. Normal opt-in flow continues

### Phase 3: Admin Tools
1. Admin can see who voted for what
2. Admin can manually close voting early
3. Admin can extend deadline
4. Admin can manually override winner (if needed)

### Phase 4: Enhancements
1. "None of these work" option
2. Reminder notification before deadline
3. Show participant names on vote counts (transparency)
4. Tie-breaker rules

---

## Notifications

### 1. Voting Opened
**Subject:** "🗳️ Vote: When should we play?"

**Body:**
> Mike proposed a pickleball session! Vote on your preferred time:
> 
> - Tuesday, Jan 28 at 6:00 PM
> - Wednesday, Jan 29 at 7:00 PM
> - Thursday, Jan 30 at 6:00 PM
> 
> **Vote by Jan 25 at 6:00 PM**
> 
> [Cast Your Vote]

### 2. Voting Reminder (24h before deadline)
**Subject:** "⏰ Last chance to vote - closes tomorrow"

**Body:**
> Don't forget to vote on the session time! Voting closes tomorrow at 6:00 PM.
> 
> Current results:
> - Tuesday 6pm: 5 votes
> - Wednesday 7pm: 2 votes
> - Thursday 6pm: 3 votes
> 
> [Vote Now]

### 3. Winner Announced
**Subject:** "✅ Time confirmed: Tuesday at 6:00 PM - Are you in?"

**Body:**
> The votes are in! We'll be playing **Tuesday, Jan 28 at 6:00 PM**.
> 
> 📊 Results: 8 votes for Tuesday, 3 for Wednesday, 2 for Thursday
> 
> Are you committed for Tuesday?
> 
> [I'm In!] [Maybe] [Can't Make It]

---

## Technical Implementation Notes

### Vote Counting
- Use database trigger to update `vote_count` on `session_time_proposals` when vote is inserted/updated/deleted
- Cache counts to avoid N+1 queries

### Winner Selection (Automated)
```sql
-- Function: auto_select_winner
-- Runs via pg_cron at voting_deadline
CREATE OR REPLACE FUNCTION auto_select_session_winner(p_session_id UUID)
RETURNS void AS $$
DECLARE
  winning_proposal_id UUID;
  winning_datetime TIMESTAMPTZ;
BEGIN
  -- Find proposal with most votes
  SELECT id, proposed_datetime 
  INTO winning_proposal_id, winning_datetime
  FROM session_time_proposals
  WHERE session_id = p_session_id
  ORDER BY vote_count DESC, proposed_datetime ASC
  LIMIT 1;
  
  -- Update session with winner
  UPDATE sessions 
  SET 
    datetime = winning_datetime,
    voting_status = 'completed',
    status = 'proposed'
  WHERE id = p_session_id;
  
  -- Mark winning proposal
  UPDATE session_time_proposals
  SET is_winner = TRUE
  WHERE id = winning_proposal_id;
  
  -- Send notification (via notify edge function)
  -- This would be called from a pg_cron job
END;
$$ LANGUAGE plpgsql;
```

### Cron Job
```sql
-- Schedule winner selection check
-- Runs every 15 minutes, checks for sessions past voting_deadline
SELECT cron.schedule(
  'auto-select-session-winners',
  '*/15 * * * *',
  $$
  SELECT auto_select_session_winner(id)
  FROM sessions
  WHERE voting_enabled = TRUE
    AND voting_status = 'voting'
    AND voting_deadline <= NOW();
  $$
);
```

---

## Security & RLS

```sql
-- Players can view proposals for sessions in their pool
CREATE POLICY select_session_time_proposals ON session_time_proposals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN pool_players pp ON pp.pool_id = s.pool_id
      WHERE s.id = session_id
        AND pp.player_id = auth.uid()
        AND pp.is_active = TRUE
    )
  );

-- Players can insert/update their own votes
CREATE POLICY insert_session_votes ON session_votes
  FOR INSERT WITH CHECK (player_id = auth.uid());

CREATE POLICY update_session_votes ON session_votes
  FOR UPDATE USING (player_id = auth.uid());

-- Players can view all votes (transparency)
CREATE POLICY select_session_votes ON session_votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN pool_players pp ON pp.pool_id = s.pool_id
      WHERE s.id = session_id
        AND pp.player_id = auth.uid()
        AND pp.is_active = TRUE
    )
  );
```

---

## Open Questions

1. **Should vote counts be public or hidden until voting closes?**
   - **Public**: Transparency, social proof
   - **Hidden**: Prevents bandwagon effect
   - **Recommendation:** Public (encourages participation)

2. **What if admin wants to add more time options mid-vote?**
   - Allow adding options, but resets deadline?
   - Or lock options once voting starts?
   - **Recommendation:** Lock options once first vote is cast

3. **Can admin cancel voting and just pick a time?**
   - Yes - add "Cancel Voting & Set Time" button
   - Converts back to normal session with admin-selected time

4. **Integration with CourtReserve?**
   - Could auto-check availability for proposed times
   - Show "⚠️ No courts available" warning on options
   - **Recommendation:** Phase 2 enhancement

---

## Success Metrics

- % of sessions using voting feature
- Average time to reach consensus (voting duration)
- Attendance rate for voted sessions vs. non-voted
- Player satisfaction (survey after using feature)

---

## Future Enhancements

### v2 Features
- Doodle-style multi-select availability
- Recurring session voting (vote once, applies to multiple weeks)
- AI-suggested times based on historical player availability
- Integration with player calendars (Google Calendar, iCal)
- "Best for everyone" algorithm (maximizes attendance)

### v3 Features
- Location voting (multiple court options)
- Combined time + location voting matrix
- Player preferences (preferred time ranges)
- Predictive availability based on past behavior
