-- ============================================
-- Initial Database Schema
-- ============================================
-- This migration creates the complete database schema from scratch.
-- All tables, types, functions, triggers, indexes, and RLS policies.
-- 
-- Note: RLS policies are already fixed (no recursion) based on lessons learned.
-- ============================================

-- Extensions
-- Note: Supabase uses gen_random_uuid() (built-in PostgreSQL function) instead of uuid_generate_v4()
-- pgcrypto is needed for gen_random_bytes() used in registration_links tokens
create extension if not exists "pgcrypto";

-- ============================================
-- ENUMS
-- ============================================

create type session_status as enum ('proposed', 'confirmed', 'cancelled', 'completed');
create type participant_status as enum ('committed', 'paid', 'maybe', 'out');
create type payment_status as enum ('pending', 'paid', 'refunded', 'forgiven');

-- ============================================
-- FUNCTIONS (needed before tables)
-- ============================================

-- Generate registration token (needed for registration_links table default)
create or replace function generate_registration_token()
returns text as $$
begin
  return encode(gen_random_bytes(32), 'hex');
end;
$$ language plpgsql;

-- ============================================
-- TABLES
-- ============================================

-- Pools (Groups of players)
create table pools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid references auth.users(id) on delete set null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Pool Admins (junction table for multi-admin support - future)
create table pool_admins (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid references pools(id) on delete cascade not null,
  admin_id uuid references auth.users(id) on delete cascade not null,
  is_active boolean default true,
  added_at timestamptz default now(),
  unique(pool_id, admin_id)
);

-- Players (people who play pickleball)
create table players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null unique,
  name text not null,
  phone text,
  email text,
  venmo_account text not null,
  notification_preferences jsonb default '{"email": true, "sms": false}'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Pool Players (junction table: which players belong to which pools)
create table pool_players (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid references pools(id) on delete cascade not null,
  player_id uuid references players(id) on delete cascade not null,
  is_active boolean default true,
  joined_at timestamptz default now(),
  unique(pool_id, player_id)
);

-- Registration Links (one-time use tokens for joining pools)
create table registration_links (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid references pools(id) on delete cascade not null,
  token text unique not null default generate_registration_token(),
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz default (now() + interval '30 days'),
  used_at timestamptz,
  used_by uuid references players(id) on delete set null,
  created_at timestamptz default now()
);

-- Sessions (proposed game times)
create table sessions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid references pools(id) on delete cascade not null,
  
  -- Date/time
  proposed_date date not null,
  proposed_time time not null,
  duration_minutes integer default 60 check (duration_minutes > 0 and duration_minutes % 30 = 0),
  
  -- Player limits
  min_players integer default 4 check (min_players >= 4),
  max_players integer default 7 check (max_players >= min_players),
  
  -- Status
  status session_status default 'proposed',
  
  -- Court booking (arrays for multiple adjacent courts)
  court_booking_ids text[],
  court_numbers text[],
  court_location text,
  courts_needed integer default 1 check (courts_needed >= 1),
  
  -- Cost fields
  admin_cost_per_court decimal(10,2) default 9.00,
  guest_pool_per_court decimal(10,2) default 48.00,
  
  -- Payment deadline (when roster locks and payments are requested)
  payment_deadline timestamptz,
  roster_locked boolean default false,
  
  -- Future: recurring sessions
  is_recurring boolean default false,
  recurring_pattern jsonb,
  
  -- Metadata
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Session Participants (who's in/out for each session)
create table session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null,
  player_id uuid references players(id) on delete cascade not null,
  
  -- Is this the admin? (Admin always plays, no payment record)
  is_admin boolean default false,
  
  -- Status
  status participant_status default 'committed',
  status_changed_at timestamptz default now(),
  opted_in_at timestamptz default now(),
  
  -- Waitlist position (null if not on waitlist)
  waitlist_position integer,
  
  unique(session_id, player_id)
);

-- Payments (track Venmo payments - guests only, not admin)
create table payments (
  id uuid primary key default gen_random_uuid(),
  session_participant_id uuid references session_participants(id) on delete cascade not null,
  
  -- Amount
  amount decimal(10,2) not null,
  
  -- Payment method
  payment_method text default 'venmo' check (payment_method in ('venmo', 'stripe')),
  venmo_transaction_id text,
  venmo_payment_link text,
  
  -- Timestamps
  venmo_request_sent_at timestamptz,
  payment_date timestamptz,
  refunded_at timestamptz,
  
  -- Status
  status payment_status default 'pending',
  
  -- Dropout handling
  replacement_found boolean default false,
  
  notes text,
  created_at timestamptz default now()
);

-- ============================================
-- INDEXES
-- ============================================

create index idx_pools_owner on pools(owner_id);
create index idx_pools_active on pools(is_active) where is_active = true;

create index idx_players_user on players(user_id);
create index idx_players_venmo on players(venmo_account);

create index idx_pool_players_pool on pool_players(pool_id);
create index idx_pool_players_player on pool_players(player_id);

create index idx_registration_links_token on registration_links(token);
create index idx_registration_links_pool on registration_links(pool_id);

create index idx_sessions_pool on sessions(pool_id);
create index idx_sessions_date on sessions(proposed_date);
create index idx_sessions_status on sessions(status);

