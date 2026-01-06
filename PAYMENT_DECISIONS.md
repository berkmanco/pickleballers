# Payment & Notification Decisions

## Payment Methods: Venmo Only (No Cash)

### Recommendation: **Venmo Only - Digital Payments**

### Cost Comparison

| Method | Cost Per Transaction | Cost Per Session (8 players) | Pros | Cons |
|--------|---------------------|------------------------------|------|------|
| **Venmo** | $0 | $0 | Free, everyone has it, instant, no cash handling | No API (manual reconciliation) |
| **Stripe** | ~$0.50 | ~$4-8 | Full API, auto-reconciliation | Fees add up, players need cards |
| **Cash** | $0 | $0 | Free | ❌ Inconvenient, hard to track, requires in-person |

### Decision: No Cash

**Why Venmo Only:**
- ✅ Zero cost overhead
- ✅ Everyone already has it
- ✅ Simple to implement (just generate links)
- ✅ Instant transfers
- ✅ **No cash handling** - all digital (easy for admin)
- ✅ **You're providing a service** - digital payments are cleaner

**Why NOT Cash:**
- ❌ Inconvenient for admin to handle
- ❌ Hard to track
- ❌ Requires in-person coordination
- ❌ You're providing a service - digital payments are cleaner

**Don't add Stripe initially because:**
- ❌ Adds ~$4-8 cost per session
- ❌ More complex setup
- ❌ Players need to enter card info (friction)
- ❌ Overkill for small friend groups

**When to consider Stripe:**
- If you're doing 10+ sessions/month
- If manual reconciliation becomes too painful
- If players specifically request it
- If you want to scale to larger groups

**Bottom line**: Venmo only, digital payments, no cash. Add Stripe later only if needed.

---

## Notification Sender

### SMS Notifications
- **From**: Twilio service number (NOT your personal number)
- **Players see**: "Pickleballers" as sender name
- **Cost**: ~$0.0075 per SMS (very cheap)
- **Setup**: You configure Twilio number once, no one sees your personal number

### Email Notifications
- **From**: `noreply@pickleballers.app` (or your custom domain)
- **Service**: SendGrid/Resend (free tier usually sufficient)
- **Professional**: Not your personal email

**Answer**: Notifications come from service numbers/emails, NOT your personal contact info.

---

## Cancellation Policy (Protecting You)

### The Problem
You front the money to CourtReserve. If someone cancels last minute and you refund them, **you eat the cost** because CourtReserve won't refund you.

### The Solution

**Cancellation Policy:**
- **>24 hours before**: Full refund (time to find replacement)
- **<24 hours before**: No refund UNLESS replacement found

**How it works:**
1. Player tries to cancel
2. System calculates hours until session
3. **If >24h**: Full refund, system tries to fill from waitlist
4. **If <24h**: 
   - System warns: "No refund unless replacement found (court already booked)"
   - Player can still cancel (their choice)
   - System aggressively tries to fill from waitlist
   - **If replacement found**: Original player gets refund, replacement pays
   - **If no replacement**: You keep the money (no refund)

**This protects you** from eating costs on last-minute cancellations. Players can still cancel, but they only get refunded if they find a replacement or give >24 hours notice.

---

## Alternative Payment Methods

### Zelle (Free Option)
- ✅ Free (no fees)
- ✅ Bank-to-bank, instant
- ✅ Most banks support it
- ❌ No API (manual reconciliation, same as Venmo)
- **Verdict**: Could add as additional option, but Venmo is more common

### PayPal (Has API)
- ✅ Has API
- ❌ Fees: 2.9% + $0.30 (same as Stripe)
- ❌ Less common than Venmo
- **Verdict**: Not worth it, Stripe is better if you go that route

### Cash
- ✅ Free
- ❌ Inconvenient to track
- ❌ Requires in-person coordination
- ❌ You're providing a service - digital is cleaner
- **Verdict**: Not accepted - Venmo only

**Final Recommendation**: Venmo only (no cash). Add Stripe later only if needed.

