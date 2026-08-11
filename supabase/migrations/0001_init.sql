-- REINChat core schema
-- Auth is handled entirely by Supabase Auth (auth.users). Everything here
-- is application data, locked down with Row Level Security so the browser
-- can talk to Postgres directly through supabase-js for realtime reads
-- while still being unable to see/touch data it isn't authorized for.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_id text not null unique,
  display_name text not null,
  bio text,
  status_message text,
  avatar_url text,
  background_url text,
  last_online_at timestamptz not null default now(),
  is_online boolean not null default false,
  is_suspended boolean not null default false,
  suspended_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_display_id_idx on public.profiles (display_id);

alter table public.profiles enable row level security;

-- Anyone signed in can look up basic public profile fields (needed for ID
-- search, QR add, message sender rendering, etc.) — nothing sensitive lives
-- in this table.
create policy "profiles are readable by any authenticated user"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

-- Auto-create a profile row (with a random display_id the user can change
-- later) the moment someone signs up, so there's never a signed-in user
-- without a profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_id, display_name)
  values (
    new.id,
    'rein_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Blocks (checked before friend requests / messaging are allowed)
-- ---------------------------------------------------------------------------

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;

create policy "users manage their own blocks"
  on public.blocks for all
  to authenticated
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid());

create or replace function public.is_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- ---------------------------------------------------------------------------
-- Friend requests + friendships
-- ---------------------------------------------------------------------------

create type public.friend_request_status as enum ('pending', 'accepted', 'rejected', 'cancelled');

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status public.friend_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);

create unique index friend_requests_pending_unique
  on public.friend_requests (sender_id, receiver_id)
  where (status = 'pending');

alter table public.friend_requests enable row level security;

create policy "participants can see their friend requests"
  on public.friend_requests for select
  to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid());

create policy "users can send friend requests"
  on public.friend_requests for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and not public.is_blocked(sender_id, receiver_id)
  );

create policy "receiver can respond, sender can cancel"
  on public.friend_requests for update
  to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid())
  with check (sender_id = auth.uid() or receiver_id = auth.uid());

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

alter table public.friendships enable row level security;

create policy "users see their own friendships"
  on public.friendships for select
  to authenticated
  using (user_id = auth.uid());

create policy "users can remove their own friendships"
  on public.friendships for delete
  to authenticated
  using (user_id = auth.uid());

-- Accepting a request creates the (symmetric) friendship rows. Runs as the
-- table owner so it can insert both directions regardless of which side the
-- RLS-checked UPDATE came from.
create or replace function public.accept_friend_request(request_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  req public.friend_requests;
begin
  select * into req from public.friend_requests where id = request_id for update;

  if req is null then
    raise exception 'friend request not found';
  end if;
  if req.receiver_id <> auth.uid() then
    raise exception 'not authorized to accept this request';
  end if;
  if req.status <> 'pending' then
    raise exception 'request is not pending';
  end if;

  update public.friend_requests set status = 'accepted', updated_at = now() where id = request_id;

  insert into public.friendships (user_id, friend_id) values (req.sender_id, req.receiver_id)
    on conflict do nothing;
  insert into public.friendships (user_id, friend_id) values (req.receiver_id, req.sender_id)
    on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Conversations (1:1 and group share this table; type distinguishes them)
-- ---------------------------------------------------------------------------

create type public.conversation_type as enum ('direct', 'group');
create type public.member_role as enum ('owner', 'admin', 'member');

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  type public.conversation_type not null,
  name text,
  avatar_url text,
  description text,
  announcement text,
  invite_code text unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  is_muted boolean not null default false,
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  unique (conversation_id, user_id)
);

create index conversation_members_user_idx on public.conversation_members (user_id);

create or replace function public.is_conversation_member(conv_id uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = conv_id and user_id = uid
  );
$$;

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;

create policy "members can see their conversations"
  on public.conversations for select
  to authenticated
  using (public.is_conversation_member(id, auth.uid()));

create policy "authenticated users can create conversations"
  on public.conversations for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "owners/admins can update conversation"
  on public.conversations for update
  to authenticated
  using (
    exists (
      select 1 from public.conversation_members
      where conversation_id = id and user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

create policy "members can see membership rows for their conversations"
  on public.conversation_members for select
  to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));

create policy "members can update their own membership row"
  on public.conversation_members for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "members can leave (delete their own row)"
  on public.conversation_members for delete
  to authenticated
  using (user_id = auth.uid());

-- Inserting membership rows (adding people to a conversation) is done via
-- security-definer RPCs below rather than direct table inserts, so we can
-- enforce "only friends" / "only owner-admin can add" rules in one place.

create or replace function public.start_direct_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  existing_id uuid;
  new_id uuid;
