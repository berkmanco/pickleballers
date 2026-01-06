# Pickleballers App - Architecture & Workflow

## Overview
A self-service web application to coordinate pickleball games among friends and family. The goal is to shift coordination overhead from the admin to individual players through an opt-in model, making it easy for players to see available sessions and commit themselves.

## Tech Stack
- **Frontend**: React + TypeScript + Vite (mobile-first)
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **ORM**: Drizzle ORM (for type-safe database queries)
- **Deployment**: Vercel
- **Styling**: Tailwind CSS (mobile-first responsive)
- **Auth**: Supabase Magic Links (passwordless)
- **Email**: Resend
- **SMS**: Twilio
- **Linting**: ESLint

## Core Concepts

### 1. Pools (Groups)
- Multiple pools for different social circles (friends, couples, family)
- Each pool has:
  - Name
  - Description
  - Multiple admins (can have multiple admins per pool)
  - Created date
  - Active status

### 2. Players
- Belong to one or more pools
- Attributes:
  - Name
  - Phone number
  - Venmo account name (required - no cash payments)
  - Preferred payment method (Venmo, or Stripe if enabled)
  - Notification preferences (Email, SMS, or Both)
  - Active/Inactive status (include/exclude from invitations)
  - Join date

### 3. Sessions (Game Proposals)
- Proposed date/time for a game
- Belong to a specific pool
- Can be proposed by admin OR any player in the pool
- Have:
  - Proposed date/time
  - Minimum players needed (typically 4)
  - Maximum players (typically 8, but flexible)
  - Status: "proposed", "confirmed", "cancelled", "completed"
  - Court booking reference (if booked)
  - Court number
  - Court location
  - CourtReserve availability status (checked before proposing)
  - Booking deadline (14 days in advance constraint)
  - Cost per hour (fixed: $16/hr, set by CourtReserve)
  - Cost per player (calculated dynamically: cost_per_hour * duration / number_of_committed_players)
  - Duration (typically 1 hour)

### 4. Session Participants
- Many-to-many relationship between players and sessions
- Players opt-in themselves (no manual invitation needed)
- Status options:
  - "in_unpaid" - Committed but not paid (default when opting in)
  - "in_paid" - Committed and paid
  - "maybe" - Interested but not committed (waitlist)
  - "out" - Dropped out (cancelled their commitment)
- Timestamps for status changes
- Position in queue (for waitlist when session is full)

### 5. Payments
- Track payments received (Venmo only - digital payments)
- Link to session participants
- Fields:
  - Amount
  - Payment method: "venmo" (or "stripe" if enabled)
  - Venmo transaction ID (for reconciliation)
  - Venmo payment link/QR code (generated when player commits)
  - Payment date
  - Status: "pending", "verified", "disputed", "refunded", "no_refund_cancelled"
  - Notes

## Database Schema

### Tables

#### `pools`
```sql
id: uuid (primary key)
name: text
description: text
owner_id: uuid (references auth.users) -- MVP: single admin, but pool_admins table ready for multi-admin
created_at: timestamp
updated_at: timestamp
is_active: boolean
```

#### `pool_admins` (junction table for multi-admin support - not in MVP but architecture ready)
```sql
id: uuid (primary key)
pool_id: uuid (references pools)
admin_id: uuid (references auth.users)
added_at: timestamp
is_active: boolean
```

#### `players`
```sql
id: uuid (primary key)
name: text
phone: text
venmo_account: text (required - no cash payments)
preferred_payment_method: text (venmo, stripe)
notification_preferences: jsonb (email: boolean, sms: boolean)
is_active: boolean (include/exclude from invitations)
created_at: timestamp
updated_at: timestamp
```

#### `pool_players` (junction table)
```sql
id: uuid (primary key)
pool_id: uuid (references pools)
player_id: uuid (references players)
joined_at: timestamp
is_active: boolean
```

#### `registration_links` (one-time use registration tokens)
```sql
id: uuid (primary key)
pool_id: uuid (references pools)
token: text (unique, one-time use)
created_by: uuid (references auth.users)
created_at: timestamp
expires_at: timestamp
used_at: timestamp (nullable - marks as used)
used_by: uuid (references players, nullable)
```

