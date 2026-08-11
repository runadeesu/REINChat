-- Abuse protection: DB-level rate limits.
-- Since clients talk to Postgres directly through supabase-js, there is no
-- app-server request path to throttle — the limits have to live in the
-- database itself, enforced as BEFORE INSERT triggers that raise on the
-- offending row so the client's insert simply fails.

create index if not exists messages_sender_recent_idx
  on public.messages (sender_id, created_at);

create or replace function public.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  recent_count integer;
begin
  select count(*) into recent_count
  from public.messages
  where sender_id = new.sender_id
    and created_at > now() - interval '10 seconds';

  if recent_count >= 20 then
    raise exception 'rate_limit_exceeded: sending messages too fast, please slow down';
  end if;

  return new;
end;
$$;

create trigger messages_rate_limit
  before insert on public.messages
  for each row execute function public.enforce_message_rate_limit();

create index if not exists friend_requests_sender_recent_idx
  on public.friend_requests (sender_id, created_at);

create or replace function public.enforce_friend_request_rate_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  recent_count integer;
begin
  select count(*) into recent_count
  from public.friend_requests
  where sender_id = new.sender_id
    and created_at > now() - interval '1 hour';

  if recent_count >= 30 then
    raise exception 'rate_limit_exceeded: too many friend requests, please try again later';
  end if;

  return new;
end;
$$;

create trigger friend_requests_rate_limit
  before insert on public.friend_requests
  for each row execute function public.enforce_friend_request_rate_limit();

create index if not exists reports_reporter_recent_idx
  on public.reports (reporter_id, created_at);

create or replace function public.enforce_report_rate_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  recent_count integer;
begin
  select count(*) into recent_count
  from public.reports
  where reporter_id = new.reporter_id
    and created_at > now() - interval '1 hour';

  if recent_count >= 20 then
    raise exception 'rate_limit_exceeded: too many reports filed, please try again later';
  end if;

  return new;
end;
$$;

create trigger reports_rate_limit
  before insert on public.reports
  for each row execute function public.enforce_report_rate_limit();
