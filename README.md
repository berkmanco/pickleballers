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
- Automatic Venmo payment requests when players commit
- Automatic waitlist management when spots open
- System tracks payments and sends reminders
- Admin just books courts when ready

## Tech Stack

- **Frontend**: React + TypeScript + Vite (mobile-first)
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **ORM**: Drizzle ORM (for type-safe database queries)
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

### Payment Model
- **Venmo only** (no cash, no Stripe initially)
- Automatic payment link generation
- Payment tracking dashboard
- Manual reconciliation (Venmo has no API)

### Cancellation Policy
- **>24 hours before**: Full refund
- **<24 hours before**: No refund unless replacement found
- Protects admin from eating costs on last-minute cancellations

## Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Detailed technical architecture, database schema, workflows
- **[SIMPLIFICATIONS.md](./SIMPLIFICATIONS.md)** - MVP simplification recommendations
- **[CONSIDERATIONS.md](./CONSIDERATIONS.md)** - Mobile-first, notifications, AI, auth decisions

## Key Decisions

### Payment
- **Venmo only** (no cash, no Stripe initially)
- Zero cost overhead
- Automatic payment link generation
- Manual reconciliation (Venmo has no API)
- Consider Stripe later if doing 10+ sessions/month

### Cancellation Policy
- **>24 hours before**: Full refund
- **<24 hours before**: No refund unless replacement found
- Protects admin from eating costs on last-minute cancellations

### Notifications
- **SMS**: From Twilio service number (not your personal number)
- **Email**: From `noreply@pickleballers.app`
- Players see service names, not personal contact info

### Other
- **Court Booking**: Manual (only admin has CourtReserve membership)
- **Cost**: $16/hr fixed, split among committed players
- **Multi-admin**: Start with single admin per pool (can add later)

## Project Status

🚧 **Planning Phase** - Architecture and decisions documented, ready to start implementation.

## License

Private project

