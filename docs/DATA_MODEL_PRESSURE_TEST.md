# Data Model Pressure Test

This document validates the data model by walking through real scenarios, key queries, state machines, and edge cases.

## Key Queries We'll Need

If the schema can't support these queries efficiently, it's wrong.

### Session Queries
```sql
-- 1. Get all upcoming sessions for a pool with participant counts
SELECT s.*, 
  COUNT(sp.id) FILTER (WHERE sp.status IN ('committed', 'paid')) as committed_count,
  COUNT(sp.id) FILTER (WHERE sp.status = 'maybe') as waitlist_count
FROM sessions s
LEFT JOIN session_participants sp ON s.id = sp.session_id
WHERE s.pool_id = ? AND s.proposed_date >= CURRENT_DATE
GROUP BY s.id

-- 2. Get session details with all participants and payment status
SELECT s.*, p.name, p.venmo_account, sp.status, pay.status as payment_status, pay.amount
FROM sessions s
JOIN session_participants sp ON s.id = sp.session_id
JOIN players p ON sp.player_id = p.id
LEFT JOIN payments pay ON sp.id = pay.session_participant_id
WHERE s.id = ?

-- 3. Calculate cost for a session
-- Need: courts_needed, guest_count, guest_pool ($48 * courts)
SELECT 
  s.id,
  COUNT(sp.id) FILTER (WHERE sp.status IN ('committed', 'paid')) as total_players,
  COUNT(sp.id) FILTER (WHERE sp.status IN ('committed', 'paid') AND p.id != admin_player_id) as guest_count,
  -- courts_needed = CASE WHEN total <= 7 THEN 1 WHEN total <= 11 THEN 2 ... END
  -- guest_cost = (48 * courts_needed) / guest_count
FROM sessions s
JOIN session_participants sp ON s.id = sp.session_id
JOIN players p ON sp.player_id = p.id
WHERE s.id = ?
```

### Player Queries
```sql
-- 4. Get all sessions a player is part of (upcoming)
SELECT s.*, sp.status
FROM sessions s
JOIN session_participants sp ON s.id = sp.session_id
WHERE sp.player_id = ? AND s.proposed_date >= CURRENT_DATE

-- 5. Get player's payment history
SELECT s.proposed_date, pay.amount, pay.status, pay.refund_amount
FROM payments pay
JOIN session_participants sp ON pay.session_participant_id = sp.id
JOIN sessions s ON sp.session_id = s.id
WHERE sp.player_id = ?
ORDER BY s.proposed_date DESC
```

### Admin Queries
```sql
-- 6. Payment dashboard: who paid, who hasn't for a session
SELECT p.name, p.venmo_account, sp.status, pay.status as payment_status, pay.amount
FROM session_participants sp
JOIN players p ON sp.player_id = p.id
LEFT JOIN payments pay ON sp.id = pay.session_participant_id
WHERE sp.session_id = ? AND sp.status IN ('committed', 'paid')

-- 7. Sessions needing action (below minimum at 24h mark)
SELECT s.*
FROM sessions s
WHERE s.status = 'confirmed'
  AND s.proposed_date = CURRENT_DATE + INTERVAL '1 day'
  AND (SELECT COUNT(*) FROM session_participants WHERE session_id = s.id AND status IN ('committed', 'paid')) < s.min_players
```

---

## State Machines

### Session Status
```
proposed ──► confirmed ──► completed
    │            │
    │            ▼
    └────► cancelled
```

| From | To | Trigger |
|------|----|---------|
| proposed | confirmed | Admin books court |
| proposed | cancelled | Not enough interest / admin cancels |
| confirmed | completed | Session date passes |
| confirmed | cancelled | Below minimum at 12h mark |

### Participant Status
```
         ┌─────────────────┐
         ▼                 │
(none) ──► committed ──► paid
              │            │
              ▼            │
            maybe ◄────────┘ (if drops out and wants back on waitlist)
              │
              ▼
             out
```

| From | To | Trigger |
|------|----|---------|
| (none) | committed | Player clicks "I'm In" |
| (none) | maybe | Player clicks "Maybe" / session full |
| committed | paid | Payment verified |
| committed | maybe | Drops to waitlist |
| committed | out | Drops out completely |
| maybe | committed | Spot opens, promoted from waitlist |
| maybe | out | Removes from waitlist |
| paid | out | Drops out after paying (owes or needs replacement) |

