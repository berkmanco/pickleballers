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

### 6. Payment Tracking
- Lock roster button for admins (confirms session)
- Payment records created automatically when roster locks
- Cost per guest calculated and frozen at lock time
- Venmo payment links generated for each guest
- Payment status tracking (pending, paid, forgiven)
- Admin can mark payments as paid or forgiven
- Payment summary with progress bar
- Payment list on session details page

---

## Current Feature: Notifications 🚧

### Planned Features
- Email notifications (Resend)
- SMS notifications (Twilio)
- Session reminders
- Payment reminders

---

## Future Features 📋

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
