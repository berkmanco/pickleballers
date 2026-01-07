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

-- Note: In real usage, players would be linked to auth.users
-- For testing, we'll create players without auth links

-- ============================================
-- POOLS
-- ============================================

-- Insert pools first (owner_id will be set after we find Mike's user_id)
insert into pools (id, name, description, is_active, owner_id) values
  ('11111111-1111-1111-1111-111111111111', 'Weekend Warriors', 'Saturday morning pickleball crew', true, null),
  ('22222222-2222-2222-2222-222222222222', 'Friends & Family', 'Casual games with friends and family', true, null),
  ('33333333-3333-3333-3333-333333333333', 'Couples', 'Couples pickleball sessions', true, null),
  ('44444444-4444-4444-4444-444444444444', 'Competitive', 'More competitive play', true, null);

-- ============================================
-- PLAYERS
-- ============================================

insert into players (id, name, phone, email, venmo_account, notification_preferences, is_active) values
  -- Admin (Mike) - will be linked to auth user mike@berkman.co
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Mike Berkman', '555-0001', 'mike@berkman.co', '@mike-pb', '{"email": true, "sms": true}', true),
  -- Regular players
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Erik Berkman', '555-0002', 'erik@example.com', '@erik-pb', '{"email": true, "sms": false}', true),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Sarah Johnson', '555-0003', 'sarah@example.com', '@sarah-pb', '{"email": true, "sms": true}', true),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'John Smith', '555-0004', 'john@example.com', '@john-pb', '{"email": true, "sms": false}', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Lisa Chen', '555-0005', 'lisa@example.com', '@lisa-pb', '{"email": true, "sms": true}', true),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Tom Wilson', '555-0006', 'tom@example.com', '@tom-pb', '{"email": false, "sms": true}', true),
  ('11111111-2222-3333-4444-555555555555', 'Amy Davis', '555-0007', 'amy@example.com', '@amy-pb', '{"email": true, "sms": false}', true),
  ('22222222-3333-4444-5555-666666666666', 'Bob Martinez', '555-0008', 'bob@example.com', '@bob-pb', '{"email": true, "sms": true}', true);

-- ============================================
-- SET POOL OWNERS (Mike owns all pools)
-- ============================================
-- Link Mike's player record to auth user and set as owner of all pools
-- Note: This assumes mike@berkman.co exists in auth.users
-- If the user doesn't exist yet, pools will be created without owner_id
-- Run supabase/fix_mike_pools.sql after Mike signs up to fix this

do $$
declare
  mike_user_id uuid;
  mike_player_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
begin
  -- Try to find mike@berkman.co in auth.users
  select id into mike_user_id
  from auth.users
  where email = 'mike@berkman.co'
  limit 1;
  
  -- If user exists, link Mike's player record and set as owner of all pools
  if mike_user_id is not null then
    -- Link Mike's player to his auth user
    update players
    set user_id = mike_user_id
    where id = mike_player_id;
    
    -- Set Mike as owner of all pools
    update pools
    set owner_id = mike_user_id
    where owner_id is null;
    
    -- Ensure Mike is in all pools via pool_players
    insert into pool_players (pool_id, player_id, is_active)
    select id, mike_player_id, true
    from pools
    where id not in (
      select pool_id
      from pool_players
      where player_id = mike_player_id
    )
    on conflict (pool_id, player_id) do nothing;
  end if;
end $$;

-- ============================================
-- POOL PLAYERS (distribute players across pools)
-- ============================================

-- Weekend Warriors pool
insert into pool_players (pool_id, player_id, is_active) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true), -- Mike (admin)
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true), -- Erik
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true), -- Sarah
  ('11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', true); -- John