#### `sessions`
```sql
id: uuid (primary key)
pool_id: uuid (references pools)
proposed_date: timestamp
proposed_time: time
duration_hours: decimal (default 1.0)
min_players: integer (default 4)
max_players: integer (default 8)
status: text (proposed, confirmed, cancelled, completed) -- MVP: removed "gathering_interest"
court_booking_id: text (CourtReserve reference)
court_number: text
court_location: text
court_available: boolean (MVP: manual check, but ready for automation)
cost_per_hour: decimal (default 16.00, set by CourtReserve)
cost_per_player: decimal (calculated dynamically: cost_per_hour * duration / committed_players)
booking_deadline: timestamp (14 days before proposed_date)
is_recurring: boolean (MVP: false, but architecture ready for recurring)
recurring_pattern: jsonb (MVP: null, but ready for frequency, end_date, etc.)
created_by: uuid (references players, MVP: admin only, but ready for player proposals)
created_at: timestamp
updated_at: timestamp
```

#### `session_participants`
```sql
id: uuid (primary key)
session_id: uuid (references sessions)
player_id: uuid (references players)
status: text (in_unpaid, in_paid, maybe, out)
status_changed_at: timestamp
opted_in_at: timestamp
waitlist_position: integer (null if not on waitlist)
```

#### `payments`
```sql
id: uuid (primary key)
session_participant_id: uuid (references session_participants)
amount: decimal
payment_method: text (venmo, stripe)
venmo_transaction_id: text (nullable, for Venmo reconciliation)
venmo_payment_link: text (generated Venmo link/QR code)
stripe_payment_intent_id: text (nullable, if using Stripe)
venmo_request_sent_at: timestamp (when payment request was sent)
payment_date: timestamp
status: text (pending, paid, refunded) -- MVP: simplified from complex enum
refunded_at: timestamp (if player cancelled and got refund)
cancelled_within_24h: boolean (cancelled too late for refund)
replacement_found: boolean (if replacement took their spot)
notes: text
created_at: timestamp
```

## User Roles & Permissions

### Admin (You or Other Pool Admins)
- Create/manage pools
- Add other admins to pools (multi-admin support)
- Add/remove players from pools
- Propose sessions (with CourtReserve availability check)
- **Book courts** when session reaches minimum (only admins can book - only you have membership)
- View all pools and sessions
- Override/approve cancellations if needed
- View payment dashboard
- Mark Venmo payments as received (minimal work)
- System auto-generates Venmo links (no manual work)
- **No cash handling** - digital payments only

### Players
- Register to join a pool (via one-time use registration link)
- View all active sessions for their pools
- Propose new session dates/times (alternative suggestions)
- Opt-in to sessions themselves (self-service)
- Update their status (commit, maybe, drop out)
- View their payment history
- Update their own profile (name, phone, venmo, notification preferences)
- Receive automatic Venmo payment links/QR codes when committing
- **Must have Venmo** (no cash payments accepted)

## Visual Workflows

### Player Journey (Opt-In Flow)
```
1. Player receives notification: "New session available!"
   ↓
2. Player opens app, sees session details
   - Date/time
   - Current signups (e.g., "4 of 8 spots filled")
   - Cost per player
   ↓
3. Player clicks "I'm In"
   ↓
4. System automatically:
   - Sets status: "in_unpaid"
   - Creates payment record
   - Sends Venmo payment request
   - Updates session count (now "5 of 8 spots")
   ↓
5. Player pays via Venmo
   ↓
6. Admin marks payment as received (or auto-reconciled)
   ↓
7. Status updates to "in_paid"
   ↓
8. When session reaches minimum, admin books court
   ↓
9. Session confirmed, player receives confirmation
```

### Admin Journey (Minimal Work)
```
1. Admin (or player) proposes session
   - Checks CourtReserve availability
   - Creates session in app
   ↓
2. System automatically:
   - Notifies all pool players
   - Tracks signups in real-time
   ↓
3. Admin monitors dashboard (optional)
   - Sees signup count
   - Sees payment status
   ↓
4. When minimum reached:
   - System notifies: "Ready to book! 6 players committed"
   ↓
5. Admin books court (one action)
   - Enters court booking ID
   - Session status → "confirmed"
   ↓
6. System automatically:
   - Confirms with all players
   - Sends payment reminders to unpaid
   - Generates committed players list
```

### Cancellation & Replacement Flow
```
1. Player needs to drop out
   - Clicks "Drop Out" in app
   ↓
2. System automatically:
   - If paid: Marks payment as "refunded"
   - Removes from session
   - Updates spot count
   ↓
3. If session was full:
   - System promotes first waitlist player
   - Sends notification: "Spot opened up!"
   - New player gets Venmo request
   ↓
4. Admin sees updated list (no action needed)
```