### Payment Status
```
(none) ──► pending ──► paid
                │        │
                │        ▼
                └──► refunded (if replacement found after paying)
```

| From | To | Trigger |
|------|----|---------|
| (none) | pending | Payment deadline reached, Venmo request sent |
| pending | paid | Admin marks as received |
| paid | refunded | Player dropped, replacement found |

---

## Sample Data Walkthrough

### Scenario: Saturday Session with 6 Players

**Step 1: Session Proposed (Tuesday)**
```
sessions:
  id: session-1
  pool_id: pool-1
  proposed_date: 2025-01-11
  proposed_time: 13:00
  duration_minutes: 60
  min_players: 4
  max_players: 7
  status: 'proposed'
  courts_needed: NULL (not yet known)
  court_numbers: NULL
  admin_cost_per_court: 9.00
  guest_pool_per_court: 48.00
```

**Step 2: Players Opt In (Tuesday-Thursday)**
```
session_participants:
  | player_id | status    | opted_in_at | waitlist_position |
  |-----------|-----------|-------------|-------------------|
  | mike      | committed | Tue 10am    | NULL              |
  | erik      | committed | Tue 11am    | NULL              |
  | sarah     | committed | Tue 2pm     | NULL              |
  | john      | committed | Wed 9am     | NULL              |
  | lisa      | maybe     | Wed 10am    | 1                 |  -- waitlist
  | tom       | committed | Thu 8am     | NULL              |
```

**Step 3: Court Booked (Thursday) - 5 committed**
```
sessions (updated):
  status: 'confirmed'
  courts_needed: 1
  court_numbers: ['Court 8']
  court_booking_ids: ['CR-12345']
```

**Step 4: More Join (Thursday-Friday)**
```
session_participants (updated):
  | player_id | status    |
  |-----------|-----------|
  | mike      | committed |
  | erik      | committed |
  | sarah     | committed |
  | john      | committed |
  | lisa      | committed |  -- promoted from waitlist
  | tom       | committed |
  
6 players, 1 court, 5 guests
Guest cost: $48 / 5 = $9.60 each
```

**Step 5: Payment Deadline (Friday 1pm - 24h before)**
```
payments (created):
  | participant  | amount | status  |
  |--------------|--------|---------|
  | erik         | 9.60   | pending |
  | sarah        | 9.60   | pending |
  | john         | 9.60   | pending |
  | lisa         | 9.60   | pending |
  | tom          | 9.60   | pending |

(Mike doesn't get a payment record - he fronted the court cost)
```

**Step 6: Payments Come In**
```
payments (updated):
  | participant  | amount | status  |
  |--------------|--------|---------|
  | erik         | 9.60   | paid    |
  | sarah        | 9.60   | paid    |
  | john         | 9.60   | pending |  -- hasn't paid yet
  | lisa         | 9.60   | paid    |
  | tom          | 9.60   | paid    |
```

**Step 7: Session Completed**
```
sessions (updated):
  status: 'completed'
```

✅ **This scenario works with our schema!**

---

## Edge Cases

### Edge Case 1: Someone drops after payment deadline
**Scenario**: John drops out Friday 6pm (after payment deadline)

**Current data**:
- John: status='committed', payment status='pending'

**What should happen**:
- John still owes $9.60 (unless replacement found)
- If Amy from waitlist joins, John is off the hook
- Amy pays same $9.60 (rate is locked)

**Does schema support this?**
- ✅ John's participant status → 'out'
- ✅ Amy promoted, status → 'committed'
- ✅ Amy gets payment record at same $9.60
- ✅ John's payment can be marked 'forgiven' or 'owed' (need a status for this?)

**🔴 ISSUE**: Payment status needs a way to mark "owed but forgiven" or "owed but not collected"
- Options: Add 'forgiven' status, or just use 'notes' field, or admin manually handles

---

### Edge Case 2: Session needs 2 courts after already booking 1
**Scenario**: Started with 5 players, booked 1 court. Now 9 want to play.

