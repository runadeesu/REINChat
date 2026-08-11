-- Storage buckets + RLS policies on storage.objects.
-- Path convention (enforced by policies below, not just trusted client-side):
--   avatars/{user_id}/...
--   backgrounds/{user_id}/...
--   attachments/{conversation_id}/{message_id}/{filename}
--   stickers/{pack_id}/...

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('backgrounds', 'backgrounds', true),
  ('attachments', 'attachments', false),
  ('stickers', 'stickers', true)
on conflict (id) do nothing;

-- avatars / backgrounds: public read, only the owning user can write to
-- their own folder (first path segment = their user id).

create policy "avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "users manage their own avatar folder"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "backgrounds are publicly readable"
  on storage.objects for select
  using (bucket_id = 'backgrounds');

create policy "users manage their own background folder"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'backgrounds' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);

-- attachments: private. Readable only by members of the conversation the
-- file's path segment names; uploadable only by a member of that same
-- conversation, into a path they've stamped with their own user id so the
-- filename can't be used to impersonate another sender.

create policy "conversation members can read attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'attachments'
    and public.is_conversation_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

create policy "conversation members can upload attachments"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'attachments'
    and public.is_conversation_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

create policy "uploaders can delete their own attachments"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'attachments'
    and owner = auth.uid()
  );

-- stickers: public read; only admins can manage the sticker library.

create policy "stickers are publicly readable"
  on storage.objects for select
  using (bucket_id = 'stickers');

create policy "admins manage sticker files"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'stickers' and public.is_admin(auth.uid()))
  with check (bucket_id = 'stickers' and public.is_admin(auth.uid()));
