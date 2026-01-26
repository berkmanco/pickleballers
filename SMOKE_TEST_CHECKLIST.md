# Smoke Test Checklist - Recent Features

## Test Environment Setup

**Preview URL**: https://dinkup-e9f84222v-berkmanco.vercel.app (or production after merge)

**Test Accounts Needed**:
- [ ] Pool owner account (existing)
- [ ] Pool member account (existing)
- [ ] New user email for registration testing
- [ ] Mobile device or responsive browser mode

**Pre-Test Setup**:
- [ ] Have at least one pool with multiple members
- [ ] Have at least one session (proposed or confirmed)
- [ ] Have phone number configured for SMS testing (if applicable)

---

## PR #34: Session Comments, Owner Notifications, Welcome Email, Mobile Fix

### 1. Mobile Overflow Fix (PoolDetails Page)
**Device**: Test on mobile or narrow browser (< 640px)

- [ ] Navigate to a Pool Details page
- [ ] Check the player list
- [ ] Verify "Joined" date is **NOT** cut off (should show just the date, no "Joined" label)
- [ ] Expand browser to tablet size (> 640px)
- [ ] Verify "Joined [date]" shows full label

**Expected**: Date fits properly on all screen sizes, no overflow

---

### 2. Session Comments
**Page**: SessionDetails

#### Basic Comment Operations
- [ ] Navigate to any session details page
- [ ] Scroll to bottom - see "Comments" section
- [ ] Verify empty state message if no comments: "No comments yet. Be the first to comment!"
- [ ] Type a comment in the textarea (e.g., "I'll bring extra balls!")
- [ ] Click "Post Comment" button
- [ ] Verify comment appears in the list immediately
- [ ] Verify your name shows next to the comment
- [ ] Verify timestamp shows (e.g., "just now" or "2m ago")

#### Delete Comment
- [ ] Find your own comment in the list
- [ ] Verify "Delete" button shows on the right
- [ ] Click "Delete"
- [ ] Confirm deletion in browser dialog
- [ ] Verify comment is removed from list

#### Multiple Comments
- [ ] Add 2-3 comments
- [ ] Verify they appear in chronological order (oldest first)
- [ ] Verify timestamps update correctly

#### Permissions
- [ ] Try to delete someone else's comment (should NOT see delete button)
- [ ] Try accessing session from a pool you're not in (should not see it at all - RLS)

**Expected**: Comments work smoothly, delete only shows for your own comments

---

### 3. Owner Notifications (Player Joined)
**Trigger**: Someone registers via invite link

#### Setup
- [ ] You are a pool owner
- [ ] You have access to the email account for your owner account
- [ ] Have the pool registration link ready: `dinkup.link/r/your-pool-slug`

#### Test Registration Flow
- [ ] Open an incognito/private browser window
- [ ] Navigate to the registration link
- [ ] Complete registration with a NEW email address
  - Name: "Test User"
  - Email: (use a test email you can check)
  - Phone: (optional)
  - Venmo: @testuser
- [ ] Submit registration
- [ ] Verify registration succeeds

#### Check Owner Notification Email
- [ ] Check your pool owner email inbox (allow 1-2 minutes)
- [ ] Look for email: "New Player Joined: [Pool Name]"
- [ ] Verify email contains:
  - ✅ "Test User just joined your [Pool Name] pool"
  - ✅ New player's name
  - ✅ New player's email
  - ✅ New player's phone (if provided)
  - ✅ "View Pool" button/link
- [ ] Click "View Pool" link
- [ ] Verify it takes you to the pool page
- [ ] Verify the new player appears in the player list

**Expected**: Owner gets notified immediately when someone joins via invite link

---

### 4. Welcome Email (New Player)
**Trigger**: Someone registers via invite link

#### Using Previous Registration
- [ ] Check the NEW test email inbox (the one you used to register)
- [ ] Look for email: "Welcome to [Pool Name]! 🏓"

#### Verify Email Contents
- [ ] Email greeting: "Hey [First Name]!"
- [ ] Welcome message: "Welcome to [Pool Name]! We're excited to have you..."
- [ ] **If pool has upcoming sessions**:
  - [ ] Section titled "Upcoming Sessions:"
  - [ ] Each session shows: Date, Time, Location
  - [ ] Up to 10 sessions listed
  - [ ] Text: "Click below to RSVP for sessions..."
- [ ] **If pool has NO sessions**:
  - [ ] Text: "No upcoming sessions scheduled yet..."
