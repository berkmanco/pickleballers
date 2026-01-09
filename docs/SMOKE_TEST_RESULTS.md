# Smoke Test Results - Jan 9, 2026

## ✅ Fixed This Session

### PWA Icons
- Created properly sized icons (192x192, 512x512)
- Updated vite.config.ts to reference them

### Auth Flow
- Authenticated users now redirect from `/` to `/dashboard`
- Logout redirects to `/` instead of `/login`

### Venmo Input
- Register page now strips `@` from Venmo input (matches Settings page)

### Venmo Payment Links
- **Admin → Guest**: "Request" button now uses `txn=charge` to request money FROM guest
- **Guest → Admin**: "Pay via Venmo" button dynamically generates `txn=pay` link to admin
- Both flows use same `#dinkup-{paymentId}` hashtag for auto-reconciliation

---

## 🐛 Bugs Still Open

### 1. Edge Function Errors (Notifications)
**Symptom**: "Edge Function returned a non-2xx status code" when locking roster or sending reminders

**Likely Cause**: Resend DNS records after Cloudflare migration

**To Debug**:
1. Check Resend Dashboard → Domains → Verify `updates.dinkup.link` is verified
2. In Supabase Dashboard → Edge Functions → Check logs for actual error
3. Verify `FROM_EMAIL` secret is `DinkUp <noreply@updates.dinkup.link>` (not root domain)

### 2. Safari Magic Link Not Working
**Symptom**: Clicking magic link in Safari doesn't log user in

**Likely Cause**: Safari blocks cross-origin redirects, token in URL fragment gets lost

**To Debug**:
- Check browser console for errors
- May need to adjust AuthCallback handling

### 3. Gmail Mobile → Chrome Redirect Fails
**Symptom**: Clicking login link in Gmail app redirects to Chrome but doesn't complete login

**Likely Cause**: Token handoff between apps loses URL fragment

**To Debug**:
- Similar to Safari issue
- May need deep link handling

---

## 📋 Features To Implement

### 1. Delete Session
**Priority**: High
**Description**: Allow admin to delete a session (before or after roster lock?)
**Considerations**:
- What happens to existing payments?
- Soft delete vs hard delete?
- Send notification to participants?

### 2. Unlock Session
**Priority**: High  
**Description**: Allow admin to unlock a locked roster for corrections
**Status**: Backend function `unlockRoster()` exists, needs UI button
**Considerations**:
- Should this void existing payments?
- Or just allow roster changes?

### 3. Add Existing Player to Session
**Priority**: Medium
**Description**: Admin can add a player who's already in the pool to a session without re-registration
**Considerations**:
- Dropdown of pool members not in session?
- Auto-create session_participant record

### 4. Dynamic OG Meta Tags
**Priority**: Low
**Description**: Link previews should show session-specific info when sharing session URLs
**Current**: All links show generic DinkUp preview
**Solution**: Server-side rendering or edge function for meta tags

---

## 🔬 Not Yet Tested

### Venmo Auto-Matching
**Blocked By**: Need to test with real Venmo payment that includes hashtag
**Flow**: 
1. Guest pays via Venmo link with `#dinkup-{paymentId}`
2. Admin receives Venmo email → forwards to Cloudflare
3. Cloudflare parses → sends to Supabase
4. Edge function matches hashtag → auto-marks payment as paid

---

## 📝 Notes

- Existing payments in DB have old Venmo links (admin's Venmo with `txn=pay`)
- New payments will have correct links (guest's Venmo with `txn=charge`)
- To fix existing payments: delete session and recreate, or manually update `venmo_payment_link` in DB
