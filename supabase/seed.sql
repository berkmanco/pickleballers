-- ============================================
-- Seed Data for DinkUp
-- ============================================
-- This file is automatically run by Supabase CLI in LOCAL development only
-- 
-- When it runs:
--   - First time: supabase start
--   - Every time: supabase db reset
--   - NEVER: supabase db push (seeds don't run on remote/production)
-- 
-- ⚠️ LOCAL DEVELOPMENT ONLY - Seeds never run in production
-- 
-- This simulates a realistic scenario:
-- - 1 pool "Weekend Warriors" with 8 players
-- - 1 upcoming session with 6 committed players
-- - Various payment statuses
-- ============================================

-- ============================================
-- CREATE AUTH USER (mike@berkman.co)
-- ============================================
-- This creates the auth user so Mike can log in with magic link
-- Password is not used (magic link auth), but required by the schema

insert into auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  email_change_token_current,
  reauthentication_token,
  is_sso_user,
  is_anonymous
) values (
  'aaaaaaaa-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'mike@berkman.co',
  crypt('unused-password', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  false,
  'authenticated',
  'authenticated',
  '',
  '',
  '',
  '',
  '',
  '',
  false,
  false
);

-- Also add to auth.identities (required for auth to work properly)
insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) values (
  'aaaaaaaa-0000-0000-0000-000000000000',
  'aaaaaaaa-0000-0000-0000-000000000000',
  'mike@berkman.co',
  '{"sub": "aaaaaaaa-0000-0000-0000-000000000000", "email": "mike@berkman.co"}',
  'email',
  now(),
  now(),
  now()
);

-- ============================================
-- CREATE SECOND AUTH USER (sarah@example.com) - owns other pools
-- ============================================

insert into auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  email_change_token_current,
  reauthentication_token,
  is_sso_user,
  is_anonymous
) values (
  'cccccccc-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'sarah@example.com',
  crypt('unused-password', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  false,
  'authenticated',
  'authenticated',
  '',
  '',
  '',
  '',
  '',
  '',
  false,
  false
);

insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) values (
  'cccccccc-0000-0000-0000-000000000000',
  'cccccccc-0000-0000-0000-000000000000',
  'sarah@example.com',
  '{"sub": "cccccccc-0000-0000-0000-000000000000", "email": "sarah@example.com"}',
  'email',
  now(),
  now(),
  now()
);

-- ============================================
-- CREATE THIRD AUTH USER (erik@example.com) - regular player who has paid
-- ============================================

insert into auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud, confirmation_token,
  recovery_token, email_change_token_new, email_change, email_change_token_current,
  reauthentication_token, is_sso_user, is_anonymous
) values (
  'bbbbbbbb-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'erik@example.com',
  crypt('unused-password', gen_salt('bf')),
  now(), now(), now(),
  '{"provider": "email", "providers": ["email"]}', '{}',
  false, 'authenticated', 'authenticated', '', '', '', '', '', '', false, false
);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  'bbbbbbbb-0000-0000-0000-000000000000',
  'bbbbbbbb-0000-0000-0000-000000000000',
  'erik@example.com',
  '{"sub": "bbbbbbbb-0000-0000-0000-000000000000", "email": "erik@example.com"}',
  'email', now(), now(), now()
);

-- ============================================
-- CREATE FOURTH AUTH USER (john@example.com) - player with pending payment
-- ============================================

insert into auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud, confirmation_token,
  recovery_token, email_change_token_new, email_change, email_change_token_current,
  reauthentication_token, is_sso_user, is_anonymous
) values (
  'dddddddd-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'john@example.com',
  crypt('unused-password', gen_salt('bf')),
  now(), now(), now(),
  '{"provider": "email", "providers": ["email"]}', '{}',
  false, 'authenticated', 'authenticated', '', '', '', '', '', '', false, false
);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  'dddddddd-0000-0000-0000-000000000000',
  'dddddddd-0000-0000-0000-000000000000',
  'john@example.com',
  '{"sub": "dddddddd-0000-0000-0000-000000000000", "email": "john@example.com"}',
  'email', now(), now(), now()
);

-- ============================================
-- PLAYERS (must be created BEFORE pools so trigger finds records)
-- ============================================

