-- Create Free account automatically after registration. The owner may read
-- their account, but cannot upgrade it or increase credit via browser.
create or replace function public.pt_new_user()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.pt_accounts(owner_id,name,plan)
 values(new.id,'PACKTOOK Store','Free')
 on conflict(owner_id) do nothing;
 return new;
end $$;
drop trigger if exists pt_after_user_insert on auth.users;
create trigger pt_after_user_insert after insert on auth.users
for each row execute function public.pt_new_user();
revoke all on function public.pt_new_user() from public,anon,authenticated;
-- Backfill existing users cautiously on initial deployment. Disable this query
-- if Supabase Auth already contains unrelated app users.
-- insert into public.pt_accounts(owner_id,name,plan)
-- select id,'PACKTOOK Store','Free' from auth.users on conflict(owner_id) do nothing;
