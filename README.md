# DinkUp 🏓

A self-service web app for coordinating pickleball sessions with your crew.

## The Problem

Coordinating pickleball games involves too much manual work:
- Group text back-and-forth to find who's in
- Manual Venmo requests and payment chasing
- Scrambling for replacements when someone drops

## The Solution

**Opt-in model**: Players see sessions and commit themselves. No manual coordination needed.

- 📅 Admin proposes sessions
- ✋ Players opt themselves in
- 💰 Automatic payment requests at 24h before
- 🔄 Automatic waitlist promotion

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth)
- **Auth**: Magic Links (passwordless)
- **Payments**: Venmo links (manual reconciliation)

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
```

## Documentation

- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Technical architecture, database schema, workflows
- **[LOCAL_DEV.md](./LOCAL_DEV.md)** - Local development setup
- **[FEATURE_STATUS.md](./FEATURE_STATUS.md)** - Current feature status

## Features

### ✅ Completed
- Pool management (create, view, manage)
- Player registration (one-time links, magic link auth)
- Session proposals (create, view sessions)
- Player opt-in system (commit, maybe, drop out)
- Cost calculation (dynamic based on player count)
- Privacy controls (sensitive info hidden from non-admins)

### 🚧 In Progress
- Payment tracking

### 📋 Planned
- Notifications (email/SMS)
- Waitlist auto-promotion
- Court booking integration

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
