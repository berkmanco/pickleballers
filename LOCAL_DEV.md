# Local Development Setup

This guide helps you set up a local Supabase environment for development and testing.

## Prerequisites

1. **Docker Desktop** - Required for local Supabase
   - Install from: https://www.docker.com/products/docker-desktop
   - Make sure Docker is running before starting Supabase

2. **Supabase CLI** - Already installed ✅

## Setup Steps

### 1. Start Local Supabase

```bash
# Start Docker Desktop first, then:
supabase start

# This will:
# - Start all Supabase services locally
# - Run all migrations
# - Run seed.sql (if present)
# - Print connection details
```

**Expected output:**
```
Started supabase local development setup.

         API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
    Inbucket URL: http://127.0.0.1:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Create Local Environment File

Create `.env.local` with the local Supabase credentials:

```bash
# Copy from supabase start output
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon-key-from-output>
```

### 3. Start Development Server

```bash
npm run dev
```

The app will now use your local Supabase instance!

## Switching Between Local and Remote

**Use local Supabase:**
- Have `.env.local` with local credentials
- Run `supabase start` (Docker must be running)

**Use remote Supabase:**
- Have `.env` with remote credentials
- Remove or rename `.env.local`

**Priority:** Vite loads `.env.local` over `.env`, so:
- `.env.local` = local dev
- `.env` = remote/production

## Useful Commands

```bash
# Start local Supabase
npm run supabase:start
# or: supabase start

# Stop local Supabase
npm run supabase:stop
# or: supabase stop

# Apply new migrations (preserves data - recommended for testing)
npm run db:migrate
# or: supabase migration up --local

# Reset local database (migrations + seeds - wipes all data)
npm run supabase:reset
# or: supabase db reset

# Create new migration
npm run db:migration <migration-name>
# or: supabase migration new <migration-name>

# View local database in Studio
# Open: http://127.0.0.1:54323

# View local emails (for testing auth)
# Open: http://127.0.0.1:54324
```

## Local Supabase Features

- **Full Supabase stack** running locally
- **PostgreSQL database** on port 54322
- **Auth service** - test magic links locally
- **Storage** - file uploads work locally
- **Studio UI** - database management at http://127.0.0.1:54323
- **Email testing** - view auth emails at http://127.0.0.1:54324

## Authentication & Magic Links (Local)

**How it works:**
1. Magic links work exactly the same as production
2. **No emails are actually sent** - they're captured by Mailpit
3. View magic links in Mailpit UI: http://127.0.0.1:54324

**Testing Magic Links:**

1. **Start your dev server** (if not already running):
   ```bash
   npm run dev
   # Vite runs on http://localhost:5173 by default
   ```

2. **Enter your email** in the login form (any email works, even fake ones)
3. **Click "Send Magic Link"**
4. **Open Mailpit:** http://127.0.0.1:54324
5. **Find your email** in the inbox
6. **Click the magic link** in the email
7. **You're signed in!** (redirects to `/dashboard`)

**Note:** Make sure your dev server is running on the same port configured in `supabase/config.toml` (default: 5173)

**Important Notes:**
- ✅ Any email address works (doesn't need to be real)
- ✅ Magic links work immediately (no email delivery delay)
- ✅ Links are clickable in Mailpit
- ✅ Auth state persists until you sign out or reset the database
- ⚠️ Mailpit inbox clears when you restart Supabase (unless you configure persistence)

**Mailpit Features:**
- View all emails sent by your app
- Click magic links directly
- See email content (HTML/text)
- Search emails
- No spam folder - all emails appear immediately

## Troubleshooting

**Docker not running:**
```bash
# Start Docker Desktop, then:
supabase start
```

**Port conflicts:**
- Check if ports 54321-54324 are in use
- Change ports in `supabase/config.toml` if needed

**Reset everything:**
```bash
supabase stop
supabase start
```

## Notes

- Local Supabase is completely isolated from your remote project
- Data persists between `supabase stop` / `supabase start`
- **Default workflow:** Use `npm run db:migrate` to apply new migrations (preserves data)
- **Full reset:** Use `npm run supabase:reset` to wipe and reseed (only when needed)
- Migrations run automatically on `supabase start` (first time only)