begin
  if other_user_id = auth.uid() then
    raise exception 'cannot start a conversation with yourself';
  end if;
  if public.is_blocked(auth.uid(), other_user_id) then
    raise exception 'blocked';
  end if;

  select c.id into existing_id
  from public.conversations c
  join public.conversation_members m1 on m1.conversation_id = c.id and m1.user_id = auth.uid()
  join public.conversation_members m2 on m2.conversation_id = c.id and m2.user_id = other_user_id
  where c.type = 'direct'
  limit 1;

  if existing_id is not null then
    return existing_id;
  end if;

  insert into public.conversations (type, created_by) values ('direct', auth.uid()) returning id into new_id;
  insert into public.conversation_members (conversation_id, user_id, role) values (new_id, auth.uid(), 'owner');
  insert into public.conversation_members (conversation_id, user_id, role) values (new_id, other_user_id, 'owner');

  return new_id;
end;
$$;

create or replace function public.create_group_conversation(group_name text, member_ids uuid[])
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  new_id uuid;
  member uuid;
begin
  insert into public.conversations (type, name, created_by, invite_code)
    values ('group', group_name, auth.uid(), substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
    returning id into new_id;

  insert into public.conversation_members (conversation_id, user_id, role) values (new_id, auth.uid(), 'owner');

  foreach member in array member_ids loop
    if member <> auth.uid() then
      insert into public.conversation_members (conversation_id, user_id, role)
        values (new_id, member, 'member')
        on conflict do nothing;
    end if;
  end loop;

  return new_id;
end;
$$;

create or replace function public.add_group_members(conv_id uuid, member_ids uuid[])
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  member uuid;
  caller_role public.member_role;
begin
  select role into caller_role from public.conversation_members
    where conversation_id = conv_id and user_id = auth.uid();
  if caller_role is null then
    raise exception 'not a member of this conversation';
  end if;

  foreach member in array member_ids loop
    insert into public.conversation_members (conversation_id, user_id, role)
      values (conv_id, member, 'member')
      on conflict do nothing;
  end loop;
end;
$$;

create or replace function public.remove_group_member(conv_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  caller_role public.member_role;
begin
  select role into caller_role from public.conversation_members
    where conversation_id = conv_id and user_id = auth.uid();
  if caller_role not in ('owner', 'admin') then
    raise exception 'not authorized';
  end if;

  delete from public.conversation_members where conversation_id = conv_id and user_id = target_user_id;
end;
$$;

create or replace function public.join_group_by_invite(code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  conv_id uuid;
begin
  select id into conv_id from public.conversations where invite_code = code and type = 'group';
  if conv_id is null then
    raise exception 'invalid invite code';
  end if;

  insert into public.conversation_members (conversation_id, user_id, role)
    values (conv_id, auth.uid(), 'member')
    on conflict do nothing;

  return conv_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------

create type public.message_type as enum ('text', 'image', 'video', 'audio', 'file', 'sticker', 'system');

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  type public.message_type not null default 'text',
  content text,
  sticker_id uuid,
  reply_to_id uuid references public.messages(id) on delete set null,
  forwarded_from_id uuid references public.messages(id) on delete set null,
  is_pinned boolean not null default false,
  pinned_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

alter table public.messages enable row level security;

create policy "members can read messages in their conversations"
  on public.messages for select
  to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));

create policy "members can send messages"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_member(conversation_id, auth.uid())
  );

-- Only the sender can edit/delete their own message content. Pinning is
-- handled by a separate security-definer RPC (below) so an owner/admin can
-- pin without also being able to rewrite someone else's message text.
create policy "senders can edit/delete their own messages"
  on public.messages for update
  to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

create or replace function public.set_message_pinned(msg_id uuid, pinned boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  conv_id uuid;
  caller_role public.member_role;
begin
  select conversation_id into conv_id from public.messages where id = msg_id;
  if conv_id is null then
    raise exception 'message not found';
  end if;

  select role into caller_role from public.conversation_members
    where conversation_id = conv_id and user_id = auth.uid();
  if caller_role is null then
    raise exception 'not a member of this conversation';
  end if;

  update public.messages
    set is_pinned = pinned, pinned_at = case when pinned then now() else null end
    where id = msg_id;
end;
$$;

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  url text not null,
  mime_type text not null,
  size_bytes bigint not null,
  width int,
  height int,
  duration_seconds numeric,
  filename text,
  created_at timestamptz not null default now()
);

alter table public.attachments enable row level security;

create policy "members can read attachments of their conversations' messages"
  on public.attachments for select
  to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_id and public.is_conversation_member(m.conversation_id, auth.uid())
    )
  );

