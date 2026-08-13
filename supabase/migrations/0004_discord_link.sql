-- Direct Discord <-> REINChat account linking, mirroring the existing
-- Discord <-> ReinAI link pattern (see reinai-discord-bot's DiscordLink /
-- DiscordVerificationCode). Independent of any ReinAI link — a user can
-- connect Discord straight to their REINChat account via the bot's
-- /verify-reinchat command.

create table public.discord_verification_codes (
  code             text primary key,
  discord_id       text not null,
  discord_username text not null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null
);

create index discord_verification_codes_discord_id_idx on public.discord_verification_codes (discord_id);

-- No client-facing RLS needed: only the bot (service role, via
-- /api/discord-link/start) ever writes here, and the confirming user reads
-- it by an unguessable code, server-side, via the service role too.
alter table public.discord_verification_codes enable row level security;

create table public.discord_links (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references public.profiles(id) on delete cascade,
  discord_id       text not null unique,
  discord_username text not null,
  linked_at        timestamptz not null default now(),
  notified_at      timestamptz
);

alter table public.discord_links enable row level security;

create policy "users can read their own discord link"
  on public.discord_links for select to authenticated
  using (user_id = auth.uid());

create policy "users can remove their own discord link"
  on public.discord_links for delete to authenticated
  using (user_id = auth.uid());

create policy "admins can read all discord links"
  on public.discord_links for select to authenticated
  using (public.is_admin(auth.uid()));

-- Security-definer: a plain client-side insert can't safely replace a
-- stale link on the *other* side (the same Discord account previously
-- linked to a different REINChat user) since RLS only lets a user delete
-- their own row. This does the whole "replace either side, consume the
-- code" swap atomically, mirroring ReinAI's equivalent DiscordLink flow.
create or replace function public.confirm_discord_link(code_input text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  rec record;
begin
  select * into rec from public.discord_verification_codes where code = code_input;
  if not found or rec.expires_at < now() then
    raise exception 'code_expired';
  end if;

  delete from public.discord_links where user_id = auth.uid() or discord_id = rec.discord_id;

  insert into public.discord_links (user_id, discord_id, discord_username)
  values (auth.uid(), rec.discord_id, rec.discord_username);

  delete from public.discord_verification_codes where code = code_input;

  return rec.discord_username;
end;
$$;
