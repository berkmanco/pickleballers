# Duration-Based Pricing Implementation

## Overview

The payment system now automatically calculates CourtReserve pricing based on session duration. Admins no longer need to manually configure pricing - it's calculated automatically when they select a duration.

## Pricing Structure

### CourtReserve Doubles Rates

| Duration | Admin Cost | Guest Pool (3 spots) | Total Per Court |
|----------|------------|---------------------|-----------------|
| 30 min   | $4.50      | $24                 | $28.50          |
| 60 min   | $9.00      | $48                 | $57.00          |
| 90 min   | $13.50     | $72                 | $85.50          |
| 120 min  | $18.00     | $96                 | $114.00         |

### Formula

```
admin_cost_per_court = duration_minutes × $0.15
guest_pool_per_court = duration_minutes × $0.80
```

Where:
- **$0.15/min** = CourtReserve member rate
- **$0.80/min** = 3 guest spots at $8 per 30 minutes each

## How It Works

### 1. Session Creation

When creating a session, admins select:
- **Duration** (30, 60, 90, or 120 minutes)
- **Courts needed** (1-4)
- **Min/Max players**

Pricing is **automatically calculated** based on duration.

### 2. Guest Cost Distribution

The total guest pool is split equally among all committed guests:

```
guest_pool = guest_pool_per_court × courts_needed
each_guest_pays = guest_pool ÷ number_of_guests
```

**Example: 90-minute session, 1 court**

| Guests | Each Pays | Total Collected |
|--------|-----------|-----------------|
| 3      | $24.00    | $85.50         |
| 4      | $18.00    | $85.50         |
| 5      | $14.40    | $85.50         |

More guests = lower per-person cost (same total collection).

### 3. Court Spots vs. Attendees

You pay for **4 spots on the court**, not total attendees. If 6 people show up but you only paid for 4 spots, the extra 2 rotate in/out of those same paid spots.

## Implementation

### Code Changes

1. **`src/pages/CreateSession.tsx`**
   - Added `calculateCourtReservePricing()` function
   - Auto-calculates pricing when duration changes
   - Updated dropdown to show pricing for each duration
   - Defaults: 90 min, 1 court, 4-6 players

2. **Database Schema**
   - No changes needed - existing fields support duration-based pricing
   - `admin_cost_per_court` and `guest_pool_per_court` are still stored per session

3. **Tests**
   - Added `tests/pricing.test.ts` with 17 comprehensive tests
   - Validates all duration calculations
   - Tests real-world scenarios
   - Verifies formula accuracy

### User Experience

**Before:**
- Admins had hardcoded $9 admin + $48 guest pool (60-min only)
- No way to adjust for different durations

**After:**
- Select duration → pricing auto-calculated
- Clear labels show pricing for each option
- Works for any duration (30/60/90/120 minutes)

## Example Scenarios

### Scenario 1: Pickle Shack 90-minute session

**Setup:**
- Duration: 90 minutes
- Courts: 1
- Players: 4-6 (min 4, max 6)

**Pricing:**
- Admin pays: $13.50
- Guest pool: $72.00
- Total to venue: $85.50

**Guest costs:**
- 3 guests: $24.00 each
- 4 guests: $18.00 each
- 5 guests: $14.40 each

### Scenario 2: Weekend Warriors 60-minute, 2 courts

**Setup:**
- Duration: 60 minutes
- Courts: 2
- Players: 8 (1 admin + 7 guests)

**Pricing:**
- Admin pays: $18.00 (2 × $9)
- Guest pool: $96.00 (2 × $48)
- Total to venue: $114.00

**Guest costs:**
- 7 guests: $13.71 each

## Testing

Run the pricing tests:

```bash
npm run test:pricing
```

All 17 tests validate:
- Standard duration pricing (30/60/90/120 min)
- Per-guest cost calculations
- Multiple court scenarios
- Total session costs
- Real-world scenarios
- Formula accuracy

## Documentation

Updated:
- `README.md` - Payment model section
- `docs/ARCHITECTURE.md` - Payment model section
- Test count updated to 160 total tests

## Migration Notes

**Existing sessions** created before this change will have the old hardcoded pricing. To fix:

1. Edit the session
2. Change duration dropdown (triggers recalculation)
3. Verify pricing is correct
4. Save

**Future sessions** will automatically use correct pricing based on duration.
