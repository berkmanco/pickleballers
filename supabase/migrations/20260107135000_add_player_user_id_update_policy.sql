-- Allow users to update player records to link them to their account
-- This is needed to link player records created during registration to user accounts after sign-in

-- Drop the existing restrictive policy
drop policy if exists "Users can update their own player" on players;

-- Allow users to update player records where:
-- 1. They're already linked (user_id = auth.uid()), OR
-- 2. They're linking an unlinked record (user_id is null) and setting it to their own ID
create policy "Users can update their own player" on players
  for update 
  using (
    user_id = auth.uid()  -- Already linked to them
    or user_id is null    -- Not yet linked (can link by email)
  )
  with check (
    -- Can only set user_id to their own ID
    user_id = auth.uid()
  );

