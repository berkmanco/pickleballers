# Feature Status

## Completed Features ✅

### 1. Pool Management
- Create pools with name/description
- View pools you own or are a member of
- Pool details page with player list
- Generate registration links

### 2. Player Registration
- One-time registration links
- Magic link authentication
- Auto-link player records to auth users
- Player added to pool on registration

### 3. Session Proposals
- Create sessions with date/time/location
- View sessions in pool
- Session details page
- Admin auto-added as first participant

### 4. Player Opt-In System
- Players opt in as "committed" or "maybe"
- Drop out functionality
- Real-time participant count
- Dynamic cost calculation
- Waitlist support

### 5. Privacy & RLS
- Pool members can see each other
- Sensitive info (email, phone, Venmo) hidden from non-admins
- Proper RLS policies for all tables

---

## Current Feature: Payment Tracking 🚧

### Goal
Track payments from guests, generate Venmo links, provide admin dashboard.

### Key Timing
- Payment records created when **roster locks (24h before session)**
- Cost calculated based on final headcount
- Rate is LOCKED at this point (no recalculation)

### Planned Features
1. **Create payment records** at roster lock (24h before)
2. **Calculate final cost** based on committed players
3. **Generate Venmo links** for each guest
4. **Admin dashboard** showing payment status
5. **Mark payments** as received/forgiven

### Database
`payments` table already exists with:
- `session_participant_id` (FK)
- `amount`
- `status` (pending, paid, refunded, forgiven)
- `venmo_payment_link`

### Questions to Resolve
- Trigger: Manual "lock roster" button vs automatic at 24h?
- UI: Separate payments page vs on session details?

---

## Future Features 📋

### Notifications
- Email notifications (Resend)
- SMS notifications (Twilio)
- Session reminders
- Payment reminders

### Waitlist Auto-Promotion
- When someone drops, auto-promote from waitlist
- Notify promoted player

### Court Booking Integration
- CourtReserve availability checking
- Booking automation (if API available)

---

## Technical Notes

### Auth Pattern
Don't use `async/await` in `onAuthStateChange` - it blocks supabase queries. Use `.then()/.catch()` instead.

### RLS Pattern
Use `SECURITY DEFINER` functions for complex membership checks to avoid infinite recursion.

### useEffect Dependencies
Use stable primitives like `user?.id` instead of object references like `user` to avoid infinite loops.
