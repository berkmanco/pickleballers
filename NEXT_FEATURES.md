# Next Features to Build

## Priority Order (MVP)

### 1. Pool Management ⭐ (Foundation)
**Why first:** Everything else depends on pools existing

**Features:**
- Create a pool (admin only)
- View pools you own/are in
- List all pools on dashboard
- Basic pool details page

**Pages needed:**
- `/pools` - List of pools
- `/pools/new` - Create pool (admin only)
- `/pools/:id` - Pool details

**Database queries:**
- `getPools()` - Get pools user owns or is in
- `createPool()` - Create new pool
- `getPool(id)` - Get pool details

---

### 2. Player Registration (One-Time Links) ⭐
**Why second:** Need to add players to pools

**Features:**
- Admin generates registration link for a pool
- Registration page validates token
- Player fills form (name, phone, venmo, notifications)
- Creates player record + adds to pool
- Marks link as used

**Pages needed:**
- `/register/:token` - Registration form (public, no auth)
- Admin UI to generate links (in pool details)

**Database queries:**
- `createRegistrationLink(poolId)` - Generate token
- `validateRegistrationToken(token)` - Check if valid
- `registerPlayer(token, data)` - Create player + join pool

---

### 3. Session Proposals ⭐⭐ (Core Feature)
**Why third:** This is the main value prop

**Features:**
- Admin proposes session (date, time, pool)
- Sessions show on pool page
- List of sessions on dashboard
- Session details page

**Pages needed:**
- `/sessions/new` - Propose session (admin only)
- `/sessions/:id` - Session details
- Sessions list on pool page

**Database queries:**
- `createSession(poolId, data)` - Create session
- `getSessions(poolId)` - Get sessions for pool
- `getSession(id)` - Get session details

---

### 4. Player Opt-In System ⭐⭐⭐ (Core Value)
**Why fourth:** This is the main differentiator

**Features:**
- Players see sessions they can join
- Click "I'm In" → status: committed
- Click "Maybe" → waitlist
- Real-time count of committed players
- Cost per player updates dynamically

**Pages needed:**
- Session details page with opt-in buttons
- Show current participants

**Database queries:**
- `optInToSession(sessionId, playerId, status)` - Commit/maybe
- `getSessionParticipants(sessionId)` - Get who's in
- `calculateCostPerPlayer(sessionId)` - Dynamic cost

---

### 5. Payment Tracking ⭐⭐
**Why fifth:** Needed to track who paid

**Features:**
- Generate Venmo link when player commits
- Payment dashboard (admin view)
- Mark payments as received
- Show payment status per session

**Pages needed:**
- `/payments` - Payment dashboard (admin)
- Payment status on session details

**Database queries:**
- `createPayment(sessionParticipantId)` - Create payment record
- `generateVenmoLink(amount, venmoAccount)` - Generate link
- `markPaymentReceived(paymentId)` - Admin marks as paid

---

## Feature Dependencies

```
Pool Management
  └─> Player Registration (needs pools)
       └─> Session Proposals (needs pools + players)
            └─> Player Opt-In (needs sessions)
                 └─> Payment Tracking (needs participants)
```

## Recommended Build Order

1. **Pool Management** (Foundation)
2. **Player Registration** (Add people to pools)
3. **Session Proposals** (Create games)
4. **Player Opt-In** (Core value - self-service)
5. **Payment Tracking** (Complete the loop)

## Quick Wins (Can build in parallel)

- **Dashboard improvements** - Show pools, recent sessions
- **Pool details page** - List players, sessions
- **Session list** - Show all sessions for a pool

## Future Features (Post-MVP)

- Waitlist auto-promotion
- Cancellation handling
- Notifications (email/SMS)
- Court booking integration
- Recurring sessions

