-- CareerPrep AI — Supabase schema
-- Applied by `npm run setup` (supabase db push), or paste into the SQL editor. Idempotent.

-- ---------------------------------------------------------------------------
-- Profiles: one row per auth user. `plan` is written ONLY by the server
-- (Stripe webhook / verify route via the service role) — users can't upgrade
-- themselves because there is no UPDATE policy for them.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  plan_expires_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_subscription_idx on public.profiles (stripe_subscription_id);

alter table public.profiles enable row level security;
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles for select using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Saved ATS audits
-- ---------------------------------------------------------------------------
create table if not exists public.resume_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_path text not null,
  file_name text not null,
  overall_score int not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists resume_reviews_user_idx on public.resume_reviews (user_id, created_at desc);

alter table public.resume_reviews enable row level security;
drop policy if exists "reviews: read own" on public.resume_reviews;
drop policy if exists "reviews: insert own" on public.resume_reviews;
drop policy if exists "reviews: delete own" on public.resume_reviews;
create policy "reviews: read own" on public.resume_reviews for select using (auth.uid() = user_id);
create policy "reviews: insert own" on public.resume_reviews for insert with check (auth.uid() = user_id);
create policy "reviews: delete own" on public.resume_reviews for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Interview evaluations
-- ---------------------------------------------------------------------------
create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  plan text not null,
  overall_score int not null,
  report jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists interviews_user_idx on public.interviews (user_id, created_at desc);

alter table public.interviews enable row level security;
drop policy if exists "interviews: read own" on public.interviews;
drop policy if exists "interviews: insert own" on public.interviews;
create policy "interviews: read own" on public.interviews for select using (auth.uid() = user_id);
create policy "interviews: insert own" on public.interviews for insert with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage: private `resumes` bucket, one folder per user (<uid>/<file>.pdf)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "resumes: upload own" on storage.objects;
drop policy if exists "resumes: read own" on storage.objects;
drop policy if exists "resumes: delete own" on storage.objects;
create policy "resumes: upload own" on storage.objects for insert
  with check (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "resumes: read own" on storage.objects for select
  using (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "resumes: delete own" on storage.objects for delete
  using (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);
