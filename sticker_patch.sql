-- Pink Chat: sticker động + sửa quyền admin xóa tin nhắn
alter table public.messages add column if not exists message_type text not null default 'text';
alter table public.messages add column if not exists sticker_url text;

create or replace function public.admin_delete_message(admin_name text, admin_password text, message_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare deleted_count integer;
begin
  if trim(admin_name) <> 'Miles' or admin_password <> 'thinh2505' then
    raise exception 'Sai tài khoản hoặc mật khẩu admin';
  end if;
  delete from public.messages where id = message_id;
  get diagnostics deleted_count = row_count;
  if deleted_count = 0 then
    raise exception 'Không tìm thấy tin nhắn #% hoặc tin đã bị xóa', message_id;
  end if;
  return true;
end;
$$;
revoke all on function public.admin_delete_message(text,text,bigint) from public;
grant execute on function public.admin_delete_message(text,text,bigint) to anon, authenticated;
