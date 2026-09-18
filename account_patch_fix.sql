-- FIX: pgcrypto functions on Supabase
-- Run this AFTER account_patch.sql if you already created the tables/functions.
create extension if not exists pgcrypto;

create or replace function public.register_chat_account(p_username text, p_password text)
returns jsonb
language plpgsql security definer set search_path=public, extensions
as $$
declare a public.chat_accounts; s public.chat_sessions;
begin
  if p_username !~ '^[A-Za-z0-9_]{3,30}$' then raise exception 'Tên đăng nhập không hợp lệ'; end if;
  if length(p_password) < 6 or length(p_password) > 72 then raise exception 'Mật khẩu phải từ 6 đến 72 ký tự'; end if;
  if exists(select 1 from public.chat_accounts where username_lower=lower(trim(p_username))) then raise exception 'Tên đăng nhập đã tồn tại'; end if;
  insert into public.chat_accounts(username,password_hash)
  values(trim(p_username), crypt(p_password, gen_salt('bf')))
  returning * into a;
  insert into public.chat_sessions(account_id) values(a.id) returning * into s;
  return jsonb_build_object('username',a.username,'session_token',s.token::text);
end;
$$;

grant execute on function public.register_chat_account(text,text) to anon,authenticated;

create or replace function public.login_chat_account(p_username text, p_password text)
returns jsonb
language plpgsql security definer set search_path=public, extensions
as $$
declare a public.chat_accounts; s public.chat_sessions;
begin
  select * into a from public.chat_accounts where username_lower=lower(trim(p_username)) limit 1;
  if a.id is null or a.password_hash <> crypt(p_password,a.password_hash) then raise exception 'Sai tên đăng nhập hoặc mật khẩu'; end if;
  update public.chat_accounts set last_login_at=now() where id=a.id;
  delete from public.chat_sessions where account_id=a.id and expires_at < now();
  insert into public.chat_sessions(account_id) values(a.id) returning * into s;
  return jsonb_build_object('username',a.username,'session_token',s.token::text);
end;
$$;

grant execute on function public.login_chat_account(text,text) to anon,authenticated;