-- Phone numbers stored in E.164 format: +1XXXXXXXXXX (required for Twilio SMS)
insert into players (id, user_id, name, phone, email, venmo_account, notification_preferences, is_active) values
  -- Mike - linked to auth user, owns Weekend Warriors & Friends & Family (real phone for testing)
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-0000-0000-000000000000', 'Mike Berkman', '+16145376574', 'mike@berkman.co', 'berkman', '{"email": true, "sms": true}', true),
  -- Erik - linked to auth user, regular player who has paid
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-0000-0000-0000-000000000000', 'Erik Berkman', '+15555550002', 'erik@example.com', 'erik-pb', '{"email": true, "sms": false}', true),
  -- Sarah - linked to auth user, owns Couples & Competitive pools (uses berkman venmo for testing)
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'cccccccc-0000-0000-0000-000000000000', 'Sarah Johnson', '+15555550003', 'sarah@example.com', 'berkman', '{"email": true, "sms": true}', true),
  -- John - linked to auth user, has pending payment
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'dddddddd-0000-0000-0000-000000000000', 'John Smith', '+15555550004', 'john@example.com', 'john-pb', '{"email": true, "sms": false}', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', null, 'Lisa Chen', '+15555550005', 'lisa@example.com', 'lisa-pb', '{"email": true, "sms": true}', true),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', null, 'Tom Wilson', '+15555550006', 'tom@example.com', 'tom-pb', '{"email": false, "sms": true}', true),
  ('11111111-2222-3333-4444-555555555555', null, 'Amy Davis', '+15555550007', 'amy@example.com', 'amy-pb', '{"email": true, "sms": false}', true),
  ('22222222-3333-4444-5555-666666666666', null, 'Bob Martinez', '+15555550008', 'bob@example.com', 'bob-pb', '{"email": true, "sms": true}', true);

-- ============================================
-- POOLS (different owners to test non-owner experience)
-- ============================================

insert into pools (id, name, description, is_active, owner_id) values
  -- Mike owns these
  ('11111111-1111-1111-1111-111111111111', 'Weekend Warriors', 'Saturday morning pickleball crew', true, 'aaaaaaaa-0000-0000-0000-000000000000'),
  ('22222222-2222-2222-2222-222222222222', 'Friends & Family', 'Casual games with friends and family', true, 'aaaaaaaa-0000-0000-0000-000000000000'),
  -- Sarah owns these (Mike is just a member)
  ('33333333-3333-3333-3333-333333333333', 'Couples', 'Couples pickleball sessions', true, 'cccccccc-0000-0000-0000-000000000000'),
  ('44444444-4444-4444-4444-444444444444', 'Competitive', 'More competitive play', true, 'cccccccc-0000-0000-0000-000000000000');

-- ============================================
-- POOL PLAYERS (distribute players across pools)
-- ============================================
-- Note: Mike is automatically added to pools via the add_owner_to_pool trigger

-- Weekend Warriors pool (Mike added by trigger)
insert into pool_players (pool_id, player_id, is_active) values
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true), -- Erik
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true), -- Sarah
  ('11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', true); -- John

-- Friends & Family pool (Mike added by trigger)
insert into pool_players (pool_id, player_id, is_active) values
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true), -- Erik
  ('22222222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true), -- Lisa
  ('22222222-2222-2222-2222-222222222222', 'ffffffff-ffff-ffff-ffff-ffffffffffff', true); -- Tom

-- Couples pool (Sarah owns, Mike is a member)
insert into pool_players (pool_id, player_id, is_active) values
  ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true), -- Mike (member, not owner)
  ('33333333-3333-3333-3333-333333333333', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true), -- Lisa
  ('33333333-3333-3333-3333-333333333333', '11111111-2222-3333-4444-555555555555', true); -- Amy

