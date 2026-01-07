# Database Migrations Guide

## Supabase Migration Options

### Option 1: Supabase CLI Migrations (Recommended for Production) ⭐
**Best for:** Version control, team collaboration, production deployments

**Setup:**
```bash
# Initialize Supabase project (if not already done)
supabase init

# Link to your remote project
supabase link --project-ref your-project-ref

# Create a new migration
supabase migration new fix_players_rls

# Apply migrations to remote
supabase db push
```

**Pros:**
- ✅ Version controlled
- ✅ Can rollback
- ✅ Tracks applied migrations automatically
- ✅ Works with CI/CD
- ✅ Can diff local vs remote

**Cons:**
- ❌ Requires CLI setup and linking
- ❌ Need project ref

---

### Option 2: Manual SQL in Supabase Dashboard (Current Approach)
**Best for:** Quick fixes, MVP, one-off changes

**How it works:**
- Migration files stored in `supabase/migrations/` for version control
- Copy SQL to Supabase SQL Editor
- Run directly
- Manually track what's been applied

**Pros:**
- ✅ Simple, no setup
- ✅ Immediate
- ✅ Version controlled (files in git)
- ✅ Easy to see history

**Cons:**
- ❌ Manual application
- ❌ Need to manually track what's applied
- ❌ Can't easily rollback

---

## Current Setup (Supabase CLI) ⭐

Supabase CLI is initialized and ready to use:

```
supabase/
  migrations/
    20260105000000_initial_schema.sql  ← Initial schema (source of truth)
  schema.sql                            ← Full schema snapshot (reference only)
  sample_data.sql                       ← Sample data
```

**Migration naming:** `YYYYMMDDHHMMSS_description.sql`

---

## schema.sql vs Migrations

### Migrations (`migrations/*.sql`) - Source of Truth ⭐
- **Purpose:** Incremental changes that build up your database over time
- **Used by:** Supabase CLI tracks which migrations have been applied
- **When to use:** For all database changes (new tables, columns, policies, etc.)
- **History:** Shows the evolution of your schema

### schema.sql - Reference Document
- **Purpose:** Complete, current snapshot of your entire database schema
- **Used for:**
  - Quick reference (see everything at once)
  - Documentation
  - Initial setup in brand new projects (optional)
  - Understanding the full structure
- **When to update:** After applying migrations that change structure
- **Not used by:** Supabase CLI (migrations are the source of truth)

### Best Practice Workflow

1. **Make a change:** Create a migration file
   ```bash
   npm run db:migration add_new_feature
   ```

2. **Apply migration:** Push to database
   ```bash
   npm run db:push
   ```

3. **Update schema.sql:** Keep it in sync (for reference)
   - Manually update `schema.sql` to reflect the change
   - This is documentation, not required for functionality

### When to Use Each

**Use Migrations For:**
- ✅ All production changes
- ✅ Version control of changes
- ✅ Team collaboration
- ✅ CI/CD deployments

**Use schema.sql For:**
- ✅ Quick reference of full schema
- ✅ Onboarding new team members
- ✅ Documentation
- ✅ Initial project setup (one-time, optional)

### Important Notes

- **Supabase CLI only tracks migrations**, not `schema.sql`
- **Migrations are the source of truth** - the database state is the sum of all applied migrations
- **schema.sql should match migrations** - but if they diverge, migrations win
- **For new projects:** You can either:
  - Start with `schema.sql` (run once), then use migrations going forward
  - Or create an initial migration with the full schema, then use incremental migrations

---

## How to Create a Migration

1. **Create migration file:**
   ```bash
   # Generate timestamp
   date +%Y%m%d%H%M%S
   # Creates file: supabase/migrations/20260106191727_your_description.sql
   ```

2. **Write the SQL:**
   ```sql
   -- Migration: Fix players RLS policy
   -- Date: 2026-01-06
   
   drop policy if exists "old_policy" on table_name;
   create policy "new_policy" on table_name...
   ```

3. **Apply to database:**
   - Copy SQL to Supabase SQL Editor
   - Run it
   - Document that it's been applied

4. **Update schema.sql:**
   - If it's a structural change, update `schema.sql` to reflect it

---

## Migration Checklist

When creating/applying a migration:
- [ ] Create migration file with timestamp
- [ ] Test in dev/staging first (if available)
- [ ] Document what it does in the file
- [ ] Check for breaking changes
- [ ] Apply to production via SQL Editor
- [ ] Update `schema.sql` if structural change
- [ ] Verify it worked
- [ ] Commit migration file to git

---

## Current Migrations

- `20260105000000_initial_schema.sql` - **Initial schema setup** - Complete database schema with all tables, types, functions, triggers, indexes, and RLS policies (with fixes already applied)

## Quick Reference

**Create new migration:**
```bash
npm run db:migration your_description
# or
supabase migration new your_description
```

**Apply migrations:**
```bash
npm run db:push
# or
supabase db push
```

**Check what's different:**
```bash
npm run db:diff
# or
supabase db diff
```

---

## Using Supabase CLI (Current Setup)

**Create a new migration:**
```bash
supabase migration new description_of_change
# Creates: supabase/migrations/TIMESTAMP_description_of_change.sql
```

**Apply migrations to remote:**
```bash
supabase db push
# Applies all pending migrations to your linked project
```

**Check migration status:**
```bash
supabase migration list
# Shows which migrations have been applied
```

**Other useful commands:**
```bash
supabase db diff              # See differences between local and remote
supabase db reset            # Reset local database (if using local dev)
supabase db remote commit    # Mark migrations as applied (if applied manually)
```

---

## Best Practices

1. **Always test first** - Try in dev/staging before production
2. **One change per migration** - Easier to debug and rollback
3. **Use transactions** - Wrap in BEGIN/COMMIT when possible
4. **Document breaking changes** - Note in migration file
5. **Keep schema.sql updated** - It's the source of truth
6. **Version control everything** - All migrations in git