## Core Workflows

### 1. Pool Creation & Management
**Flow:**
1. Admin creates a new pool (e.g., "Weekend Friends", "Couples League")
2. Admin can manually add players OR generate a registration link
3. Players use registration link to join pool
4. Admin can activate/deactivate players

### 2. Session Proposal (Opt-In Model)
**Flow:**
1. **Admin or Player** proposes a session:
   - Select pool
   - Choose date/time
   - System checks CourtReserve availability (if API available, or manual check)
   - If available, session is created with status "proposed"
   - If not available, system suggests alternative nearby times
2. **All active pool players** receive notification about new session
3. **Players opt-in themselves**:
   - View session details
   - Click "I'm In" → Status: "in_unpaid"
   - Click "Maybe" → Status: "maybe" (waitlist if full)
   - System automatically sends Venmo payment request when they commit
4. **Real-time updates**: Players see how many have committed, how many spots left

### 3. Session Confirmation & Booking (Automated)
**Flow:**
1. **System monitors signups** automatically
2. When enough players commit (meet minimum):
   - System notifies admin: "Ready to book! X players committed"
   - Admin books court via CourtReserve (one-click if API available)
   - Admin confirms booking in system
   - Session status changes to "confirmed"
3. **System automatically**:
   - Sends confirmation to all committed players
   - Sends payment reminders to unpaid players
   - Creates group chat list (just committed players) for admin
4. **Waitlist management**: If session is full, "maybe" players go on waitlist

### 4. Payment Tracking (Automated - Digital Only)
**Flow:**
1. **When player opts in**:
   - System calculates cost per player: `cost_per_hour * duration / number_of_committed_players`
   - System automatically creates payment record
   - System generates Venmo payment link/QR code (required - no cash)
   - Player receives Venmo payment request immediately
2. **Payment reconciliation**:
   - Player pays via generated Venmo link
   - Admin verifies payment (or future: auto-reconcile if Venmo API available)
   - System auto-updates status to "in_paid" when payment verified
   - Auto-send reminder if payment not received after 24 hours
3. **Admin fronts money** when booking court ($16/hr total)
4. **Payment dashboard** shows who has/hasn't paid at a glance
5. **Cost calculation**: Updates dynamically as more players commit (cost per player decreases)
6. **No cash handling** - all payments digital (Venmo required)

### 5. Registration Flow (One-Time Use Links + Magic Links)
**Flow:**
1. Admin generates **one-time use registration link** for a pool
   - Link contains unique token
   - Token expires after use (or after 30 days, whichever comes first)
2. New player visits link
3. Player fills form:
   - Email (for magic link auth)
   - Name
   - Phone number
   - Venmo account (required - no cash payments)
   - Notification preferences (Email, SMS, Both)
4. System sends magic link to player's email
5. Player clicks magic link (works on mobile)
6. Player is authenticated and added to pool_players with is_active=true
7. **Registration link is marked as used** (cannot be reused)
8. Player receives confirmation and can immediately see active sessions

**Auth for Returning Players:**
- Players can log in via magic link using their email
- No password needed (passwordless)
- Works seamlessly on mobile

### 6. Cancellation & Replacement Flow (Self-Service)
**Flow:**
1. **Player needs to drop out**:
   - Player clicks "Drop Out" on their session
   - **Cancellation Policy** (protects admin from eating costs):
     - **>24 hours before**: Full refund (time to find replacement)
     - **<24 hours before**: No refund UNLESS replacement found
   - **If paid and >24h before**:
     - System marks payment as "refunded"
     - Admin processes refund via Venmo
     - System tries to fill from waitlist immediately
   - **If paid and <24h before**:
     - System shows warning: "Cancelling within 24 hours means no refund unless you find a replacement"
     - Player can still cancel
     - System tries to fill from waitlist (if replacement found, original player gets refund)
     - **If no replacement found**: No refund (admin keeps payment)
   - **If unpaid**: Simply removes commitment
   - System recalculates cost per player (fewer players = higher cost per person)
   - System notifies admin and waitlist players
