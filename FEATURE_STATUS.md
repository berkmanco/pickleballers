# Feature Status

## Completed Features ✅

### 1. Pool Management
- Create pools with name/description
- View pools you own or are a member of
- Pool details page with player list
- Generate registration links (auto-copy to clipboard)

### 2. Player Registration
- One-time registration links
- Magic link authentication
- Auto-link player records to auth users
- Player added to pool on registration
- SMS consent checkbox with Terms link

### 3. Session Proposals
- Create sessions with date/time/location
- Court numbers field
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
- Venmo payment links with hashtags for auto-matching:
  - Admin "Request" → `txn=charge` to guest
  - Player "Pay" → `txn=pay` to admin
- Payment status tracking (pending, paid, forgiven)
- Admin can mark payments as paid or forgiven
- Payment summary with progress bar

### 7. Notifications
- Email notifications via Resend
- SMS notifications via Twilio (opt-in)
- Notification types:
  - New session created → email to pool members
  - Roster locked → payment request email to guests (with correct Venmo pay link)
  - Payment reminder → email to guests with pending payments
  - Session reminder → email + optional SMS (today/tomorrow logic)
  - Waitlist promoted → email + SMS
- **Manual "Send Reminder" button** for admins to trigger session reminders
- Notification preferences in Settings page
- Notification log for auditing
- Rate limiting (600ms between emails)

### 8. Venmo Auto-Reconciliation
- Cloudflare Email Worker receives Venmo emails
- Supabase Edge Function parses transactions
- Auto-matching by hashtag (`#dinkup-{payment_id}`)
- Fuzzy matching by amount + sender name
- `venmo_transactions` table for audit trail

### 9. PWA Support
- Installable on iOS and Android
- Offline caching
- App icons (192x192, 512x512)

### 10. Session Management
- Delete session (cascade deletes participants/payments)
- Unlock roster (resets to proposed, deletes payments)
- Cancel session (soft delete, preserves data)

### 11. Add Player to Session
- Admin can add existing pool members to a session
- Dropdown shows available players (not already active in session)
- Re-adds players who previously opted out
- Updates cost calculations automatically

### 12. Add Player to Pool
- **Add Existing Player**: Dropdown of all players not already in pool
- **Create New Player**: Form for name, Venmo, email, phone
- Bypasses registration flow (no magic link needed)
- Auto-formats phone to E.164, strips @ from Venmo

### 13. Testing
- **143 automated tests** via Vitest
- Coverage: pools, sessions, registration, payments, notifications, venmo-parser
- Run with `npm test`

---

## Future Features 📋

### High Priority
- Automatic session reminders (pg_cron job for 24h before)

### Medium Priority
- Players page with detailed view
- Auto-login after registration
- Custom Supabase auth email templates

### Backlog
- CourtReserve integration
- Admin can set costs or make free (outdoor sessions)
- Multi-use registration links
- Open registration (anyone can join without link)
- Granular notification settings
- Dynamic OG meta tags for session links
- Google Maps link for court location in emails
- Allow player to leave a pool
- Delete account functionality
- Opt out of all notifications (master toggle)
- Enhanced account management (settings page improvements)
- Timezone support for session times
- Show committed players in reminder emails ("Who's playing: Mike, Erik, +3 more")

---

## Known Issues 🐛

- Safari magic link may not complete login (cross-origin redirect)
- Gmail app → Chrome handoff can lose token
- SMS requires Twilio toll-free verification

---

## Technical Notes

### Auth Pattern
Don't use `async/await` in `onAuthStateChange` - it blocks supabase queries. Use `.then()/.catch()` instead.

### RLS Pattern
Use `SECURITY DEFINER` functions for complex membership checks to avoid infinite recursion.

### useEffect Dependencies
Use stable primitives like `user?.id` instead of object references like `user` to avoid infinite loops.

### Test Mode
Edge functions check `TEST_MODE` or `IS_LOCAL` to skip real email/SMS during testing.
