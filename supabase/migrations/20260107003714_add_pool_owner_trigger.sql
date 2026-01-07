-- Auto-set owner_id from auth.uid() when creating a pool
-- This ensures owner_id is always set correctly from the authenticated user
-- without needing to pass it from the client

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