2. **Automatic replacement**:
   - If session was full, first "maybe" player is automatically promoted to "in_unpaid"
   - System sends notification: "A spot opened up! You're in if you commit"
   - New player gets Venmo payment request automatically
   - **If replacement found**: Original player gets refund (replacement pays)
   - Cost per player recalculates again
3. **Last-minute cancellations** (<24 hours):
   - System warns player: "No refund unless replacement found (court already booked)"
   - Player can still cancel
   - System aggressively tries to fill from waitlist
   - **If replacement found**: Original player gets refund, replacement pays
   - **If no replacement**: No refund (admin keeps payment, protects admin from eating cost)

## Notification System

### Types of Notifications
1. **New Session Available**: New session proposed in your pool
2. **Session Reminder**: Session coming up (24 hours before)
3. **Payment Request**: Automatic Venmo request when you commit
4. **Payment Reminder**: Committed but unpaid (24 hours after commit, then daily)
5. **Session Confirmed**: Court booked, session is happening
6. **Spot Opened Up**: You're on waitlist and a spot became available
7. **Cancellation**: Session cancelled (12+ hours before)
8. **Payment Received**: Confirmation when payment is verified

### Notification Channels
- **Email**: Primary channel (via Supabase Edge Functions + SendGrid/Resend)
  - From: `noreply@pickleballers.app` (or your domain)
- **SMS**: Optional (via Twilio)
  - **From service number** (Twilio number, NOT your personal number)
  - Players see: "Pickleballers" or your app name, not your phone number
- **In-app**: Notification center in UI

### Notification Triggers
- Session created → Notify all active pool players (email + SMS)
- Player opts in → Auto-send Venmo payment request
- Session reaches minimum → Notify admin "Ready to book"
- Session confirmed → Notify all committed players
- Payment not received (24h) → Reminder to player
- Player drops out → Notify waitlist players if session was full
- Session reminder → Notify confirmed players (24h before)
- Payment verified → Confirmation to player

### Notification Sender (Service Numbers, Not Personal)

**Email**:
- From: `noreply@pickleballers.app` (or your custom domain)
- Professional, not your personal email
- Via SendGrid/Resend (free tier usually sufficient)

**SMS**:
- From: Twilio service number (NOT your personal phone number)
- Players see: "Pickleballers" as sender name
- Cost: ~$0.0075 per SMS (very cheap)
- You configure the Twilio number once
- No one sees your personal number

**In-App**:
- Notification center in the app
- No external service needed Details
- **Email**: From `noreply@pickleballers.app` (or your custom domain)
- **SMS**: From Twilio service number (NOT your personal number)
  - Players see sender as "Pickleballers" or your app name
  - Uses Twilio phone number (you configure)
  - Cost: ~$0.0075 per SMS (very cheap)

## Integration Points

### CourtReserve Integration
**Phase 1 (MVP)**: Manual with smart prompts
- Admin checks availability manually before proposing
- Admin marks court as "available" when creating session
- System prompts admin when session ready to book
- Admin books court manually
- Admin enters court_booking_id, court_number, court_location into system
- System tracks booking status

**Phase 2 (Explore)**: Scraping or API integration
- **Research**: Check if CourtReserve has public API
- **Alternative**: Web scraping (if allowed by ToS) to check availability
- Check availability before proposing (show available slots)
- Automate court booking when session confirmed (if API available)
- Auto-cancel if needed (12+ hours before)
- Real-time availability checking

**Note**: Recurring sessions would be ideal but depends on CourtReserve capabilities

### Payment Integration (Digital Only - No Cash)

**Phase 1 (MVP)**: Venmo Only (Free, No Overhead)
- **Venmo**: System generates Venmo payment links/QR codes when player commits
  - Format: `venmo://paycharge?txn=pay&recipients=[venmo_account]&amount=[amount]&note=[session]`
  - Or generate QR code that opens Venmo app
- **Venmo account required**: Players must have Venmo (no cash option)
- Admin marks payments as received (minimal work)
- Match by venmo_account name for reconciliation
- **Cost**: $0 overhead
- **Admin benefit**: No cash handling, all digital

**Phase 2 (Optional)**: Add Stripe for Automation
- Full API integration
- Automatic reconciliation
- Automatic refunds
- **Cost**: ~$0.50 per transaction (2.9% + $0.30)
- **Decision**: Only add if manual reconciliation becomes too burdensome

**Payment Method**:
- Players must have Venmo (required, no cash)
- System generates Venmo links automatically
- All payments digital (easy for admin)

