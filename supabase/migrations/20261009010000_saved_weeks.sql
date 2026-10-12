-- Saved weeks: a named snapshot of a plan's meals (and prep timeline) that can be loaded into any week.
create table saved_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  name text not null,
  budget numeric(8,2),
  est_total numeric(8,2),
  strategy text,
  -- [{ day, meal_type, recipe_id, servings, eater_ids, skipped, leftover_of: "day|meal_type" | null }]
  slots jsonb not null default '[]',
  prep_timeline jsonb,
  created_at timestamptz not null default now()
);
create index saved_weeks_user_idx on saved_weeks(user_id, created_at desc);

alter table saved_weeks enable row level security;
create policy "own rows" on saved_weeks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