-- Friends & Family pool
insert into pool_players (pool_id, player_id, is_active) values
  ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true), -- Mike (admin)
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true), -- Erik
  ('22222222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true), -- Lisa
  ('22222222-2222-2222-2222-222222222222', 'ffffffff-ffff-ffff-ffff-ffffffffffff', true); -- Tom

-- Couples pool
insert into pool_players (pool_id, player_id, is_active) values
  ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true), -- Mike (admin)
  ('33333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true), -- Sarah
  ('33333333-3333-3333-3333-333333333333', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true), -- Lisa
  ('33333333-3333-3333-3333-333333333333', '11111111-2222-3333-4444-555555555555', true); -- Amy

-- Competitive pool
insert into pool_players (pool_id, player_id, is_active) values
  ('44444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true), -- Mike (admin)
  ('44444444-4444-4444-4444-444444444444', 'dddddddd-dddd-dddd-dddd-dddddddddddd', true), -- John
  ('44444444-4444-4444-4444-444444444444', 'ffffffff-ffff-ffff-ffff-ffffffffffff', true), -- Tom
  ('44444444-4444-4444-4444-444444444444', '22222222-3333-4444-5555-666666666666', true); -- Bob

-- ============================================
-- SESSION: Upcoming Saturday game
-- ============================================

-- Scenario: Saturday 1pm, 6 players committed, 2 on waitlist
-- Court already booked, payment deadline passed, some have paid

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
  CURRENT_DATE + interval '2 days',  -- Saturday (assuming running mid-week)
  '13:00',
  60,
  4,
  7,
  'confirmed',
  ARRAY['CR-12345'],
  ARRAY['Court 8'],
  'Pickle Shack',
  1,
  9.00,
  48.00,
  CURRENT_DATE + interval '1 day' + interval '13 hours',  -- 24h before session
  true  -- roster is locked
);

-- ============================================
-- SESSION PARTICIPANTS
-- ============================================

-- 6 committed (Mike + 5 guests), 2 on waitlist
insert into session_participants (id, session_id, player_id, is_admin, status, waitlist_position) values
  -- Committed players
  ('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-1111-2222-3333-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, 'committed', null),  -- Mike (admin)
  ('a2222222-2222-2222-2222-222222222222', 'aaaaaaaa-1111-2222-3333-444444444444', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false, 'paid', null),       -- Erik (paid)
  ('a3333333-3333-3333-3333-333333333333', 'aaaaaaaa-1111-2222-3333-444444444444', 'cccccccc-cccc-cccc-cccc-cccccccccccc', false, 'paid', null),       -- Sarah (paid)
  ('a4444444-4444-4444-4444-444444444444', 'aaaaaaaa-1111-2222-3333-444444444444', 'dddddddd-dddd-dddd-dddd-dddddddddddd', false, 'committed', null),  -- John (not paid yet)
  ('a5555555-5555-5555-5555-555555555555', 'aaaaaaaa-1111-2222-3333-444444444444', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', false, 'paid', null),       -- Lisa (paid)
  ('a6666666-6666-6666-6666-666666666666', 'aaaaaaaa-1111-2222-3333-444444444444', 'ffffffff-ffff-ffff-ffff-ffffffffffff', false, 'paid', null),       -- Tom (paid)
  -- Waitlist
  ('a7777777-7777-7777-7777-777777777777', 'aaaaaaaa-1111-2222-3333-444444444444', '11111111-2222-3333-4444-555555555555', false, 'maybe', 1),         -- Amy (waitlist #1)
  ('a8888888-8888-8888-8888-888888888888', 'aaaaaaaa-1111-2222-3333-444444444444', '22222222-3333-4444-5555-666666666666', false, 'maybe', 2);         -- Bob (waitlist #2)

-- ============================================
-- PAYMENTS (guests only, not Mike)
-- ============================================

-- 6 total players, 5 guests
-- Guest cost: $48 / 5 = $9.60 each

insert into payments (session_participant_id, amount, status, venmo_payment_link, venmo_request_sent_at, payment_date) values
  -- Erik - paid
  ('a2222222-2222-2222-2222-222222222222', 9.60, 'paid', 'venmo://paycharge?txn=pay&recipients=mike-pb&amount=9.60&note=Pickleball%20Sat', now() - interval '1 day', now() - interval '12 hours'),
  -- Sarah - paid
  ('a3333333-3333-3333-3333-333333333333', 9.60, 'paid', 'venmo://paycharge?txn=pay&recipients=mike-pb&amount=9.60&note=Pickleball%20Sat', now() - interval '1 day', now() - interval '10 hours'),
  -- John - pending (hasn't paid yet!)
  ('a4444444-4444-4444-4444-444444444444', 9.60, 'pending', 'venmo://paycharge?txn=pay&recipients=mike-pb&amount=9.60&note=Pickleball%20Sat', now() - interval '1 day', null),
  -- Lisa - paid
  ('a5555555-5555-5555-5555-555555555555', 9.60, 'paid', 'venmo://paycharge?txn=pay&recipients=mike-pb&amount=9.60&note=Pickleball%20Sat', now() - interval '1 day', now() - interval '8 hours'),
  -- Tom - paid
  ('a6666666-6666-6666-6666-666666666666', 9.60, 'paid', 'venmo://paycharge?txn=pay&recipients=mike-pb&amount=9.60&note=Pickleball%20Sat', now() - interval '1 day', now() - interval '6 hours');

-- ============================================
-- SECOND SESSION: Past completed session
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
  true
);

-- Participants for past session (4 players)
insert into session_participants (session_id, player_id, is_admin, status) values
  ('bbbbbbbb-1111-2222-3333-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, 'paid'),   -- Mike
  ('bbbbbbbb-1111-2222-3333-444444444444', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false, 'paid'),  -- Erik
  ('bbbbbbbb-1111-2222-3333-444444444444', 'cccccccc-cccc-cccc-cccc-cccccccccccc', false, 'paid'),  -- Sarah
  ('bbbbbbbb-1111-2222-3333-444444444444', 'dddddddd-dddd-dddd-dddd-dddddddddddd', false, 'paid');  -- John

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

