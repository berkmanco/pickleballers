# DinkUp - Architecture

## Overview

A self-service web app for coordinating pickleball games. Players opt themselves into sessions, eliminating manual coordination overhead for the admin.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React + TypeScript + Vite |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) |
| Database | Supabase JS Client (no ORM) |
| Styling | Tailwind CSS (mobile-first) |
| Auth | Supabase Magic Links |
| Email | Resend |
| SMS | Twilio |
| Deployment | Vercel |

## Core Concepts

### Pools
Groups of players (e.g., "Weekend Friends", "Couples"). Each pool has one admin (owner).

### Players  
Belong to one or more pools. Required: name, email, Venmo account.

### Sessions
Proposed game date/times. Players opt themselves in.

### Cost Model

Each court booking requires 4 players on CourtReserve:
- **Admin (member)**: $9 per court
- **3 guest spots**: $16 × 3 = $48 per court
- **Total per court**: $57

Guest cost is split among ALL guests:

| Players | Courts | Admin Pays | Guest Pool | # Guests | Per Guest |
|---------|--------|------------|------------|----------|-----------|
| 4       | 1      | $9         | $48        | 3        | $16.00    |
| 5       | 1      | $9         | $48        | 4        | $12.00    |
| 6       | 1      | $9         | $48        | 5        | $9.60     |
| 7       | 1      | $9         | $48        | 6        | $8.00     |
| 8       | 2      | $18        | $96        | 7        | $13.71    |
| 9       | 2      | $18        | $96        | 8        | $12.00    |
| 10      | 2      | $18        | $96        | 9        | $10.67    |
| 11      | 2      | $18        | $96        | 10       | $9.60     |

**Court allocation**: 4-7 players = 1 court, 8-11 players = 2 courts

## Key Workflows

### Session Lifecycle

```
PROPOSED → CONFIRMED → COMPLETED
    ↓          ↓
 CANCELLED  CANCELLED
```

1. **Admin proposes session** (date, time, pool)
2. **Players opt-in** ("I'm In" or "Maybe")
3. **Admin books court** when minimum reached
4. **24h before**: Roster locks, payment requests sent
5. **Session happens**

### Payment Timeline

```
Session Proposed
     ↓
Players opt in/out freely (no money yet)
     ↓
Court Booked (admin fronts $57/court)
     ↓
24h Before: Roster LOCKS
     ↓
Payment requests sent (Venmo)
     ↓
Session time
```

### Cancellation Policy

- **Before payment deadline (24h)**: Drop out freely, no payment owed
- **After payment deadline**: Owe your share unless replacement found
- **If session cancelled**: No payments owed

## Database Schema

### Tables

```sql
pools (id, name, description, owner_id, slug, is_active)
players (id, name, email, phone, venmo_account, user_id, notification_preferences)
pool_players (pool_id, player_id, is_active, joined_at)
registration_links (pool_id, token, used_at, expires_at)
sessions (id, pool_id, proposed_date, start_time, duration_minutes, 
          min_players, max_players, status, courts_needed,
          admin_cost_per_court, guest_pool_per_court, roster_locked)
session_participants (session_id, player_id, is_admin, status, opted_in_at)
payments (session_participant_id, amount, status, venmo_payment_link)
```

### Key Enums

```sql
session_status: proposed, confirmed, cancelled, completed
participant_status: committed, maybe, dropped
payment_status: pending, paid, refunded, forgiven
```

### RLS Patterns

- Use `SECURITY DEFINER` functions for complex checks (avoids recursion)
- Pool owners see everything in their pools
- Pool members see other members in shared pools
- Players can only update their own records

## User Roles

### Admin (Pool Owner)
- Create/manage pools
- Propose sessions
- Book courts (fronts $57/court)
- Always plays in sessions they create
- View payment dashboard
- Mark payments as received/forgiven

### Players
- Register via one-time links
- View sessions in their pools
- Opt in/out of sessions
- Pay via Venmo when requested

## Technical Decisions

### Why Magic Links?
- No password to remember
- Works great on mobile
- Built into Supabase

### Why Venmo Only?
- Free (no transaction fees)
- Everyone already has it
- Digital-only (no cash handling)

### Why No ORM?
- Supabase client is simple and powerful
- Direct SQL for complex queries
- Less abstraction = easier debugging

### Auth Callback Pattern
Don't use `async/await` in `onAuthStateChange` - it blocks the Supabase client. Use `.then()/.catch()` instead.

## Project Structure

```
src/
├── components/     # Reusable UI components
├── contexts/       # React contexts (Auth)
├── lib/           # Database functions, utilities
│   ├── supabase.ts
│   ├── pools.ts
│   ├── sessions.ts
│   ├── payments.ts
│   ├── notifications.ts
│   └── utils.ts
├── pages/         # Route pages
└── App.tsx

supabase/
├── config.toml    # Local Supabase config
├── migrations/    # Database migrations
├── functions/     # Edge Functions
│   ├── notify/    # Email/SMS notifications
│   └── parse-venmo/ # Venmo email parsing
└── seed.sql       # Local dev seed data

tests/
├── setup.ts       # Test utilities & helpers
├── notifications.test.ts
├── pools.test.ts
├── sessions.test.ts
├── registration.test.ts
├── payments.test.ts
└── venmo-parser.test.ts

docs/
├── ARCHITECTURE.md
├── SMOKE_TEST.md
├── VENMO_INTEGRATION.md
└── CLOUDFLARE_SETUP.md
```

## Testing

**123 automated tests** covering core functionality:

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

| Test Suite | Tests | Coverage |
|------------|-------|----------|
| `notifications.test.ts` | 10 | All notification types |
| `pools.test.ts` | 12 | Pool CRUD, players, links |
| `sessions.test.ts` | 15 | Session lifecycle |
| `registration.test.ts` | 14 | Full registration flow |
| `payments.test.ts` | 16 | Payment CRUD, Venmo links |
| `venmo-parser.test.ts` | 57 | Email parsing, auto-match |

See `docs/SMOKE_TEST.md` for manual testing checklist.

## Local Development

See [LOCAL_DEV.md](../LOCAL_DEV.md) for setup instructions.

**Quick reference:**
- Dashboard: http://127.0.0.1:54323
- Email inbox: http://127.0.0.1:54324
- API: http://127.0.0.1:54321

## Future Enhancements

- CourtReserve API integration (automated booking)
- Recurring sessions
- Player skill ratings
- Native mobile app