**Cancellation Refund Policy** (Protects Admin):
- **>24 hours before**: Full refund (time to find replacement)
- **<24 hours before**: No refund UNLESS replacement found
- **Exception**: If replacement found, original player gets refund
- **Admin protection**: If no replacement, admin keeps payment (doesn't eat cost)

## Frontend Structure

```
src/
├── components/
│   ├── pools/
│   │   ├── PoolList.tsx
│   │   ├── PoolCard.tsx
│   │   ├── CreatePool.tsx
│   │   └── PoolDetails.tsx
│   ├── players/
│   │   ├── PlayerList.tsx
│   │   ├── PlayerCard.tsx
│   │   ├── AddPlayer.tsx
│   │   └── PlayerProfile.tsx
│   ├── sessions/
│   │   ├── SessionList.tsx
│   │   ├── SessionCard.tsx
│   │   ├── ProposeSession.tsx
│   │   ├── SessionDetails.tsx
│   │   ├── OptInButton.tsx
│   │   ├── ParticipantList.tsx
│   │   └── Waitlist.tsx
│   ├── payments/
│   │   ├── PaymentList.tsx
│   │   ├── PaymentForm.tsx
│   │   └── PaymentReconciliation.tsx
│   ├── registration/
│   │   └── RegisterForm.tsx
│   └── shared/
│       ├── Layout.tsx
│       ├── Navbar.tsx
│       └── NotificationCenter.tsx
├── pages/
│   ├── Dashboard.tsx
│   ├── Pools.tsx
│   ├── Sessions.tsx
│   ├── Players.tsx
│   ├── Payments.tsx
│   └── Register.tsx (public)
├── hooks/
│   ├── usePools.ts
│   ├── usePlayers.ts
│   ├── useSessions.ts
│   ├── usePayments.ts
│   └── useAuth.ts
├── lib/
│   ├── supabase.ts
│   ├── types.ts
│   └── utils.ts
└── App.tsx
```

## API/Backend Structure

### Supabase Edge Functions
1. **send-notification**: Send email/SMS notifications
2. **reconcile-venmo**: (Future) Auto-reconcile Venmo payments
3. **session-reminders**: Scheduled function to send reminders

### Database Functions (PostgreSQL)
1. **notify_pool_players**: Trigger to notify all active players when session created
2. **update_participant_status**: Update status with timestamp, handle waitlist promotion
3. **check_booking_deadline**: Validate 14-day booking constraint
4. **auto_send_venmo_request**: Trigger to create payment record and send request when player opts in
5. **promote_waitlist**: Auto-promote waitlist player when spot opens
6. **process_refund**: Handle refund when player cancels

### Row Level Security (RLS)
- Admin can access all pools they own
- Players can only see pools they belong to
- Players can only update their own session status
- Public registration endpoint (no auth required)

## Key Features & Constraints

### Booking Constraints
- **14-day advance booking**: System enforces booking_deadline
- **24-hour cancellation policy**: No refunds <24h unless replacement found
- **Court capacity**: Track min/max players per session

### Payment Workflow
- Admin fronts money
- Players pay via Venmo
- System tracks who has paid
- Admin can mark payments manually
- Future: Auto-reconciliation via Venmo API

### Status Management
- Players can opt-in/out freely until session is confirmed
- Once confirmed, players can still drop out
- Cancellation policy: >24h = full refund, <24h = no refund unless replacement found
- System automatically promotes waitlist when spots open
- Payment status separate from participation status

## Security Considerations

1. **Authentication**: Supabase Magic Links (passwordless, simple for users)
2. **Authorization**: RLS policies for data access
3. **Registration Links**: Unique tokens per pool, time-limited
4. **Payment Data**: Store minimal payment info, no sensitive financial data
5. **Phone Numbers**: Encrypt or hash for privacy

## Future Enhancements

1. **CourtReserve API/Scraping**: Automated availability checking and booking
2. **Recurring Sessions**: Weekly/monthly recurring games (if CourtReserve supports)
3. **Alternative Payment Methods**: Stripe/PayPal integration (better API support than Venmo)
4. **Player Ratings**: Track skill levels, matchmaking
5. **Mobile App**: React Native version
6. **Calendar Integration**: iCal/Google Calendar sync
7. **Auto-reconciliation**: If alternative payment method with API is added

## Current Pain Points → Solutions

### Pain Point 1: Manual Group Text Coordination
**Current**: You propose dates via group text, get mixed responses, lots of back-and-forth
**Solution**: 
- Sessions visible to all pool players in app
- Players opt-in themselves (no group text needed)
- Real-time status visible to everyone
- Players can propose alternative dates/times directly in app

### Pain Point 2: Court Availability Unknown
**Current**: Propose dates, get commitments, then find out court isn't available
**Solution**:
- Check CourtReserve availability before proposing (or mark as "checking availability")
- Show available slots when proposing
- Players only commit to confirmed-available slots

### Pain Point 3: Manual Venmo Requests & Chasing
**Current**: Manually send Venmo requests, then chase people down
**Solution**:
- Automatic Venmo request sent when player commits
- System tracks who has/hasn't paid
- Automatic reminders for unpaid players
- Payment dashboard shows status at a glance

### Pain Point 4: Creating New Group Texts
**Current**: Need to create new group text with just committed players
**Solution**:
- System generates list of committed players (copy-paste ready)
- Or exports to group messaging app
- No manual list creation needed

### Pain Point 5: Last-Minute Dropouts & Refunds
**Current**: Scramble to find replacements, manually process refunds
**Solution**:
- Automatic waitlist promotion when someone drops
- Automatic refund processing (marks payment as refunded)
- System notifies waitlist players immediately
- Admin sees replacement status at a glance

### Pain Point 6: Too Much Coordinator Overhead
**Current**: You do all the work - proposing, coordinating, booking, chasing payments
**Solution**:
- **Players opt-in themselves** (main work shift)
- **Players can propose sessions** (alternative dates/times)
- **Automatic payment requests** (no manual sending)
- **Automatic waitlist management** (no manual replacement finding)
- **System prompts you** when action needed (e.g., "Ready to book!")

## Key Design Decisions (Based on Requirements)

1. **Opt-In Model**: Players see sessions and commit themselves - no manual coordination
2. **Player Proposals**: Players can suggest alternative dates/times (reduces back-and-forth)
3. **Automatic Payment Requests**: Venmo requests sent immediately when player commits
4. **Waitlist System**: Automatic promotion when spots open (no admin work)
5. **Cancellation Policy**: >24h = full refund, <24h = no refund unless replacement found (admin protection)
6. **Court Availability**: Check before proposing (reduces "slot not available" frustration)
7. **Pool Size**: 20+ people, but only 4-8 needed per session (opt-in handles this)

## Implementation Notes

### Payment Method Analysis

**Option 1: Venmo (Recommended for MVP)**
- ✅ Free (no fees)
- ✅ Everyone already has it
- ✅ Instant transfers
- ❌ No API (manual reconciliation)
- ❌ Some people don't have it
- **Cost**: $0 overhead

**Option 2: Stripe**
- ✅ Professional, has full API
- ✅ Automatic reconciliation
- ✅ Supports cards, ACH, Apple Pay
- ✅ Can handle refunds automatically
- ❌ Fees: 2.9% + $0.30 per transaction
- ❌ Players need to enter card info
- **Cost**: ~$0.50 per $16 payment = $4-8 overhead per session

**Option 3: Zelle**
- ✅ Free (no fees)
- ✅ Bank-to-bank, instant
- ✅ Most banks support it
- ❌ No API (manual reconciliation)
- ❌ Requires bank account setup
- **Cost**: $0 overhead

**Recommendation**: 
- **MVP**: Venmo only (free, no overhead, no cash handling)
- **Future**: Consider Stripe if you want automation, but adds ~$4-8 cost per session
- **Alternative**: Zelle as additional option (free, but still no API)

**Decision**: Venmo only - digital payments, no cash. Add Stripe later only if the manual reconciliation becomes too burdensome.

### Cost Calculation
- Fixed: $16/hr per court (set by CourtReserve)
- Cost per player = `(cost_per_hour * duration) / number_of_committed_players`
- Updates dynamically as players commit/drop
- Example: 4 players = $4 each, 8 players = $2 each

### CourtReserve Integration Strategy
1. **Research**: Check CourtReserve website for API documentation
2. **Scraping**: If no API, explore web scraping (check ToS first)
3. **Manual Fallback**: Always support manual entry
4. **Recurring Sessions**: Research if CourtReserve supports recurring bookings

### Registration Links
- One-time use tokens
- Expire after use OR after 30 days
- Admin can generate multiple links for same pool
- Track who used which link (for analytics)

