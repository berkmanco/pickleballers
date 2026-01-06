# MVP Simplifications

## Recommended Simplifications

### High Priority (Do These)
1. **Single admin per pool** - Remove `pool_admins` table, add `owner_id` to `pools`
2. **Admin-only session proposals** - Players can't propose initially
3. **Simple notifications** - Boolean `notifications_enabled` instead of Email/SMS/Both
4. **Remove waitlist position** - Use `opted_in_at` timestamp for ordering
5. **Simplify session statuses** - Remove "gathering_interest", just "proposed", "confirmed", "cancelled", "completed"
6. **Remove recurring sessions** - Add later if CourtReserve supports it
7. **Remove court_available field** - Manual check is fine for MVP
8. **Simplify payment statuses** - Just "pending", "paid", "refunded"

### Medium Priority (Consider)
9. **Fixed cost per player** - Instead of dynamic calculation (simpler, but dynamic might be better)
10. **Registration link expiration** - Probably fine to keep one-time use

## Simplified MVP Schema

- `pools` - owner_id (single admin)
- `players` - notification_enabled (boolean)
- `pool_players` - junction table
- `registration_links` - one-time use tokens
- `sessions` - no recurring, no court_available, simpler status
- `session_participants` - no waitlist_position
- `payments` - simpler status enum

## What to Keep

✅ Opt-in model (core value)  
✅ Automatic Venmo links  
✅ Waitlist system  
✅ Cancellation policy  
✅ Payment tracking  
✅ Registration links