create index idx_session_participants_session on session_participants(session_id);
create index idx_session_participants_player on session_participants(player_id);
create index idx_session_participants_status on session_participants(status);

create index idx_payments_participant on payments(session_participant_id);
create index idx_payments_status on payments(status);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Calculate courts needed based on player count
-- 4-7 players = 1 court, 8-11 = 2 courts, etc.
create or replace function calculate_courts_needed(player_count integer)
returns integer as $$
begin
  if player_count < 4 then
    return 0;
  end if;
  return greatest(1, ceil((player_count - 3)::decimal / 4)::integer);
end;
$$ language plpgsql immutable;

-- Get session cost summary
create or replace function get_session_cost_summary(p_session_id uuid)
returns table (
  total_players integer,
  guest_count integer,
  courts_needed integer,
  admin_cost decimal,
  guest_pool decimal,
  guest_cost decimal
) as $$
declare
  v_admin_cost_per_court decimal;
  v_guest_pool_per_court decimal;
  v_total integer;
  v_guests integer;
  v_courts integer;
begin
  -- Get session rates
  select s.admin_cost_per_court, s.guest_pool_per_court 
  into v_admin_cost_per_court, v_guest_pool_per_court
  from sessions s where s.id = p_session_id;
  
  -- Count players
  select 
    count(*) filter (where sp.status in ('committed', 'paid')),
    count(*) filter (where sp.status in ('committed', 'paid') and not sp.is_admin)
  into v_total, v_guests
  from session_participants sp
  where sp.session_id = p_session_id;
  
  -- Calculate courts
  v_courts := calculate_courts_needed(v_total);
  
  return query select
    v_total as total_players,
    v_guests as guest_count,
    v_courts as courts_needed,
    (v_admin_cost_per_court * v_courts) as admin_cost,
    (v_guest_pool_per_court * v_courts) as guest_pool,
    case when v_guests > 0 
      then (v_guest_pool_per_court * v_courts) / v_guests
      else 0::decimal
    end as guest_cost;
end;
$$ language plpgsql stable;

-- ============================================
-- TRIGGERS
-- ============================================

create trigger update_pools_updated_at
  before update on pools
  for each row execute function update_updated_at();

create trigger update_players_updated_at
  before update on players
  for each row execute function update_updated_at();

create trigger update_sessions_updated_at
  before update on sessions
  for each row execute function update_updated_at();

-- Update participant status timestamp
create or replace function update_participant_status_changed()
returns trigger as $$
begin
  if old.status is distinct from new.status then
    new.status_changed_at = now();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger update_participant_status_timestamp
  before update on session_participants
  for each row execute function update_participant_status_changed();

-- Auto-set owner_id from auth.uid() when creating a pool
create or replace function set_pool_owner()
returns trigger as $$
begin
  if new.owner_id is null then
    new.owner_id = auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger set_pool_owner_on_insert
  before insert on pools
  for each row execute function set_pool_owner();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

alter table pools enable row level security;
alter table pool_admins enable row level security;
alter table players enable row level security;
alter table pool_players enable row level security;
alter table registration_links enable row level security;
alter table sessions enable row level security;
alter table session_participants enable row level security;
alter table payments enable row level security;

-- Pools: owners can view (simplified to avoid recursion)
-- Note: RLS policies are already fixed (no recursion) based on lessons learned
create policy "Users can view their pools" on pools
  for select using (
    -- Direct owner check (no recursion)
    owner_id = auth.uid()
  );

create policy "Owners can update their pools" on pools
  for update using (owner_id = auth.uid());

create policy "Authenticated users can create pools" on pools
  for insert with check (auth.uid() is not null);

-- Players: users can view players in their pools
-- Note: RLS policy is already fixed (no recursion) based on lessons learned
create policy "Users can view players in their pools" on players
  for select using (
    -- User's own player record
    user_id = auth.uid()
    -- OR players in pools owned by the user (no recursion - uses pools table only)
    or id in (
      select pp.player_id 
      from pool_players pp
      join pools p on pp.pool_id = p.id
      where p.owner_id = auth.uid()
    )
  );

create policy "Users can update their own player" on players
  for update using (user_id = auth.uid());

-- Sessions: pool members can view
create policy "Pool members can view sessions" on sessions
  for select using (
    pool_id in (
      select pp.pool_id from pool_players pp
      join players p on pp.player_id = p.id
      where p.user_id = auth.uid()
    )
  );

-- Session participants: pool members can view, players can update their own
create policy "Pool members can view participants" on session_participants
  for select using (
    session_id in (
      select s.id from sessions s
      where s.pool_id in (
        select pp.pool_id from pool_players pp
        join players p on pp.player_id = p.id
        where p.user_id = auth.uid()
      )
    )
  );

create policy "Players can update their own participation" on session_participants
  for update using (
    player_id in (
      select id from players where user_id = auth.uid()
    )
  );

-- Payments: players can view their own
create policy "Players can view their payments" on payments
  for select using (
    session_participant_id in (
      select sp.id from session_participants sp
      join players p on sp.player_id = p.id
      where p.user_id = auth.uid()
    )
  );