- [ ] Pro tip at bottom: "Enable notifications in your settings..."
- [ ] "View Pool & Sessions" button

#### Click Through
- [ ] Click "View Pool & Sessions" button
- [ ] Verify it takes you to the pool page (should auto-login or prompt for magic link)
- [ ] Verify upcoming sessions are visible on the pool page

**Expected**: New player gets welcome email with session list

---

### 5. Manual Player Addition (Should NOT Trigger Notifications)
**Test**: Verify notifications DON'T fire when owner manually adds players

- [ ] Go to Pool Details page (as owner)
- [ ] Use "Add Existing Player" dropdown OR "Create New Player" form
- [ ] Add a player manually
- [ ] Check your email - should **NOT** receive a "player joined" notification
- [ ] Check if the manually added player has email - should **NOT** receive a welcome email

**Expected**: Manual additions are silent (no notifications)

---

## PR #33: Granular Notification Preferences

### Settings Page - Notification Preferences
**Page**: /settings

#### View Preferences UI
- [ ] Navigate to Settings page
- [ ] Scroll to "Notification Preferences" section
- [ ] Verify table/matrix layout with notification types:
  - [ ] Session Reminders (24 hours before)
  - [ ] Payment Requests (when roster is locked)
  - [ ] Payment Reminders (follow-up reminders)
  - [ ] Waitlist Promotions (moved from waitlist to committed)
  - [ ] Session Cancellations (session cancelled by admin)
- [ ] Verify each type has two columns: Email, SMS
- [ ] Verify SMS checkboxes are **disabled** if you have no phone number

#### Change Preferences
- [ ] Toggle Email ON for "Session Reminders"
- [ ] Toggle Email OFF for "Payment Requests" (if you dare!)
- [ ] Scroll down and click "Save Settings"
- [ ] Verify success message appears
- [ ] Refresh the page
- [ ] Verify your changes persisted

#### SMS Disclosures
- [ ] If you have a phone number configured:
  - [ ] Hover over or check SMS checkboxes
  - [ ] Verify disclosure text appears for each type
  - [ ] Toggle SMS ON for one type
  - [ ] Verify consent language at bottom of section
  - [ ] Save and verify it persists

**Expected**: Clean matrix UI, independent email/SMS toggles, changes save

---

## PR #32: All Pool Members Can Share Registration Link

### Registration Link Visibility
**Page**: PoolDetails

#### As Pool Owner
- [ ] Navigate to Pool Details page (as owner)
- [ ] Verify "Invite Players" section with registration link visible
- [ ] Verify link shows: `dinkup.link/r/pool-slug`
- [ ] Verify "Copy Link" button exists
- [ ] Verify checkbox to toggle Open/Closed (admin control)

#### As Pool Member (Not Owner)
- [ ] Switch to a different account (or have someone else test)
- [ ] Navigate to the same pool (as a member, not owner)
- [ ] Verify "Invite Players" section is **visible**
- [ ] Verify registration link shows: `dinkup.link/r/pool-slug`
- [ ] Verify "Copy Link" button exists
- [ ] Verify **NO** checkbox to toggle Open/Closed (owner only)

#### Copy Link Functionality
- [ ] Click "Copy Link" button (as owner or member)
- [ ] Verify button changes to "✓ Copied!"
- [ ] Paste into a new browser tab or share via text
- [ ] Verify link works

**Expected**: All pool members can see and share the link, only owner can toggle open/closed

---

## PR #31: Multi-Use Registration Links

### Registration Flow
**Link Format**: `dinkup.link/r/pool-slug` (vs old token format)

#### First-Time Registration
- [ ] Open incognito browser
- [ ] Navigate to `dinkup.link/r/[any-pool-slug]`
- [ ] Verify registration form appears
- [ ] Complete registration with email #1
- [ ] Verify success and redirect to pool/dashboard

#### Second Registration (Different User)
- [ ] Open another incognito window
- [ ] Navigate to **same** registration link
- [ ] Verify form still appears (not "link used" error)
- [ ] Complete registration with **different** email #2
- [ ] Verify success

#### Duplicate Email Prevention
- [ ] Open third incognito window
- [ ] Navigate to same link
- [ ] Try to register with **same email as user #1**
- [ ] Verify error: "This email is already registered in this pool"

