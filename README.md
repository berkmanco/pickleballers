# DinkUp 🏓

A self-service web app for coordinating pickleball sessions with your crew.

**Live**: [dinkup.link](https://www.dinkup.link)

## The Problem

Coordinating pickleball games involves too much manual work:
- Group text back-and-forth to find who's in
- Manual Venmo requests and payment chasing
- Scrambling for replacements when someone drops

## The Solution

**Opt-in model**: Players see sessions and commit themselves. No manual coordination needed.

- 📅 Admin proposes sessions
- ✋ Players opt themselves in
- 💰 Automatic payment requests when roster locks
- 🔄 Automatic waitlist promotion
- 🤖 Venmo auto-reconciliation via email parsing

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) |
| Auth | Magic Links (passwordless) |
| Email | Resend |
| SMS | Twilio |
| Payments | Venmo (with auto-reconciliation) |
| Hosting | Vercel |
| PWA | vite-plugin-pwa |

## Quick Start

```bash
# Install dependencies
npm install

# Start local Supabase (requires Docker)
supabase start

# Create .env.local with local credentials (from supabase start output)
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon-key>

# Start dev server
npm run dev

# Run tests
npm test
```

## Documentation

- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Technical architecture, database schema
- **[docs/SMOKE_TEST.md](./docs/SMOKE_TEST.md)** - Testing checklist
- **[docs/VENMO_INTEGRATION.md](./docs/VENMO_INTEGRATION.md)** - Venmo auto-matching setup
- **[LOCAL_DEV.md](./LOCAL_DEV.md)** - Local development setup
- **[FEATURE_STATUS.md](./FEATURE_STATUS.md)** - Current feature status

## Features

### ✅ Completed
- Pool management (create, invite players, manage)
- Player registration (one-time links, magic link auth)
- Session proposals (create, view, opt-in)
- Duration-based cost calculation (CourtReserve pricing)
- Payment tracking (Venmo links with hashtags)
- Venmo auto-reconciliation (email parsing)
- Notifications (email via Resend, SMS via Twilio)
- PWA support (installable, offline-capable)
- **160 automated tests** (including 17 pricing tests)

### 📋 Planned
- Delete/unlock sessions
- CourtReserve integration
- Granular notification settings

## Testing

```bash
npm test                    # Run all tests
npm run test:pricing        # Run pricing calculation tests
npm run test:notifications  # Run notification tests
npm run test:payments       # Run payment tests
npm run test:venmo-parser   # Run Venmo parser tests
```

## Payment Model

**Pool-Splitting Model**: Total cost per court is based on duration and split among guests.

### How It Works

Pricing is **automatically calculated** based on session duration (CourtReserve doubles rates):

| Duration | Admin Pays | Guest Pool (3 spots) | Total Per Court |
|----------|------------|---------------------|-----------------|
| 30 min   | $4.50      | $24                 | $28.50          |
| 60 min   | $9.00      | $48                 | $57.00          |
| 90 min   | $13.50     | $72                 | $85.50          |
| 120 min  | $18.00     | $96                 | $114.00         |

**Each guest pays** = `guest_pool` × `courts_needed` ÷ `number_of_guests`

### Key Insight: Fixed Court Spots with Rotation

You pay for **spots on the court** (4), not total attendees. If 6 people show up but you only paid for 4 spots, the extra 2 just rotate in/out.

**Example: 90-minute session (1 court)**
- Total paid to venue: $85.50
- Admin pays: $13.50
- Guest pool: $72.00

| Guests | Each Pays | Total Collected | Notes |
|--------|-----------|-----------------|-------|
| 3      | $24.00    | $85.50         | Exactly fills 4 spots |
| 4      | $18.00    | $85.50         | 5th person rotates |
| 5      | $14.40    | $85.50         | 6th person rotates |

More guests = better deal per person (same court cost, more people splitting it).

## License

Private project