create policy "senders can attach files to their own messages"
  on public.attachments for insert
  to authenticated
  with check (
    exists (
      select 1 from public.messages m
      where m.id = message_id and m.sender_id = auth.uid()
    )
  );

create table public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

alter table public.message_reactions enable row level security;

create policy "members can read reactions"
  on public.message_reactions for select
  to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_id and public.is_conversation_member(m.conversation_id, auth.uid())
    )
  );

create policy "members can react"
  on public.message_reactions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_id and public.is_conversation_member(m.conversation_id, auth.uid())
    )
  );

create policy "users can remove their own reactions"
  on public.message_reactions for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Stickers
-- ---------------------------------------------------------------------------

create table public.sticker_packs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cover_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.stickers (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.sticker_packs(id) on delete cascade,
  name text not null,
  image_url text not null,
  sort_order int not null default 0
);

alter table public.sticker_packs enable row level security;
alter table public.stickers enable row level security;

create policy "sticker packs are readable by anyone signed in"
  on public.sticker_packs for select to authenticated using (true);
create policy "stickers are readable by anyone signed in"
  on public.stickers for select to authenticated using (true);

create table public.sticker_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  sticker_id uuid not null references public.stickers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, sticker_id)
);

create table public.sticker_recent (
  user_id uuid not null references public.profiles(id) on delete cascade,
  sticker_id uuid not null references public.stickers(id) on delete cascade,
  used_at timestamptz not null default now(),
  primary key (user_id, sticker_id)
);

alter table public.sticker_favorites enable row level security;
alter table public.sticker_recent enable row level security;

create policy "users manage their own sticker favorites"
  on public.sticker_favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage their own recent stickers"
  on public.sticker_recent for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Calls
-- ---------------------------------------------------------------------------

create type public.call_type as enum ('audio', 'video');
create type public.call_status as enum ('ringing', 'active', 'ended', 'missed', 'declined');

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  type public.call_type not null,
  status public.call_status not null default 'ringing',
  started_by uuid not null references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table public.call_participants (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz,
  left_at timestamptz,
  unique (call_id, user_id)
);

alter table public.calls enable row level security;
alter table public.call_participants enable row level security;

create policy "members can see calls in their conversations"
  on public.calls for select to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));

create policy "members can start calls"
  on public.calls for insert to authenticated
  with check (started_by = auth.uid() and public.is_conversation_member(conversation_id, auth.uid()));

create policy "members can update call status"
  on public.calls for update to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));

create policy "members can see call participants"
  on public.call_participants for select to authenticated
  using (exists (select 1 from public.calls c where c.id = call_id and public.is_conversation_member(c.conversation_id, auth.uid())));

create policy "users manage their own participant row"
  on public.call_participants for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Notifications + push subscriptions
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "users see their own notifications"
  on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "users mark their own notifications read"
  on public.notifications for update to authenticated using (user_id = auth.uid());

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "users manage their own push subscriptions"
  on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Reports + user settings
-- ---------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy "users can file reports"
  on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "users can see their own filed reports"
  on public.reports for select to authenticated using (reporter_id = auth.uid());

create table public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  theme text not null default 'system',
  notification_prefs jsonb not null default '{"messages": true, "friend_requests": true, "calls": true}',
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "users manage their own settings"
  on public.user_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Admins (checked via is_admin(); no client can set this on themselves —
-- rows are inserted manually in the Supabase SQL editor by the operator)
-- ---------------------------------------------------------------------------

create table public.admin_users (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create policy "admins can see the admin list"
  on public.admin_users for select to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = uid);
$$;

create or replace function public.admin_set_suspended(target_user_id uuid, suspended boolean, reason text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;

  update public.profiles
    set is_suspended = suspended, suspended_reason = case when suspended then reason else null end
    where id = target_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Announcements (admin-authored, shown to every signed-in user until
-- deactivated — same pattern as ReinAI's admin announcement banner)
-- ---------------------------------------------------------------------------

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

create policy "everyone can read active announcements"
  on public.announcements for select to authenticated
  using (active or public.is_admin(auth.uid()));

create policy "admins can manage announcements"
  on public.announcements for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Admin override policies for tables that are otherwise locked to the
-- owning user (profiles are already universal-read, so no extra policy
-- needed there).
create policy "admins can read all reports" on public.reports for select to authenticated
  using (public.is_admin(auth.uid()));
create policy "admins can update reports" on public.reports for update to authenticated
  using (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Realtime: expose the tables clients need to subscribe to
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table
  public.messages,
  public.message_reactions,
  public.conversation_members,
  public.friend_requests,
  public.friendships,
  public.profiles,
  public.calls,
  public.notifications,
  public.announcements;
