# Pickleballers

A self-service web application to coordinate pickleball games among friends and family. The goal is to shift coordination overhead from the admin to individual players through an opt-in model.

## Problem Statement

Currently, coordinating pickleball games involves:
- Manual group text coordination with lots of back-and-forth
- Unknown court availability until after commitments
- Manual Venmo requests and payment chasing
- Creating new group texts for each session
- Scrambling for replacements when people drop out
- Too much coordinator overhead

## Solution

**Opt-in, self-service model** where:
- Players see available sessions and commit themselves
- Admin books courts early to secure slots
- Payment requests sent 24h before session (after numbers settle)
- Automatic waitlist management when spots open
- System tracks payments and sends reminders

## Tech Stack

- **Frontend**: React + TypeScript + Vite (mobile-first)
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Database**: Supabase JS Client (direct queries, no ORM)
- **Styling**: Tailwind CSS (mobile-first responsive)
- **Auth**: Supabase Magic Links (passwordless)
- **Email**: Resend
- **SMS**: Twilio
- **Deployment**: Vercel
- **Linting**: ESLint

## Key Features

### Core Functionality
- **Pools**: Multiple groups (friends, couples, family)
- **Players**: Self-registration via one-time links
- **Sessions**: Proposed date/times for games
- **Opt-in**: Players commit themselves (no manual coordination)
- **Payments**: Automatic Venmo links, payment tracking
- **Waitlist**: Automatic promotion when spots open
- **Cancellations**: Policy protects admin from eating costs

### Cost Model
- **Per court**: $57 ($9 admin + $48 guest pool split among guests)
- **Payment timing**: Venmo requests sent 24h before session
- More guests = lower cost per guest

### Timeline
- **Book early**: Secure court when minimum players commit
- **24h before**: Roster locks, payment requests sent
- **12h before**: Last chance to cancel court if below minimum

## Documentation

- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Detailed technical architecture, database schema, workflows
- **[docs/SIMPLIFICATIONS.md](./docs/SIMPLIFICATIONS.md)** - MVP simplification recommendations
- **[docs/CONSIDERATIONS.md](./docs/CONSIDERATIONS.md)** - Mobile-first, notifications, AI, auth decisions
- **[docs/REAL_WORLD_EXAMPLES.md](./docs/REAL_WORLD_EXAMPLES.md)** - Real-world coordination patterns
- **[docs/DATA_MODEL_PRESSURE_TEST.md](./docs/DATA_MODEL_PRESSURE_TEST.md)** - Data model testing

## Key Decisions

### Payment & Cost Model
- **Venmo only** (no cash, no Stripe initially)
- **Per court**: $57 total ($9 admin + $48 guest pool)
- **Guest cost**: $48 per court ÷ number of guests
- Payment requests sent **24h before session** (after numbers settle)
- Manual reconciliation (Venmo has no API)

### Cancellation Policy
- **Before payment deadline (24h before)**: Can drop freely, no payment owed
- **After payment deadline**: Owe your share unless replacement found
- **12h before**: Last chance to cancel court on CourtReserve if below minimum

### Notifications
- **SMS**: From Twilio service number (not your personal number)
- **Email**: From `noreply@pickleballers.app`
- Players see service names, not personal contact info

### Other
- **Court Booking**: Book early to secure slot, admin fronts $57/court
- **Court allocation**: 4-7 players = 1 court, 8-11 players = 2 courts
- **Multi-admin**: Start with single admin per pool (can add later)

## Project Status

🚧 **Planning Phase** - Architecture and decisions documented, ready to start implementation.

## License

Private project

