## To Do 📋

### High Priority
- [ ] players page w/ details (dont show all details in list)

### Medium Priority
- [ ] auto-login after registration (needs edge function)
- [ ] custom design for supabase auth emails (need custom SMTP server)
- [ ] UI - Add players to multiple pools (dropdown of existing players, add new, create link)

### Future / Exploration
- [ ] Automated tests for notifications (edge function smoke tests)
- [ ] Delete session feature
- [ ] Unlock session feature
- [ ] Add existing player to session (without re-registration)
- [ ] Dynamic OG meta tags for session links
- [ ] CourtReserve integration (scraping web, does API exist?)
  - [ ] ability to look at open courts on a date
  - [ ] ability to book a court on a date
- [ ] Admin can set session costs or make free (outdoor courts)
- [ ] Multi-use registration links (single link, multiple signups)
- [ ] Open registration setting (anyone can sign up without a link)
- [ ] Registration links UI cleanup (only show active, hide used/expired)
- [ ] Granular notification settings:
  - [ ] Notify me when my pool has a new session
  - [ ] Notify me before a session starts
  - [ ] Notify me when I have payments due

### Known Issues
- [ ] Safari magic link login not working
- [ ] Gmail mobile → Chrome redirect fails to log in

---

## Completed ✅

- [x] player not linked to pool after login
- [x] branding - dinkup.link
- [x] security audit / warnings
- [x] refactor, simplify code, clean up
  - [x] collapse all migrations before shipping to production
  - [x] push v1 to prod (set up vercel)
- [x] dashboard should show upcoming committed sessions, and pool sessions i can opt in for
- [x] notifications (email, sms)
- [x] After first login go to dashboard
- [x] payment v1
- [x] use name instead of email in nav
- [x] phone number formatting in db
- [x] Mobile UI overflow issues
- [x] Too much white space on homepage on mobile
- [x] meta tags showing icon/logo for sharing via imessage
- [x] Court numbers field for sessions
- [x] Phone number display formatting
- [x] Cleaned up player list UI (removed Venmo, stacked info)
- [x] Venmo email parser (auto-match payments via Gmail → Cloudflare → Supabase)
- [x] PWA (installable app, offline support)
- [x] "Generate Link" auto-copies to clipboard