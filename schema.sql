-- Pink Chat: chạy toàn bộ đoạn này trong Supabase SQL Editor

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 30),
  text text,
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

drop policy if exists "Anyone can read messages" on public.messages;
drop policy if exists "Anyone can send messages" on public.messages;
create policy "Anyone can read messages" on public.messages for select using (true);
create policy "Anyone can send messages" on public.messages for insert with check (char_length(name) between 1 and 30);

-- Cho Realtime theo dõi INSERT của bảng messages
alter table public.messages replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- Bucket ảnh công khai
insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Anyone can upload chat images" on storage.objects;
drop policy if exists "Anyone can view chat images" on storage.objects;
create policy "Anyone can upload chat images" on storage.objects for insert with check (bucket_id = 'chat-images');
create policy "Anyone can view chat images" on storage.objects for select using (bucket_id = 'chat-images');
