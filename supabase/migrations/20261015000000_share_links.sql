-- Read-only public links to a week (meals, recipes, optional shopping list) or a single recipe.
-- The token is the secret; the public page reads with the service role, so no anon policies are needed.
create table share_links (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  plan_id uuid references meal_plans on delete cascade,
  recipe_id uuid references recipes on delete cascade,
  include_list boolean not null default true,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check ((plan_id is null) <> (recipe_id is null))
);
create index share_links_owner_idx on share_links(user_id, plan_id, recipe_id) where revoked_at is null;

alter table share_links enable row level security;
create policy "own rows" on share_links for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
