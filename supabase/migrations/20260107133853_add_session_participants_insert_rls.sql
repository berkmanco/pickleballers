-- RLS policy for session_participants INSERT
-- Players can opt themselves into sessions for pools they're members of

-- Use direct subquery pattern (same as sessions INSERT policy)
-- Check that player belongs to user and session belongs to a pool the player is in
create policy "Players can opt into sessions" on session_participants
  for insert with check (
    -- Player must exist and be linked to the current user
    player_id in (
      select id from players where user_id = auth.uid()
    )
    -- Session must belong to a pool the player is in
    -- Use direct subquery to avoid recursion (sessions SELECT policy allows pool members to see sessions)
    and session_id in (
      select s.id
      from sessions s
      where s.pool_id in (
        select pool_id
        from pool_players
        where player_id = session_participants.player_id
          and is_active = true
      )
    )
  );

