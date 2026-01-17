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
- Dynamic cost calculation
- Payment tracking (Venmo links with hashtags)
- Venmo auto-reconciliation (email parsing)
- Notifications (email via Resend, SMS via Twilio)
- PWA support (installable, offline-capable)
- **123 automated tests**

### 📋 Planned
- Delete/unlock sessions
- CourtReserve integration
- Granular notification settings

## Testing

```bash
npm test                    # Run all 123 tests
npm run test:notifications  # Run notification tests
npm run test:payments       # Run payment tests
npm run test:venmo-parser   # Run Venmo parser tests
```

## Cost Model

Per court: $57 ($9 admin + $48 guest pool split among guests)

| Players | Courts | Per Guest |
|---------|--------|-----------|
| 4       | 1      | $16.00    |
| 5       | 1      | $12.00    |
| 6       | 1      | $9.60     |
| 7       | 1      | $8.00     |
| 8       | 2      | $13.71    |

## License

Private project
