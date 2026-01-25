# Twilio Toll-Free Verification Reference

## Submission Information for DinkUp

Last updated: January 23, 2026

---

## Common Rejection Codes

### Error 30504: Single Opt-In for Multiple Use Cases Not Allowed ⚠️
**Cause**: One checkbox cannot cover multiple message types (e.g., transactional + promotional).
**Fix**: Use ONE checkbox for ONE use case only. We now use SMS exclusively for transactional session notifications (reminders + payments). Waitlist alerts are email-only.

### Error 30498: Opt-In Workflow Must Match Submission Details
**Cause**: Your description doesn't match the screenshot/proof you provided.
**Fix**: Ensure screenshot shows checkbox unchecked by default and matches the workflow described.

### Error 30510: Opt-In Example Must Be Complete, Branded, and Legible
**Cause**: Screenshot is cropped, missing branding, or illegible.
**Fix**: Show full Settings page with DinkUp logo/text, phone field, unchecked checkbox, and complete disclosure text.

### Error 30513: Consent for Messaging is a Requirement
**Cause**: SMS appears mandatory or consent language is unclear.
**Fix**: Emphasize SMS is OPTIONAL, not required to use DinkUp.

---

## Submission Fields

### Business Information
- **Legal Entity Name**: Berkman Consulting LLC
- **Website URL**: https://berkman.co
- **First Name**: Mike
- **Last Name**: Berkman
- **Email**: mike@berkman.co
- **Phone Number**: (614) 537-6574

### Opt-In Details

**Opt-in Type**: `Web Form`

**Proof of Consent (URL)**:
```
https://www.dinkup.link/screenshots/sms-consent.png
```

**IMPORTANT**: Screenshot must show:
- SMS checkboxes UNCHECKED by default (all 3 types)
- Full notification preferences table with 5 types visible
- 3 SMS-enabled types: session reminders, payment requests, payment reminders
- 2 email-only types: waitlist promotions, session cancellations
- Phone number field visible
- Clear, readable image quality
- DinkUp branding visible in navbar

### Use Case Description (500 character limit)

**Current Submission (Compliant with separate opt-ins)**:
```
DinkUp is a pickleball app. Users receive OPTIONAL SMS via separate opt-ins.

Settings page shows 3 checkboxes:
• "24-hour session reminders" 
• "Payment requests"
• "Payment reminders"

Each has disclosure: "Receive SMS text messages for [type]. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe." 

All unchecked by default. Phone required for SMS. Email is default notification method. Each checkbox is independent opt-in.
```

**Character count**: 449

**Key Points**:
- ✅ SEPARATE opt-in for each SMS type (fixes Error 30504)
- ✅ Emphasize "OPTIONAL" and "independent"
- ✅ Lists all 3 SMS-enabled types
- ✅ Includes disclosure text
- ✅ Mentions unchecked by default
- ✅ States email as default alternative

### Sample Message

**Session Reminder**:
```
🏓 DinkUp: Weekend Warriors tomorrow at 10:00 AM. See you on the court!
```

**Payment Request**:
```
DinkUp: Payment request for Weekend Warriors session on 1/25. You owe $8.50. Pay via Venmo: @dinkup
```

**Payment Reminder**:
```
DinkUp: Reminder - $8.50 still due for Weekend Warriors session. Please pay via Venmo: @dinkup
```

### Additional Information (Optional)

**Current Submission**:
```
SMS is opt-in only. Users must enable SMS in Settings by checking individual boxes for each notification type. Phone number required. Email is the default notification channel. SMS is reserved for time-sensitive transactional alerts: 24-hour game reminders, payment requests, and payment reminders. Each SMS type has separate consent checkbox.
```

### Opt-In Confirmation Message (Optional)

**Leave blank** - Users see their preferences immediately in the Settings UI, so an automated confirmation message is not needed. The Settings page serves as the confirmation.

### Help Message (Optional)

**Recommended**:
```
DinkUp SMS Help: You're subscribed to time-sensitive pickleball notifications. Visit dinkup.link/settings to manage preferences. Reply STOP to unsubscribe. Msg&data rates may apply.
```

---

## Pre-Submission Checklist

Before resubmitting, verify:

- [ ] Screenshot shows checkbox **UNCHECKED**
- [ ] Screenshot URL is publicly accessible (test in incognito)
- [ ] Use case description mentions "OPTIONAL" for SMS
- [ ] Use case description quotes exact checkbox label
- [ ] Use case description is under 500 characters
- [ ] Sample message is realistic and matches actual notifications
- [ ] No mention of SMS during registration (Settings only)
- [ ] Terms page matches workflow (Settings-only opt-in)

---

## What Makes Our Opt-In Compliant

✅ **Express Written Consent**: Checkbox with explicit "I agree to receive SMS text messages from DinkUp"

✅ **Unchecked by Default**: Users must actively check the box

✅ **Clear Disclosure**: Message frequency, data rates, and STOP instructions visible at point of opt-in

✅ **Separate from Terms**: SMS consent is not buried in Terms of Service

✅ **Optional**: Email is the default; SMS requires separate opt-in

✅ **Revocable**: Users can uncheck box in Settings or reply STOP anytime

---

## SMS Workflow (Settings Only)

1. User creates account (email required, phone optional)
2. User navigates to Settings page
3. User enters phone number (optional field)
4. User checks: "I agree to receive SMS text messages from DinkUp"
5. Full disclosure shown under checkbox
6. Checkbox unchecked by default
7. User can uncheck anytime to disable SMS

**NOT** collected during registration - email only during signup.

---

## Message Types (SMS Only)

SMS is reserved for **time-sensitive updates only**:

1. **24-hour game reminders** - Day before scheduled session
2. **Waitlist promotions** - When promoted from waitlist to active roster
3. **Session cancellations** - When session is cancelled by owner

All other notifications (session creation, roster lock, payment reminders, etc.) are sent via email.

---

## Common Mistakes to Avoid

❌ **Don't** make SMS sound mandatory ("Users receive SMS notifications...")  
✅ **Do** emphasize it's optional ("Users can receive OPTIONAL SMS notifications...")

❌ **Don't** use a screenshot with checkbox checked  
✅ **Do** show checkbox unchecked by default

❌ **Don't** select "Verbal" opt-in type (that's for phone calls)  
✅ **Do** select "Web Form" for checkbox-based opt-in

❌ **Don't** bundle SMS consent in Terms of Service  
✅ **Do** have explicit checkbox at point of opt-in

❌ **Don't** collect SMS consent during registration  
✅ **Do** collect only in Settings with full disclosure

---

## Resubmission Timeline

- You have **7 days** to resubmit after rejection
- Resubmissions within 7 days go to prioritized queue
- After 7 days, still can resubmit but no priority (normal queue)

---

## Support

If rejected again:
1. Check error codes in rejection email
2. Review this document for matching fixes
3. Verify screenshot is current and accessible
4. Contact Twilio support via dashboard if unclear
5. Ask their chatbot for specific guidance on error codes
