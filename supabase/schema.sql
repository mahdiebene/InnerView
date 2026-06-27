-- ───────────────────────────────────────────────────────────────
-- InnerView — Supabase schema + Row-Level Security
-- Run this in the Supabase SQL editor (Project → SQL → New query).
-- See SETUP.md for the full walkthrough.
-- ─────────────────────────────────────────────────────────────--

-- Extensions
create extension if not exists "pgcrypto";

-- ───────────────────────────────────────────────────────────────
-- profiles: per-user crypto metadata (1 row per auth user)
--   salt          — Argon2id salt (base64), public
--   wrapped_key   — master key encrypted with the user's Pollinations
--                   key (recovery path); base64 {ct,iv} as jsonb
--   wrap_iv       — kept inside wrapped_key jsonb, duplicated for index-free reads
-- Everything here is ciphertext/metadata. NO journal plaintext, and
-- NO unwrapped master key, is ever stored.
-- ───────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  salt text not null,                 -- base64 Argon2id salt
  wrapped_key jsonb,                  -- { "ct": "...", "iv": "..." } | null
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A user can read / write only their own profile row.
create policy "profiles_self_read" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_self_upsert" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id);

-- ───────────────────────────────────────────────────────────────
-- entries: encrypted journal entries (ciphertext only)
--   id            — client-generated entry id (text)
--   user_id       — owner (FK to auth.users)
--   ct            — base64 AES-GCM ciphertext of the full entry JSON
--   iv            — base64 nonce for that ciphertext
--   updated_at    — last-write-wins merge key (epoch ms as bigint)
-- ───────────────────────────────────────────────────────────────
create table if not exists public.entries (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  ct text not null,                   -- base64 ciphertext
  iv text not null,                   -- base64 IV
  updated_at bigint not null,         -- epoch ms
  created_at bigint not null,         -- epoch ms (for ordering without decrypting)
  primary key (user_id, id)
);

alter table public.entries enable row level security;

create policy "entries_self_read" on public.entries
  for select using (auth.uid() = user_id);
create policy "entries_self_upsert" on public.entries
  for insert with check (auth.uid() = user_id);
create policy "entries_self_update" on public.entries
  for update using (auth.uid() = user_id);
create policy "entries_self_delete" on public.entries
  for delete using (auth.uid() = user_id);

-- Index for fast "list all my entries newest-first" without decryption.
create index if not exists entries_user_created_idx
  on public.entries (user_id, created_at desc);

-- Updated_at trigger for profiles.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