-- Competitive pool (Sarah owns, Mike is a member)
insert into pool_players (pool_id, player_id, is_active) values
  ('44444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true), -- Mike (member, not owner)
  ('44444444-4444-4444-4444-444444444444', 'dddddddd-dddd-dddd-dddd-dddddddddddd', true), -- John
  ('44444444-4444-4444-4444-444444444444', 'ffffffff-ffff-ffff-ffff-ffffffffffff', true), -- Tom
  ('44444444-4444-4444-4444-444444444444', '22222222-3333-4444-5555-666666666666', true); -- Bob

-- ============================================
-- SESSION: Upcoming Saturday game (PROPOSED - open for signups)
-- ============================================

-- Scenario: Saturday 1pm, 5 players committed, roster NOT locked yet
-- No payments created yet - admin can lock roster to generate payments

insert into sessions (
  id, 
  pool_id, 
  proposed_date, 
  proposed_time, 
  duration_minutes,
  min_players,
  max_players,
  status,
  court_booking_ids,
  court_numbers,
  court_location,
  courts_needed,
  admin_cost_per_court,
  guest_pool_per_court,
  payment_deadline,
  roster_locked
) values (
  'aaaaaaaa-1111-2222-3333-444444444444',
  '11111111-1111-1111-1111-111111111111',
  CURRENT_DATE + interval '3 days',  -- Upcoming session
  '13:00',
  60,
  4,
  7,
  'proposed',
  null,
  null,
  'Pickle Shack',
  1,
  9.00,
  48.00,
  null,
  false  -- roster NOT locked - can still sign up
);

-- ============================================
-- SESSION PARTICIPANTS
-- ============================================

-- 6 committed (Mike + 5 guests), 2 on waitlist
-- Note: Mike is automatically added as admin by the add_admin_to_session trigger
-- Roster is NOT locked, so all statuses are 'committed' or 'maybe' (no 'paid' yet)
insert into session_participants (id, session_id, player_id, is_admin, status, waitlist_position) values
  -- Committed players (Mike added by trigger)
  ('a2222222-2222-2222-2222-222222222222', 'aaaaaaaa-1111-2222-3333-444444444444', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false, 'committed', null),  -- Erik
  ('a3333333-3333-3333-3333-333333333333', 'aaaaaaaa-1111-2222-3333-444444444444', 'cccccccc-cccc-cccc-cccc-cccccccccccc', false, 'committed', null),  -- Sarah
  ('a4444444-4444-4444-4444-444444444444', 'aaaaaaaa-1111-2222-3333-444444444444', 'dddddddd-dddd-dddd-dddd-dddddddddddd', false, 'committed', null),  -- John
  -- Waitlist
  ('a7777777-7777-7777-7777-777777777777', 'aaaaaaaa-1111-2222-3333-444444444444', '11111111-2222-3333-4444-555555555555', false, 'maybe', 1);         -- Amy (waitlist #1)

-- No payments yet for the upcoming session - roster not locked!

-- ============================================
-- SECOND SESSION: Past completed session (with payments)
-- ============================================

insert into sessions (
  id, 
  pool_id, 
  proposed_date, 
  proposed_time, 
  duration_minutes,
  min_players,
  max_players,
  status,
  court_booking_ids,
  court_numbers,
  court_location,
  courts_needed,
  admin_cost_per_court,
  guest_pool_per_court,
  roster_locked
) values (
  'bbbbbbbb-1111-2222-3333-444444444444',
  '11111111-1111-1111-1111-111111111111',
  CURRENT_DATE - interval '7 days',  -- Last Saturday
  '13:00',
  60,
  4,
  7,
  'completed',
  ARRAY['CR-11111'],
  ARRAY['Court 5'],
  'Pickle Shack',
  1,
  9.00,
  48.00,
  true
);

-- Participants for past session (4 players, Mike added by trigger)
insert into session_participants (id, session_id, player_id, is_admin, status) values
  ('b2222222-2222-2222-2222-222222222222', 'bbbbbbbb-1111-2222-3333-444444444444', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false, 'paid'),  -- Erik
  ('b3333333-3333-3333-3333-333333333333', 'bbbbbbbb-1111-2222-3333-444444444444', 'cccccccc-cccc-cccc-cccc-cccccccccccc', false, 'paid'),  -- Sarah
  ('b4444444-4444-4444-4444-444444444444', 'bbbbbbbb-1111-2222-3333-444444444444', 'dddddddd-dddd-dddd-dddd-dddddddddddd', false, 'paid');  -- John

-- Payments for past session (all paid)
-- 4 total players, 3 guests: $48 / 3 = $16.00 each
insert into payments (session_participant_id, amount, status, venmo_payment_link, venmo_request_sent_at, payment_date) values
  ('b2222222-2222-2222-2222-222222222222', 16.00, 'paid', 'https://venmo.com/berkman?txn=pay&amount=16.00&note=Pickleball%20-%20Weekend%20Warriors%20-%20Last%20Sat%20%40%201%3A00%20PM', now() - interval '8 days', now() - interval '7 days'),
  ('b3333333-3333-3333-3333-333333333333', 16.00, 'paid', 'https://venmo.com/berkman?txn=pay&amount=16.00&note=Pickleball%20-%20Weekend%20Warriors%20-%20Last%20Sat%20%40%201%3A00%20PM', now() - interval '8 days', now() - interval '7 days'),
  ('b4444444-4444-4444-4444-444444444444', 16.00, 'paid', 'https://venmo.com/berkman?txn=pay&amount=16.00&note=Pickleball%20-%20Weekend%20Warriors%20-%20Last%20Sat%20%40%201%3A00%20PM', now() - interval '8 days', now() - interval '7 days');

-- ============================================
-- THIRD SESSION: Confirmed session in Couples pool (Sarah owns)
-- Mike has a pending payment here!
-- ============================================

insert into sessions (
  id, pool_id, proposed_date, proposed_time, duration_minutes,
  min_players, max_players, status, court_location, courts_needed,
  admin_cost_per_court, guest_pool_per_court, roster_locked
) values (
  'cccccccc-1111-2222-3333-444444444444',
  '33333333-3333-3333-3333-333333333333',  -- Couples pool (Sarah owns)
  CURRENT_DATE + interval '2 days',
  '10:00',
  60, 4, 6, 'confirmed', 'Community Center', 1, 9.00, 48.00, true
);

-- Sarah is added by trigger as admin
insert into session_participants (id, session_id, player_id, is_admin, status) values
  ('c2222222-2222-2222-2222-222222222222', 'cccccccc-1111-2222-3333-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false, 'committed'),  -- Mike (owes $)
  ('c3333333-3333-3333-3333-333333333333', 'cccccccc-1111-2222-3333-444444444444', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', false, 'paid'),       -- Lisa (paid)
  ('c4444444-4444-4444-4444-444444444444', 'cccccccc-1111-2222-3333-444444444444', '11111111-2222-3333-4444-555555555555', false, 'paid');       -- Amy (paid)

-- Payments: 4 players, 3 guests = $16 each
-- Mike has PENDING, Lisa and Amy paid
insert into payments (session_participant_id, amount, status, venmo_payment_link, venmo_request_sent_at, payment_date) values
  ('c2222222-2222-2222-2222-222222222222', 16.00, 'pending', 'https://venmo.com/berkman?txn=pay&amount=16.00&note=Pickleball%20-%20Couples%20-%20Fri%20Jan%2010%20%40%2010%3A00%20AM', now() - interval '1 day', null),
  ('c3333333-3333-3333-3333-333333333333', 16.00, 'paid', 'https://venmo.com/berkman?txn=pay&amount=16.00&note=Pickleball%20-%20Couples%20-%20Fri%20Jan%2010%20%40%2010%3A00%20AM', now() - interval '1 day', now() - interval '12 hours'),
  ('c4444444-4444-4444-4444-444444444444', 16.00, 'paid', 'https://venmo.com/berkman?txn=pay&amount=16.00&note=Pickleball%20-%20Couples%20-%20Fri%20Jan%2010%20%40%2010%3A00%20AM', now() - interval '1 day', now() - interval '10 hours');

-- ============================================
-- FOURTH SESSION: Open session in Competitive pool
-- Mike can join this one!
-- ============================================

insert into sessions (
  id, pool_id, proposed_date, proposed_time, duration_minutes,
  min_players, max_players, status, court_location, courts_needed,
  admin_cost_per_court, guest_pool_per_court, roster_locked
) values (
  'dddddddd-1111-2222-3333-444444444444',
  '44444444-4444-4444-4444-444444444444',  -- Competitive pool (Sarah owns)
  CURRENT_DATE + interval '5 days',
  '18:00',
  90, 4, 8, 'proposed', 'Sports Complex', 2, 9.00, 48.00, false
);

-- Sarah added by trigger, John and Tom committed (Mike can still join!)
insert into session_participants (id, session_id, player_id, is_admin, status) values
  ('d2222222-2222-2222-2222-222222222222', 'dddddddd-1111-2222-3333-444444444444', 'dddddddd-dddd-dddd-dddd-dddddddddddd', false, 'committed'),  -- John
  ('d3333333-3333-3333-3333-333333333333', 'dddddddd-1111-2222-3333-444444444444', 'ffffffff-ffff-ffff-ffff-ffffffffffff', false, 'committed');  -- Tom

-- ============================================
-- FIFTH SESSION: Confirmed session where Erik has paid
-- (so Erik can see "Paid" badge on dashboard)
-- ============================================

insert into sessions (
  id, pool_id, proposed_date, proposed_time, duration_minutes,
  min_players, max_players, status, court_location, courts_needed,
  admin_cost_per_court, guest_pool_per_court, roster_locked
) values (
  'eeeeeeee-1111-2222-3333-444444444444',
  '22222222-2222-2222-2222-222222222222',  -- Friends & Family (Mike owns)
  CURRENT_DATE + interval '4 days',
  '14:00',
  60, 4, 6, 'confirmed', 'Pickle Shack', 1, 9.00, 48.00, true
);

-- Mike added by trigger as admin
insert into session_participants (id, session_id, player_id, is_admin, status) values
  ('e2222222-2222-2222-2222-222222222222', 'eeeeeeee-1111-2222-3333-444444444444', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false, 'paid'),  -- Erik (paid!)
  ('e3333333-3333-3333-3333-333333333333', 'eeeeeeee-1111-2222-3333-444444444444', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', false, 'paid'),  -- Lisa
  ('e4444444-4444-4444-4444-444444444444', 'eeeeeeee-1111-2222-3333-444444444444', 'ffffffff-ffff-ffff-ffff-ffffffffffff', false, 'committed');  -- Tom (pending)

-- Payments: 4 players, 3 guests = $16 each
insert into payments (session_participant_id, amount, status, venmo_payment_link, venmo_request_sent_at, payment_date) values
  ('e2222222-2222-2222-2222-222222222222', 16.00, 'paid', 'https://venmo.com/berkman?txn=pay&amount=16.00&note=Pickleball%20-%20Friends%20%26%20Family%20-%20Sun%20Jan%2012%20%40%202%3A00%20PM', now() - interval '2 days', now() - interval '1 day'),
  ('e3333333-3333-3333-3333-333333333333', 16.00, 'paid', 'https://venmo.com/berkman?txn=pay&amount=16.00&note=Pickleball%20-%20Friends%20%26%20Family%20-%20Sun%20Jan%2012%20%40%202%3A00%20PM', now() - interval '2 days', now() - interval '1 day'),
  ('e4444444-4444-4444-4444-444444444444', 16.00, 'pending', 'https://venmo.com/berkman?txn=pay&amount=16.00&note=Pickleball%20-%20Friends%20%26%20Family%20-%20Sun%20Jan%2012%20%40%202%3A00%20PM', now() - interval '2 days', null);

-- ============================================
-- TEST USERS SUMMARY
-- ============================================
-- 
-- mike@berkman.co:
--   - Owns: Weekend Warriors, Friends & Family
--   - Member of: Couples, Competitive
--   - Sessions: Hosting upcoming (Weekend Warriors), Hosting confirmed (Friends & Family)
--   - Payments: Owes $16 to Sarah (Couples session)
--   - Can Join: Competitive session
--
-- erik@example.com:
--   - Member of: Weekend Warriors, Friends & Family
--   - Sessions: Committed to Weekend Warriors, PAID for Friends & Family
--   - Payments: All paid!
--
-- sarah@example.com:
--   - Owns: Couples, Competitive
--   - Member of: Weekend Warriors
--   - Sessions: Hosting Couples (confirmed), Hosting Competitive (open)
--   - Payments: None (she's the host)
--
-- john@example.com:
--   - Member of: Weekend Warriors, Competitive
--   - Sessions: Committed to Weekend Warriors, Competitive
--   - Payments: None yet (sessions not locked or he's not in locked ones)
--

-- ============================================
-- TEST QUERIES
-- ============================================

-- Run these to verify the data looks right:

-- 1. Get session with participant count
/*
select 
  s.id,
  s.proposed_date,
  s.proposed_time,
  s.status,
  s.court_numbers,
  count(sp.id) filter (where sp.status in ('committed', 'paid')) as committed,
  count(sp.id) filter (where sp.status = 'maybe') as waitlist
from sessions s
left join session_participants sp on s.id = sp.session_id
group by s.id
order by s.proposed_date;
*/

-- 2. Get cost summary for upcoming session
/*
select * from get_session_cost_summary('aaaaaaaa-1111-2222-3333-444444444444');
-- Should return: total_players=6, guest_count=5, courts_needed=1, guest_cost=9.60
*/

-- 3. Get payment dashboard for upcoming session
/*
select 
  p.name,
  p.venmo_account,
  sp.is_admin,
  sp.status as participant_status,
  pay.amount,
  pay.status as payment_status
from session_participants sp
join players p on sp.player_id = p.id
left join payments pay on sp.id = pay.session_participant_id
where sp.session_id = 'aaaaaaaa-1111-2222-3333-444444444444'
  and sp.status in ('committed', 'paid')
order by sp.is_admin desc, p.name;
*/

-- 4. Who hasn't paid yet?
/*
select p.name, p.venmo_account, pay.amount
from session_participants sp
join players p on sp.player_id = p.id
join payments pay on sp.id = pay.session_participant_id
where sp.session_id = 'aaaaaaaa-1111-2222-3333-444444444444'
  and pay.status = 'pending';
-- Should return: John
*/

-- 5. Get waitlist
/*
select p.name, sp.waitlist_position
from session_participants sp
join players p on sp.player_id = p.id
where sp.session_id = 'aaaaaaaa-1111-2222-3333-444444444444'
  and sp.status = 'maybe'
order by sp.waitlist_position;
-- Should return: Amy (1), Bob (2)
*/

