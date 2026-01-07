# MVP Simplifications

## MVP Decisions (Architecture Ready for Future Features)

### For MVP (Simplified)
1. **Single admin per pool** - Use `owner_id` in `pools` table
   - ✅ Architecture supports multi-admin via `pool_admins` table (ready for quick follow-up)
2. **Admin-only session proposals** - Only admins can propose sessions
   - ✅ Architecture supports player proposals via `created_by` field (ready for quick follow-up)
3. **Keep notification preferences** - Email/SMS/Both (JSONB field)
   - ✅ Keep as designed
4. **Keep waitlist position** - Important for ordering
   - ✅ Keep `waitlist_position` field
5. **Simplify session statuses** - Remove "gathering_interest"
   - ✅ Use: "proposed", "confirmed", "cancelled", "completed"
6. **No recurring sessions in MVP** - Add later
   - ✅ Architecture supports recurring via `is_recurring` and `recurring_pattern` fields
7. **Manual court availability** - No automation in MVP
   - ✅ Architecture supports automation via `court_available` field (ready for future)
8. **Simplify payment statuses** - Just "pending", "paid", "refunded"
   - ✅ Simplified from complex enum
9. **Cost calculation** - Split guest pool model
   - ✅ Admin pays $9/court (member rate)
   - ✅ Guest pool: $48/court split among all guests
   - ✅ Formula: `guest_cost = ($48 × courts) / number_of_guests`

## MVP Schema (Simplified but Future-Ready)

### Tables for MVP
- `pools` - owner_id (single admin), but schema supports multi-admin
- `players` - notification_preferences (JSONB: email, sms)
- `pool_players` - junction table
- `registration_links` - one-time use tokens
- `sessions` - created_by (admin only in MVP, but supports players), no recurring in MVP but schema ready
- `session_participants` - waitlist_position (keep it)
- `payments` - simplified status (pending/paid/refunded)

### Architecture Supports (Not in MVP)
- ✅ Multi-admin via `pool_admins` table
- ✅ Player proposals via `created_by` field
- ✅ Recurring sessions via `is_recurring` and `recurring_pattern`
- ✅ Court automation via `court_available` field

## What to Keep

✅ Opt-in model (core value)  
✅ Book early, pay late (24h before session)  
✅ Automatic Venmo links at payment deadline  
✅ Waitlist system with position tracking  
✅ Cancellation policy (free before payment deadline, owe after)  
✅ Split guest pool cost model ($48/court ÷ guests)  
✅ Payment tracking  
✅ Registration links  
✅ Notification preferences (Email/SMS/Both)
