# Feature Status: Player Opt-In System

## Current Feature: Player Opt-In System ✅ Complete

### What We Built

**Goal:** Allow players to opt themselves into sessions, eliminating manual coordination overhead.

**Completed:**
1. ✅ **Database Functions** (`src/lib/sessionParticipants.ts`)
   - `getSessionParticipants()` - Get all participants for a session
   - `getCurrentPlayerStatus()` - Get current player's status
   - `optInToSession()` - Opt in as "committed" or "maybe" (waitlist)
   - `optOutOfSession()` - Drop out of a session
   - `getCurrentPlayerId()` - Helper to get player ID from user ID

2. ✅ **RLS Policies** (multiple migrations)
   - Players can insert their own participation records
   - Pool members can view other players in their pools
   - Pool owners AND members can view session participants
   - Player linking uses SECURITY DEFINER to bypass RLS chicken-and-egg problem

3. ✅ **SessionDetails Page Updates** (`src/pages/SessionDetails.tsx`)
   - Shows participant count and list
   - Shows current player's status
   - "I'm In" and "Maybe" buttons
   - "Drop Out" button if already opted in
   - Waitlist logic: if session is full, "I'm In" goes to waitlist
   - Dynamic cost calculation using `get_session_cost_summary` function
   - Shows cost per guest, total players, courts needed
   - Warning if below minimum players

4. ✅ **Cost Calculation** (`src/lib/sessions.ts`)
   - `getSessionCostSummary()` - Calls database RPC to calculate costs
   - Returns: total players, guest count, courts needed, cost per guest

5. ✅ **Player-User Linking** (`src/lib/pools.ts`, `src/contexts/AuthContext.tsx`)
   - Automatically links player records to user accounts after sign-in
   - Uses `link_player_to_user` RPC (SECURITY DEFINER) to bypass RLS
   - Allows users to see pools they're members of

6. ✅ **Auto-Registration Features**
   - Pool owners automatically added as player/member when creating pool
   - Pool owners (admin) automatically added as first participant when creating session
   - Registration sends magic link for login

7. ✅ **Privacy Controls**
   - Non-admins can only see player names in pool list
   - Sensitive info (email, phone, Venmo) only visible to pool owners

### Bug Fixes (This Session)

1. **Auth blocking bug** - `async/await` in `onAuthStateChange` was blocking supabase queries
   - Fix: Use `.then()/.catch()` instead of await for non-blocking player linking

2. **Infinite loop** - `useEffect` dependencies `[user]` caused re-renders
   - Fix: Use `[user?.id]` as stable dependency

3. **RLS fixes** - Multiple policies updated:
   - Pool owners can view session participants
   - Pool members can see each other's player records
   - Used SECURITY DEFINER functions to avoid infinite recursion

### Testing Flow

1. **As Pool Owner:**
   - Create a pool (auto-added as player/member)
   - Generate registration link
   - Create a session (auto-added as admin participant)

2. **As Player:**
   - Use registration link to register (creates player record)
   - Check email for magic link, click to sign in
   - Auto-linked to player record on sign-in
   - Navigate to session details
   - Click "I'm In" or "Maybe"
   - Verify participant count and cost update

### Next Steps

1. **Payment Tracking** (Next Feature)
   - Auto-create payment records when players commit
   - Generate Venmo links
   - Payment dashboard for admins
   - Mark payments as received

2. **Consolidate Migrations** (Before Production)
   - Squash migrations into logical groups
   - Test fresh db reset

### Technical Notes

- **RLS Pattern:** Use SECURITY DEFINER functions for complex checks to avoid infinite recursion
- **Player Linking:** Uses RPC `link_player_to_user` to bypass RLS on first sign-in
- **Cost Calculation:** Uses PostgreSQL function `get_session_cost_summary` based on committed players
- **Auth Handler:** Don't use async/await in `onAuthStateChange` - it blocks the supabase client

### New Migrations (This Session)

- `20260108000001_add_link_player_function.sql` - SECURITY DEFINER function for player linking
- `20260108000002_add_pool_member_view_policy.sql` - Pool members can view their pools
- `20260108000003_fix_session_participants_rls.sql` - Owners can view participants
- `20260108000004_auto_add_owner_to_pool.sql` - Auto-add owner as player on pool creation
- `20260108000005_auto_add_admin_to_session.sql` - Auto-add admin to session on creation
- `20260108000006_fix_players_rls_for_pool_members.sql` - Members can see each other

### Files Changed (This Session)

**Modified:**
- `src/contexts/AuthContext.tsx` - Non-blocking player linking, HMR fix
- `src/lib/pools.ts` - Use RPC for linking, cleanup
- `src/pages/Pools.tsx` - Stable useEffect dependency
- `src/pages/Dashboard.tsx` - Stable useEffect dependency  
- `src/pages/PoolDetails.tsx` - Hide sensitive info from non-admins
- `src/pages/Register.tsx` - Auto-send magic link after registration
