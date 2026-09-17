-- Pink Chat: chạy toàn bộ đoạn này trong Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);

insert into public.chat_channels (name)
values ('Chung')
on conflict (name) do nothing;

create table if not exists public.blocked_users (
  name text primary key,
  blocked_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 30),
  message text,
  image_url text,
  channel_id uuid references public.chat_channels(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Tương thích database cũ nếu bảng messages đã tồn tại.
alter table public.messages add column if not exists message text;
alter table public.messages add column if not exists image_url text;
alter table public.messages add column if not exists channel_id uuid references public.chat_channels(id) on delete cascade;

update public.messages
set channel_id = (select id from public.chat_channels where name = 'Chung' limit 1)
where channel_id is null;


alter table public.messages enable row level security;
alter table public.chat_channels enable row level security;
alter table public.blocked_users enable row level security;

drop policy if exists "Anyone can read messages" on public.messages;
drop policy if exists "Anyone can send messages" on public.messages;
create policy "Anyone can read messages" on public.messages for select using (true);
create policy "Anyone can send messages" on public.messages
for insert with check (
  char_length(name) between 1 and 30
  and not exists (select 1 from public.blocked_users b where lower(b.name) = lower(messages.name))
);

drop policy if exists "Anyone can read channels" on public.chat_channels;
create policy "Anyone can read channels" on public.chat_channels for select using (true);

drop policy if exists "No direct channel creation" on public.chat_channels;
-- Kênh chỉ nên được tạo qua RPC admin bên dưới.

drop policy if exists "No direct blocked user access" on public.blocked_users;

-- Realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- Admin đơn giản cho bản demo. Không đưa mật khẩu vào frontend.
create or replace function public.admin_create_channel(admin_name text, admin_password text, channel_name text)
returns public.chat_channels
language plpgsql
security definer
set search_path = public
as $$
declare result public.chat_channels;
begin
  if admin_name <> 'Miles' or admin_password <> 'thinh2505' then
    raise exception 'Sai tài khoản hoặc mật khẩu admin';
  end if;
  insert into public.chat_channels(name)
  values (trim(channel_name))
  on conflict (name) do update set name = excluded.name
  returning * into result;
  return result;
end;
$$;

create or replace function public.admin_block_user(admin_name text, admin_password text, user_name text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if admin_name <> 'Miles' or admin_password <> 'thinh2505' then
    raise exception 'Sai tài khoản hoặc mật khẩu admin';
  end if;
  if lower(trim(user_name)) = 'miles' then
    raise exception 'Không thể block admin';
  end if;
  insert into public.blocked_users(name) values (trim(user_name)) on conflict (name) do nothing;
  return true;
end;
$$;

create or replace function public.admin_unblock_user(admin_name text, admin_password text, user_name text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if admin_name <> 'Miles' or admin_password <> 'thinh2505' then
    raise exception 'Sai tài khoản hoặc mật khẩu admin';
  end if;
  delete from public.blocked_users where lower(name) = lower(trim(user_name));
  return true;
end;
$$;


create or replace function public.admin_verify(admin_name text, admin_password text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return admin_name = 'Miles' and admin_password = 'thinh2505';
end;
$$;

grant execute on function public.admin_verify(text,text) to anon, authenticated;

grant execute on function public.admin_create_channel(text,text,text) to anon, authenticated;
grant execute on function public.admin_block_user(text,text,text) to anon, authenticated;
grant execute on function public.admin_unblock_user(text,text,text) to anon, authenticated;

-- Tính năng reply + reaction
alter table public.messages drop constraint if exists messages_reply_to_fkey;
alter table public.messages add column if not exists reply_to bigint;

-- Nếu reply_to đã tồn tại nhưng là uuid ở database cũ, đổi sang bigint khi cột đang rỗng.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='messages' and column_name='reply_to' and data_type='uuid'
  ) then
    if not exists (select 1 from public.messages where reply_to is not null) then
      alter table public.messages drop column reply_to;
      alter table public.messages add column reply_to bigint;
    else
      raise exception 'messages.reply_to đang chứa UUID; cần chuyển dữ liệu trước khi đổi sang bigint';
    end if;
  end if;
end $$;

alter table public.messages
add constraint messages_reply_to_fkey
foreign key (reply_to) references public.messages(id) on delete set null;

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id bigint not null references public.messages(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  unique(message_id, name, emoji)
);

alter table public.message_reactions enable row level security;
drop policy if exists "Anyone can read reactions" on public.message_reactions;
drop policy if exists "Anyone can add reactions" on public.message_reactions;
drop policy if exists "Anyone can remove reactions" on public.message_reactions;
create policy "Anyone can read reactions" on public.message_reactions for select using (true);
create policy "Anyone can add reactions" on public.message_reactions for insert with check (char_length(name) between 1 and 30);
create policy "Anyone can remove reactions" on public.message_reactions for delete using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;