#### Toggle Registration (Owner Only)
- [ ] As pool owner, go to Pool Details
- [ ] Find "Open/Closed" checkbox
- [ ] **Uncheck** to close registration
- [ ] Try registration link in incognito window
- [ ] Verify error: "Registration is currently closed for this pool"
- [ ] Go back as owner and **check** to re-open
- [ ] Verify registration works again

**Expected**: Link works unlimited times, different users can register, duplicates blocked

---

## PR #30: Footer with BerkmanCo Branding

### Footer Visibility
**Location**: All pages, bottom

- [ ] Navigate to any page (Home, Dashboard, Pool Details, Session, Settings)
- [ ] Scroll to the bottom of the page
- [ ] Verify footer appears with:
  - [ ] "Made with ❤️ by BerkmanCo" text
  - [ ] Link to BerkmanCo (or similar)
  - [ ] DinkUp branding/logo (if applicable)
- [ ] Click the BerkmanCo link
- [ ] Verify it opens the correct URL (new tab)

**Expected**: Footer appears on all pages, link works

---

## PR #29: Session Cancellation Notifications

### Cancel a Session
**Trigger**: Admin cancels a session with participants

#### Setup
- [ ] As pool owner, navigate to a session with committed participants
- [ ] Verify session is in "proposed" or "confirmed" status
- [ ] Verify at least 1-2 players are committed

#### Cancel Session
- [ ] Look for "Cancel Session" button (usually near Delete)
- [ ] Click "Cancel Session"
- [ ] Confirm cancellation in dialog
- [ ] Verify session status changes to "Cancelled"
- [ ] Verify success message appears

#### Check Notifications
- [ ] Check email for committed participants (allow 1-2 minutes)
- [ ] Each participant should receive:
  - [ ] Subject: "Session Cancelled: [Pool Name] - [Date]"
  - [ ] Body includes: Date, time, location, pool name
  - [ ] Red/warning styling (cancellation alert)
  - [ ] Message: "We're sorry to inform you that the following pickleball session has been cancelled"
  - [ ] "View Pool" button
- [ ] If SMS enabled for participants (and Twilio approved):
  - [ ] Verify SMS notification sent

#### Session Display
- [ ] Go back to pool page
- [ ] Verify cancelled session still shows (if within date range)
- [ ] Verify "Cancelled" badge/status is visible
- [ ] Click into cancelled session
- [ ] Verify page shows it's cancelled

**Expected**: All participants notified via email/SMS, session marked as cancelled

---

## General Regression Tests

### Core Functionality (Quick Checks)
- [ ] Login with magic link works
- [ ] Dashboard shows your pools and upcoming sessions
- [ ] Create new session works
- [ ] Opt-in to session (committed/maybe) works
- [ ] Lock roster (as admin) works
- [ ] Payment tracking works (mark paid/forgiven)
- [ ] Edit session (before roster locked) works
- [ ] Delete session works

### Navigation
- [ ] All nav links work (Dashboard, Settings, etc.)
- [ ] Back buttons work throughout the app
- [ ] Mobile menu works (hamburger icon on mobile)

### Responsive Design
- [ ] Desktop view (1920x1080) looks good
- [ ] Tablet view (768px) looks good
- [ ] Mobile view (375px) looks good
- [ ] No horizontal scrolling on any screen size

---

## Bug Report Template

If you find issues during testing, use this format:

```markdown
**Bug**: [Short description]
**Steps to Reproduce**:
1. 
2. 
3. 

**Expected**: [What should happen]
**Actual**: [What actually happened]
**Environment**: [Preview/Production, Browser, Device]
**Screenshot**: [If applicable]
**Priority**: [High/Medium/Low]
```

---

## Summary Checklist

After completing all tests above:

- [ ] All mobile UI elements fit properly (no overflow)
- [ ] Session comments work (add, delete, display)
- [ ] Owner gets notified when player joins via link
- [ ] New player gets welcome email with sessions
- [ ] Manual player additions are silent (no notifications)
- [ ] Notification preferences UI works and saves
- [ ] All pool members can see/share registration link
- [ ] Multi-use registration links work (unlimited use)
- [ ] Footer appears on all pages
- [ ] Session cancellations notify all participants
- [ ] No major regressions in core functionality

**Pass Criteria**: All checkboxes above are ✅

---

## Notes

- **Email delays**: Allow 1-2 minutes for emails to arrive
- **SMS**: Currently disabled pending Twilio approval
- **Comment notifications**: Disabled by default (infrastructure ready)
- **Edge Functions**: Must be deployed for notifications to work in production
- **Database migrations**: Must be applied for new tables (session_comments)
