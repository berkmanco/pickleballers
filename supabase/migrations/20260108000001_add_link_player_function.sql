-- Create a SECURITY DEFINER function to link player records to user accounts
-- This bypasses RLS since users can't see unlinked player records due to chicken-and-egg problem

create or replace function link_player_to_user(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_user_id uuid;
  v_existing_user_id uuid;
begin
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  
  -- Find player record by email (case-insensitive)
  select id, user_id into v_player_id, v_existing_user_id
  from players
  where lower(email) = lower(p_email);
  
  -- If no player found, return null
  if v_player_id is null then
    return null;
  end if;
  
  -- If already linked to this user, just return the id
  if v_existing_user_id = v_user_id then
    return v_player_id;
  end if;
  
  -- If linked to a different user, don't change it
  if v_existing_user_id is not null then
    return v_player_id;
  end if;
  
  -- Link to current user
  update players
  set user_id = v_user_id, updated_at = now()
  where id = v_player_id;
  
  return v_player_id;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function link_player_to_user(text) to authenticated;