**What should happen**:
- Admin books 2nd court
- courts_needed: 2
- court_numbers: ['Court 8', 'Court 9']
- Cost recalculates: $96 pool / 8 guests = $12 each

**Does schema support this?**
- ✅ court_numbers is an array
- ✅ courts_needed can be updated
- ✅ Cost calculated at payment deadline (not locked yet)

**But what if payment requests already sent?**
- 🔴 ISSUE: If this happens after payment deadline, we'd need to adjust
- **Mitigation**: Don't add courts after payment deadline, or accept the complexity

---

### Edge Case 3: Admin doesn't play
**Scenario**: Mike books the court but can't play. 4 others play.

**What should happen**:
- Mike still pays $9 (he's on the booking)
- 4 guests split $48 = $12 each
- Mike is NOT a session_participant

**Does schema support this?**
- ✅ sessions.created_by tracks who booked (Mike)
- ✅ session_participants only includes people playing
- ✅ Cost calculation counts guests only from participants
- 🔴 ISSUE: How do we know Mike paid his $9 if he's not a participant?

**Solution options**:
1. Mike is always a participant (even if not playing) with special flag
2. Admin cost tracked on session itself (already paid when booking)
3. Mike adds himself as participant with status='paid' but flagged as admin

**Recommendation**: Option 2 - track admin payment on session, not in payments table.

---

### Edge Case 4: Session cancelled after some paid
**Scenario**: 3 people committed and paid, but 4th never materializes. Cancel at 12h mark.

**What should happen**:
- Session cancelled
- All payments refunded
- Players notified

**Does schema support this?**
- ✅ Session status → 'cancelled'
- ✅ Payment status → 'refunded' for all
- ✅ refunded_at timestamp set

---

### Edge Case 5: Player in multiple pools
**Scenario**: Lisa is in both "Weekend Warriors" and "Couples League"

**Does schema support this?**
- ✅ players table is separate from pool_players
- ✅ pool_players junction table supports many-to-many
- ✅ Lisa sees sessions from both pools

---

### Edge Case 6: Waitlist ordering
**Scenario**: Session full at 7. Amy, Bob, Carol all click "Maybe" in that order.

**Does schema support this?**
- ✅ waitlist_position field on session_participants
- ✅ Amy=1, Bob=2, Carol=3
- ✅ When spot opens, Amy (position 1) is promoted

**But what if Amy declines the spot?**
- Amy's waitlist_position set to NULL, status → 'out'
- Bob's position stays 2 (or do we renumber?)
- **Recommendation**: Don't renumber, just promote lowest position number

---

## Schema Adjustments Needed

Based on pressure testing:

### 1. Payment status expansion ✅
Current: `pending`, `paid`, `refunded`
Add: `forgiven` (admin decided not to collect)

Final payment statuses: `pending`, `paid`, `refunded`, `forgiven`

### 2. Admin always plays ✅
- Admin is always a participant in sessions they create
- Admin's $9/court is fronted when booking (implicit, not tracked as payment)
- Admin is in session_participants like everyone else, but no payment record (they already paid)

---

## Queries That Validate the Model

If we can write these queries cleanly, the model is good:

| Query | Can Write? |
|-------|------------|
| Get upcoming sessions for a player | ✅ |
| Get participant list with payment status | ✅ |
| Calculate guest cost for a session | ✅ |
| Find sessions at risk (below min at 24h) | ✅ |
| Get player's payment history | ✅ |
| Promote from waitlist | ✅ |
| Handle late dropout (mark owed) | ⚠️ Need 'forgiven' status |

---

## Final Schema Validation

After pressure testing, the schema looks **solid** with one minor addition:

```sql
-- payments.status options:
'pending'   -- Venmo request sent, awaiting payment
'paid'      -- Payment received
'refunded'  -- Session cancelled or replacement found
'forgiven'  -- Admin decided not to collect (dropout edge case)
```

Everything else works! ✅

---

## Next Steps

1. [x] Review edge cases above - any we missed?
2. [x] Decide on `forgiven` status ✅ Added
3. [x] Create actual SQL schema ✅ `supabase/schema.sql`
4. [x] Insert sample data ✅ `supabase/sample_data.sql`
5. [ ] Run the key queries in Supabase to validate

