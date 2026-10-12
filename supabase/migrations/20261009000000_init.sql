-- Ben's Meals: initial schema. Every table is owned by one auth user and guarded by RLS.

create extension if not exists "pgcrypto";

create type meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type store as enum ('woolworths', 'coles', 'aldi', 'iga');
create type recipe_source as enum ('generated', 'web', 'imported', 'manual');
create type plan_status as enum ('generating', 'ready', 'failed', 'archived');

-- ---------------------------------------------------------------- settings
create table settings (
  user_id uuid primary key references auth.users on delete cascade default auth.uid(),
  weekly_budget numeric(8,2) not null default 150,
  store store not null default 'woolworths',
  postcode text,
  -- { "mon": ["breakfast","lunch","dinner"], ... }
  meal_grid jsonb not null default '{
    "mon":["breakfast","lunch","dinner","snack"],"tue":["breakfast","lunch","dinner","snack"],
    "wed":["breakfast","lunch","dinner","snack"],"thu":["breakfast","lunch","dinner","snack"],
    "fri":["breakfast","lunch","dinner","snack"],"sat":["breakfast","lunch","dinner","snack"],
    "sun":["breakfast","lunch","dinner","snack"]}'::jsonb,
  leftover_nights text[] not null default '{}',
  max_weeknight_minutes int not null default 45,
  max_difficulty int not null default 4 check (max_difficulty between 1 and 5),
  equipment text[] not null default '{oven,stovetop,microwave}',
  cuisines text[] not null default '{}',
  prep_day text,                       -- e.g. 'sun' for a meal-prep session
  meal_prep_lunches boolean not null default false,
  plan_mode text not null default 'generate' check (plan_mode in ('generate','find')),
  extra_notes text,
  dinner_time text not null default '18:30',
  timezone text not null default 'Australia/Sydney',
  calendar_token uuid not null default gen_random_uuid() unique,
  onboarded boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- eaters
create table eaters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  name text not null,
  age_group text not null default 'adult' check (age_group in ('adult','teen','child','toddler')),
  appetite numeric(3,2) not null default 1.0,
  kcal_target int,
  protein_target int,
  allergies text[] not null default '{}',   -- hard exclusions
  dislikes text[] not null default '{}',    -- soft exclusions
  diet text,                                -- vegetarian, vegan, halal, pescatarian...
  meals meal_type[] not null default '{breakfast,lunch,dinner,snack}',
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- recipes
create table recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  title text not null,
  description text,
  meal_type meal_type not null,
  cuisine text,
  servings int not null default 2,
  prep_minutes int not null default 10,
  cook_minutes int not null default 20,
  difficulty int not null default 2 check (difficulty between 1 and 5),
  meal_prep_friendly boolean not null default false,
  freezer_friendly boolean not null default false,
  fridge_days int not null default 3,
  -- per serve
  kcal int, protein_g int, carbs_g int, fat_g int,
  est_cost numeric(8,2),                    -- whole recipe, ingredient share only
  -- [{ name, qty, unit, aisle, note, pack_hint }]
  ingredients jsonb not null default '[]',
  -- [{ text, minutes? }]
  steps jsonb not null default '[]',
  tags text[] not null default '{}',
  source recipe_source not null default 'generated',
  source_url text,
  image_url text,
  created_at timestamptz not null default now()
);
create index recipes_user_idx on recipes(user_id, created_at desc);

create table recipe_feedback (
  recipe_id uuid primary key references recipes on delete cascade,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  favourite boolean not null default false,
  rating int check (rating between 1 and 5),
  never_again boolean not null default false,
  notes text,
  cooked_count int not null default 0,
  last_cooked date,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- plans
create table meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  week_start date not null,
  budget numeric(8,2) not null,
  store store not null default 'woolworths',
  status plan_status not null default 'generating',
  progress jsonb not null default '{}',     -- { stage, done, total, message }
  strategy text,                            -- Claude's shared-ingredient / budget notes
  est_total numeric(8,2),
  actual_total numeric(8,2),
  settings_snapshot jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index meal_plans_user_idx on meal_plans(user_id, week_start desc);

create table plan_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  plan_id uuid not null references meal_plans on delete cascade,
  day text not null check (day in ('mon','tue','wed','thu','fri','sat','sun')),
  meal_type meal_type not null,
  recipe_id uuid references recipes on delete set null,
  servings numeric(4,1) not null default 1,
  eater_ids uuid[] not null default '{}',
  locked boolean not null default false,
  skipped boolean not null default false,   -- eating out
  leftover_of uuid references plan_slots on delete set null,
  unique (plan_id, day, meal_type)
);

create table prep_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  plan_id uuid not null references meal_plans on delete cascade,
  day text not null,
  -- { total_minutes, containers, steps:[{ at_minute, text, recipe_ids }], storage:[{ recipe_id, where, eat_by_day }] }
  timeline jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- shopping
create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  plan_id uuid not null references meal_plans on delete cascade,
  item_key text not null,                   -- normalised name, joins to price_memory
  name text not null,
  qty numeric(10,2),
  unit text,
  aisle text not null default 'Other',
  pack text,                                -- "1kg bag"
  packs int not null default 1,
  est_price numeric(8,2),
  price_source text not null default 'estimate' check (price_source in ('estimate','memory','manual')),
  checked boolean not null default false,
  have_it boolean not null default false,
  recipe_ids uuid[] not null default '{}',
  unique (plan_id, item_key)
);

create table pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  item_key text not null,
  name text not null,
  qty numeric(10,2),
  unit text,
  is_staple boolean not null default false, -- always have (salt, oil...)
  expires_on date,
  updated_at timestamptz not null default now(),
  unique (user_id, item_key)
);

create table price_memory (
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  store store not null,
  item_key text not null,
  price numeric(8,2) not null,
  pack text,
  updated_at timestamptz not null default now(),
  primary key (user_id, store, item_key)
);

-- ---------------------------------------------------------------- push / reminders
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_label text,
  created_at timestamptz not null default now()
);

create table reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  plan_id uuid references meal_plans on delete cascade,
  kind text not null,                       -- plan_week | order_groceries | defrost | start_cooking | custom
  title text not null,
  body text,
  url text,
  fire_at timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index reminders_due_idx on reminders(fire_at) where sent_at is null;

-- ---------------------------------------------------------------- RLS
do $$
declare t text;
begin
  foreach t in array array['settings','eaters','recipes','recipe_feedback','meal_plans','plan_slots',
    'prep_sessions','shopping_items','pantry_items','price_memory','push_subscriptions','reminders']
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "own rows" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- Live progress for generation + shopping list ticks across devices
alter publication supabase_realtime add table meal_plans, shopping_items;
