-- Pink Chat: tài khoản + đăng nhập
create extension if not exists pgcrypto;

create table if not exists public.chat_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  username_lower text generated always as (lower(trim(username))) stored,
  password_hash text not null,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  unique(username_lower),
  check (username ~ '^[A-Za-z0-9_]{3,30}$')
);

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.chat_accounts(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

alter table public.chat_accounts enable row level security;
alter table public.chat_sessions enable row level security;
drop policy if exists "No direct account access" on public.chat_accounts;
drop policy if exists "No direct session access" on public.chat_sessions;

create or replace function public.register_chat_account(p_username text, p_password text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare a public.chat_accounts; s public.chat_sessions;
begin
  if p_username !~ '^[A-Za-z0-9_]{3,30}$' then raise exception 'Tên đăng nhập không hợp lệ'; end if;
  if length(p_password) < 6 or length(p_password) > 72 then raise exception 'Mật khẩu phải từ 6 đến 72 ký tự'; end if;
  if exists(select 1 from chat_accounts where username_lower=lower(trim(p_username))) then raise exception 'Tên đăng nhập đã tồn tại'; end if;
  insert into chat_accounts(username,password_hash) values(trim(p_username), crypt(p_password, gen_salt('bf'))) returning * into a;
  insert into chat_sessions(account_id) values(a.id) returning * into s;
  return jsonb_build_object('username',a.username,'session_token',s.token::text);
end;
$$;

create or replace function public.login_chat_account(p_username text, p_password text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare a public.chat_accounts; s public.chat_sessions;
begin
  select * into a from chat_accounts where username_lower=lower(trim(p_username)) limit 1;
  if a.id is null or a.password_hash <> crypt(p_password,a.password_hash) then raise exception 'Sai tên đăng nhập hoặc mật khẩu'; end if;
  update chat_accounts set last_login_at=now() where id=a.id;
  delete from chat_sessions where account_id=a.id and expires_at < now();
  insert into chat_sessions(account_id) values(a.id) returning * into s;
  return jsonb_build_object('username',a.username,'session_token',s.token::text);
end;
$$;

create or replace function public.validate_chat_session(p_token uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare u text;
begin
  select a.username into u from chat_sessions s join chat_accounts a on a.id=s.account_id where s.token=p_token and s.expires_at>now();
  if u is null then return null; end if;
  return jsonb_build_object('username',u);
end;
$$;

grant execute on function public.register_chat_account(text,text) to anon,authenticated;
grant execute on function public.login_chat_account(text,text) to anon,authenticated;
grant execute on function public.validate_chat_session(uuid) to anon,authenticated;
