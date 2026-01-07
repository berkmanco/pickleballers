-- Add slug field to pools for short, shareable URLs
-- Slugs are generated from pool names (lowercase, spaces to hyphens, special chars removed)

-- Function to generate slug from text
create or replace function generate_slug(input_text text)
returns text as $$
begin
  return lower(
    regexp_replace(
      regexp_replace(
        trim(input_text),
        '[^a-zA-Z0-9\s-]', '', 'g'  -- Remove special chars
      ),
      '\s+', '-', 'g'  -- Replace spaces with hyphens
    )
  );
end;
$$ language plpgsql immutable;

-- Add slug column
alter table pools add column slug text unique;

-- Create index for fast lookups
create index idx_pools_slug on pools(slug) where slug is not null;

-- Function to auto-generate slug from name
create or replace function set_pool_slug()
returns trigger as $$
begin
  -- Only set slug if it's null or empty
  if new.slug is null or new.slug = '' then
    new.slug = generate_slug(new.name);
    
    -- Ensure uniqueness by appending number if needed
    declare
      base_slug text := new.slug;
      counter integer := 1;
      final_slug text;
    begin
      final_slug := base_slug;
      while exists (select 1 from pools where slug = final_slug and id != coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)) loop
        final_slug := base_slug || '-' || counter;
        counter := counter + 1;
      end loop;
      new.slug := final_slug;
    end;
  end if;
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-generate slug on insert/update
create trigger set_pool_slug_on_change
  before insert or update on pools
  for each row execute function set_pool_slug();

-- Backfill existing pools with slugs
update pools set slug = generate_slug(name) where slug is null;

-- Make slug not null after backfill
alter table pools alter column slug set not null;

