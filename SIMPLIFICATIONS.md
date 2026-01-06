# Simplifications to Consider

## Potential Simplifications for MVP

### 1. **Multi-Admin Support** → Start Single Admin
**Current**: Multiple admins per pool
**Simplification**: Start with single admin (you) per pool
**Rationale**: 
- You're the only one with CourtReserve membership anyway
- Can add multi-admin later if needed
- Reduces complexity in RLS policies and UI

**Impact**: Remove `pool_admins` table initially, add `owner_id` directly to `pools`

---

### 2. **Player Proposals** → Admin Only Initially
**Current**: Players can propose sessions
**Simplification**: Only admins can propose sessions initially
**Rationale**:
- Reduces complexity in UI (no "propose session" button for players)
- You control when sessions are created
- Can add player proposals later if needed

**Impact**: Remove `created_by` from sessions (always admin), simpler permissions

---

### 3. **Notification Preferences** → Simplify to On/Off
**Current**: Players choose Email, SMS, or Both
**Simplification**: Just "notifications enabled/disabled" initially
**Rationale**:
- Most people want both anyway
- Can add granular preferences later
- Simpler UI and logic

**Impact**: Change `notification_preferences` from JSONB to boolean

---

### 4. **Waitlist Position** → Use Timestamp Order
**Current**: Explicit `waitlist_position` integer field
**Simplification**: Use `opted_in_at` timestamp to determine order
**Rationale**:
- Simpler database schema
- Natural ordering (first come, first served)
- No need to recalculate positions when someone drops

**Impact**: Remove `waitlist_position` field, use `opted_in_at` for ordering

---

### 5. **Session Status** → Simplify States
**Current**: "proposed", "gathering_interest", "confirmed", "cancelled", "completed"
**Simplification**: "proposed", "confirmed", "cancelled", "completed"
**Rationale**:
- "gathering_interest" is just "proposed" with signups
- Can determine state from participant count
- Fewer states = simpler logic

**Impact**: Remove "gathering_interest" status

---

### 6. **Recurring Sessions** → Future Feature
**Current**: Schema includes recurring fields
**Simplification**: Remove from MVP, add later
**Rationale**:
- Not sure if CourtReserve supports it
- Adds significant complexity
- Can add after MVP is working

**Impact**: Remove `is_recurring` and `recurring_pattern` from schema

---

### 7. **Court Availability Check** → Manual Only Initially
**Current**: Track `court_available` boolean, plan for API/scraping
**Simplification**: Remove field, just manual check before proposing
**Rationale**:
- CourtReserve API/scraping is uncertain
- Manual check is fine for MVP
- Can add automation later

**Impact**: Remove `court_available` field, admin just checks manually

---

### 8. **Payment Status** → Simplify
**Current**: "pending", "verified", "disputed", "refunded", "no_refund_cancelled"
**Simplification**: "pending", "paid", "refunded"
**Rationale**:
- "disputed" is edge case (can handle manually)
- "no_refund_cancelled" can be determined from cancellation time
- Simpler = easier to reason about

**Impact**: Simplify payment status enum

---

### 9. **Registration Links** → Simple Tokens
**Current**: One-time use, expiration, tracking who used it
**Simplification**: Simple unique tokens, no expiration initially
**Rationale**:
- Expiration adds complexity
- One-time use is important (prevent duplicates)
- Can add expiration later if needed

**Impact**: Remove `expires_at`, keep `used_at` for one-time use

---

### 10. **Cost Calculation** → Fixed Per Session Initially
**Current**: Dynamic cost based on number of players
**Simplification**: Fixed cost per player (e.g., $4/person for 4 players)
**Rationale**:
- Simpler to understand
- No recalculation when players drop
- Can add dynamic pricing later

**Impact**: Remove dynamic calculation, use fixed `cost_per_player` field

---

## Recommended Simplifications for MVP

**High Impact, Low Risk:**
1. ✅ Single admin per pool (add multi-admin later)
2. ✅ Simplify notification preferences to boolean
3. ✅ Remove waitlist position (use timestamp)
4. ✅ Simplify session statuses
5. ✅ Remove recurring sessions from MVP
6. ✅ Simplify payment statuses
7. ✅ Remove court_available field (manual check)

**Medium Impact:**
8. ⚠️ Admin-only session proposals (players might want this)
9. ⚠️ Fixed cost per player (dynamic might be better)

**Low Impact:**
10. ⚠️ Registration link expiration (probably fine to keep)

---

## Simplified Schema (MVP)

### Core Tables (Simplified)
- `pools` - owner_id (single admin), no pool_admins table
- `players` - notification_enabled (boolean), no JSONB preferences
- `pool_players` - simple junction table
- `registration_links` - no expiration, just one-time use
- `sessions` - no recurring, no court_available, simpler status
- `session_participants` - no waitlist_position, use timestamp
- `payments` - simpler status enum

### Removed for MVP
- `pool_admins` table (single admin)
- Recurring session fields
- Court availability tracking
- Complex notification preferences
- Waitlist position tracking

---

## What to Keep (Core Value)

**Must Keep:**
- ✅ Opt-in model (core value prop)
- ✅ Automatic Venmo links
- ✅ Waitlist system (even if simplified)
- ✅ Cancellation policy (protects admin)
- ✅ Payment tracking
- ✅ Registration links (one-time use)

**Can Simplify:**
- Multi-admin → Single admin
- Player proposals → Admin only
- Dynamic pricing → Fixed pricing
- Complex statuses → Simple statuses

---

## Migration Path

**Phase 1 (MVP)**: Simplified version
**Phase 2**: Add multi-admin support
**Phase 3**: Add player proposals
**Phase 4**: Add dynamic pricing
**Phase 5**: Add recurring sessions (if CourtReserve supports)

