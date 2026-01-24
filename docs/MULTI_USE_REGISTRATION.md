# Multi-Use Registration Links

## Overview

Simplified pool registration using short, memorable URLs based on pool slugs instead of one-time tokens.

## URL Format

**Before:**
```
dinkup.link/register/8f7a9b2c-4d1e-3f6a-9c2b-7e5d4a1f8c3b  (one-time use)
```

**After:**
```
dinkup.link/r/weekend-warriors  (unlimited use)
dinkup.link/r/jv-crew           (unlimited use)
dinkup.link/r/berkman-family    (unlimited use)
```

## Benefits

1. **Shareable** - Drop link in group chat, everyone can use it
2. **Memorable** - Easy to share verbally ("go to dinkup.link/r/jv-crew")
3. **Permanent** - No expiration, no usage limits
4. **Simple** - Admin just toggles registration on/off
5. **Branded** - Pool name in URL reinforces identity

## User Experience

### Admin (Pool Owner)

**Pool Details Page:**
```
┌────────────────────────────────────────┐
│ Registration Link                       │
│ dinkup.link/r/weekend-warriors   [Copy]│
│ ☑ Open • Anyone with the link can join │
└────────────────────────────────────────┘
```

- **Copy link** - One click to copy to clipboard
- **Toggle** - Check/uncheck to open/close registration
- **Status** - Clear visual indicator (Open/Closed)

### Player

**Registration Flow:**
1. Click link: `dinkup.link/r/weekend-warriors`
2. See pool name: "Join Weekend Warriors"
3. Fill out form (name, email, phone, Venmo)
4. Submit → Account created, added to pool
5. Receive magic link email to log in

**Duplicate Protection:**
- If email already exists in Supabase → "Email already in use. Login instead?"
- If email already in THIS pool → "You're already registered in this pool. Login instead?"

## Implementation

### Database Changes

```sql
-- Add registration toggle to pools table
ALTER TABLE pools
  ADD COLUMN registration_enabled BOOLEAN DEFAULT TRUE;
```

- No new tables needed
- Existing `registration_links` table still works for legacy one-time links

### Routes

```typescript
// New route (multi-use)
<Route path="/r/:slug" element={<Register />} />

// Old route (single-use, still supported)
<Route path="/register/:token" element={<Register />} />
```

Both routes supported for backward compatibility.

### Logic

**Registration validation:**
1. Check if parameter is UUID (token) or string (slug)
2. **Token**: Validate against `registration_links` table (legacy)
3. **Slug**: Look up pool by slug, check `registration_enabled`
4. **Both**: Check for duplicate email in pool before creating account

**Key function:**
```typescript
// src/lib/registration.ts
export async function validateRegistrationToken(tokenOrSlug: string) {
  const isUUID = /^[0-9a-f]{8}-...$/i.test(tokenOrSlug)
  
  if (isUUID) {
    // Legacy token-based registration
    return validateToken(tokenOrSlug)
  } else {
    // New slug-based registration
    return validatePoolSlug(tokenOrSlug)
  }
}
```

## Security

### Duplicate Prevention
- Supabase Auth enforces unique emails globally
- Additional check: email already in THIS specific pool
- Clear error messages guide users to login

### Spam Prevention
- Admin can close registration anytime (instant toggle)
- Admin can remove players from pool
- Email verification required (magic link)

### Privacy
- Registration link doesn't expose pool data
- Only shows pool name during registration
- Full player list only visible to members after login

## Backward Compatibility

### Legacy Links Still Work ✅
- One-time token links (`/register/:token`) fully supported
- Existing links in emails/messages continue to function
- Shows as "One-Time Registration Links" in admin UI

### Migration Path
- No data migration needed
- Pools automatically get `registration_enabled = true`
- Old links can be deprecated organically

## Admin Controls

### Open Registration
```
☑ Open • Anyone with the link can join
```
- Link is active
- Anyone can register
- Players see registration form

### Close Registration
```
☐ Closed • Registration is disabled
```
- Link shows "Registration is currently closed"
- Existing players unaffected
- Can reopen anytime

### Remove Players
- Admin can remove players from pool at any time
- Soft delete (`is_active = false`)
- Player can be re-added later

## Edge Cases

### What if someone shares link after registration closes?
- Registration page shows: "Registration is currently closed for this pool"
- Suggests contacting pool organizer

### What if same email tries to register twice?
- First check: Email exists in Supabase? → "Email already in use. Login instead?"
- Second check: Email in this pool? → "You're already registered. Login instead?"

### What if pool slug changes?
- Not currently supported (slug is set once)
- Future feature: Allow slug changes, redirect old → new

### What about invite-only pools?
- Keep registration closed by default
- Only open when actively recruiting
- Or use one-time links for specific invites

## Testing Checklist

- [ ] Visit `/r/{slug}` shows registration form
- [ ] Visit `/r/invalid-slug` shows error
- [ ] Submit form creates player and adds to pool
- [ ] Duplicate email shows appropriate error
- [ ] Toggle registration on/off works
- [ ] Copy link button works
- [ ] Legacy `/register/:token` links still work
- [ ] Closed registration shows appropriate message

## Future Enhancements

### Phase 2
- QR code generation for in-person sign-ups
- Custom welcome message per pool
- Registration analytics (views, completions)

### Phase 3
- Multiple slugs per pool (aliases)
- Time-based auto-open/close (e.g., "Open registration every Monday")
- Approval workflow (admin approves new members)
- Waitlist (pool capacity limits)

## Files Changed

### Database
- `supabase/migrations/20260124000000_add_pool_registration_toggle.sql`

### Frontend
- `src/App.tsx` - Added `/r/:slug` route
- `src/pages/Register.tsx` - Handle both token and slug
- `src/pages/PoolDetails.tsx` - Show permanent link + toggle
- `src/lib/registration.ts` - Validate slug-based registration
- `src/lib/pools.ts` - Toggle registration function, Pool interface

## Summary

Simple, elegant solution that replaces complex one-time links with memorable, shareable URLs. Admin has full control (on/off toggle) without needing expiration dates or usage limits. Backward compatible with existing token-based links.

**Result:** Better UX for both admins and players, easier to manage pools, more viral growth (easy to share).
