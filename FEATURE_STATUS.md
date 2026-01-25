# Feature Status

## Completed Features ✅

### 1. Pool Management
- Create pools with name/description
- View pools you own or are a member of
- Pool details page with player list
- Generate registration links (auto-copy to clipboard)
- **Remove player from pool** (soft delete, can re-add via dropdown)

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
- **Cost breakdown showing calculation formula**
- **Admin can adjust courts before locking roster**
- **Cost uses reserved courts, not auto-calculated**

### 7. Notifications
- Email notifications via Resend
- SMS notifications via Twilio (opt-in)
- Notification types:
  - New session created → email to pool members
  - Roster locked → payment request email to guests (with correct Venmo pay link)
  - Payment reminder → email to guests with pending payments
  - Session reminder → email + optional SMS (today/tomorrow logic)
  - Waitlist promoted → email + SMS
  - **Session cancelled → email + SMS to all participants**
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
- **Edit session** (owner can edit all details before roster is locked)
- Delete session (cascade deletes participants/payments)
- Unlock roster (resets to proposed, deletes payments)
- **Cancel session** (sets status to cancelled, notifies all participants via email/SMS)

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

### 13. Multi-Use Registration Links
- **Short, memorable URLs** based on pool slug: `dinkup.link/r/weekend-warriors`
- **Unlimited use** - share in group chats, no expiration
- **Admin toggle** - open/close registration with checkbox
- **Backward compatible** - legacy token links still work
- **Duplicate prevention** - checks for existing email in pool
- See `docs/MULTI_USE_REGISTRATION.md` for details

### 15. Testing
- **208 automated tests** via Vitest
- Coverage: pools, sessions, registration (including multi-use), payments, notifications, notification preferences (client + Edge Function + database), venmo-parser, courtreserve
- Run with `npm test`

### 14. CourtReserve Integration
- **Check court availability** at Pickle Shack (no login required)
- Fetches real-time data from CourtReserve's public API
- Edge function: `courtreserve`
- UI: "Check Availability" button on Create Session page (for Pickle Shack location)
- Auto-fills court numbers when courts are available
- Shows available courts for requested date/time/duration

### 15. Quick Wins
- **Hide past sessions**: Filters out today's sessions that have already ended
- **Add to Calendar**: Google Calendar + iCal buttons on session page
- **Calendar links in emails**: Session created and reminder emails include calendar links
- **CI/CD Pipeline**: GitHub Actions workflow (build, test, deploy to Vercel)

### 16. Automated Notifications (pg_cron)
- **Session reminder** (24h before): Automatic email to committed players
- **Commitment reminder** (2-3 days before): "Are you in?" email to uncommitted players
- **Payment reminder** (1-2 days before): Auto-reminder for unpaid participants
- **Admin low commitment alert**: Alert when below minimum players
- Database functions + migration for cron scheduling
- Single `run_automated_notifications()` function handles all types

### 14. Granular Notification Preferences ✅
**Status**: Complete  
**Added**: January 25, 2026

Comprehensive notification preference system with per-type email/SMS toggles:
- **5 notification types**: Session reminders (24h), payment requests, payment reminders, waitlist promotions, session cancellations
- **Independent toggles**: Email and SMS can be enabled/disabled separately for each type
- **Settings UI**: Clean table matrix showing all preferences
- **Twilio compliant**: Separate opt-in for each SMS type (fixes Error 30504)
- **Backward compatible**: Dual-write to legacy JSONB column during transition
- **Smart defaults**: Email ON for all, SMS OFF for all (explicit opt-in required)
- **Database**: New `notification_preferences` table with RLS policies
- **Edge Function**: Updated to query granular preferences
- **Tests**: 10 new tests covering all preference operations

---

## Future Features 📋

### Quick Wins (High Impact, Low Effort)
- **Show committed players in reminder emails** - "Who's playing: Mike, Erik, +3 more" → social proof, increases attendance
- **Welcome email for new pool members** - When someone joins a pool, send them an email listing upcoming sessions they can RSVP to → prevents new members from missing sessions that were proposed before they joined
- **Google Maps link for court location in emails** - Tap to navigate → reduces confusion
- **Player can explicitly opt-out of a session** - Stop getting reminders for sessions they're not playing
- **Payment calculation transparency** - Show breakdown: "Court: $60 ÷ 8 players = $7.50 each" → eliminates confusion about cost splitting.

### High Impact (Worth the Effort)
- **Session time voting** - Admin proposes 2-3 time slots, players vote, system picks winner → solves coordination problem
- **Players page with detailed view** - See all players, payment history, attendance stats → better admin tools
- **Auto-login after registration** - Skip magic link step → smoother onboarding UX
- **"Adjust & Re-bill"** - Send supplemental payment requests when costs change → handles real-world court changes

### Medium Priority
- **Session comments** - Discussion thread on each session (any pool member can comment, optional email notifications) → improves coordination and communication
- Court unavailable alert (CourtReserve check for admin) → being handled elsewhere
- Admin shortfall indicator - Show when admin is covering extra costs
- Custom Supabase auth email templates (branding)
- Allow player to leave a pool

### Backlog (Nice to Have)
- Admin can set costs or make free (outdoor sessions)
- Open registration (anyone can join without link)
- Dynamic OG meta tags for session links
- Delete account functionality (GDPR compliance)
- Opt out of all notifications (master toggle)
- Enhanced account management (settings page improvements)
- Timezone support for session times
- Claim account / link existing player to auth user

---

## Known Issues 🐛

- Safari magic link may not complete login (cross-origin redirect)
- Gmail app → Chrome handoff can lose token
- SMS requires Twilio toll-free verification
- Auth callback still not working (all in Chrome on Mac)
    - I'm logged out
    - I click a link from my email (Gmail) that directly links me to a session page
    - I'm redirected to the login page
    - I login
    - I get an auth email from supabase and click the link
    - *I'm directed to the dashboard* - this is wrong, I should be directed to the session page

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
