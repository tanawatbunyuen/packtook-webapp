-- PACKTOOK V4 phase 1+2, run through Supabase SQL editor as project owner.
create extension if not exists pgcrypto;
create table if not exists public.pt_accounts(
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  name text not null default 'My store',
  plan text not null default 'Free' check(plan in ('Free','Starter','Basic','Growth','Business','Pro')),
  period_start timestamptz not null default now(),
  period_end timestamptz not null default (now()+interval '1 month'),
  created_at timestamptz not null default now()
);
create unique index if not exists pt_accounts_owner_unique on public.pt_accounts(owner_id);
create table if not exists public.pt_recordings(
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.pt_accounts(id),
  user_id uuid not null references auth.users(id),
  barcode text not null,
  operation_id uuid not null,
  status text not null default 'reserved' check(status in ('reserved','completed','failed','expired')),
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  filename text,
  file_bytes bigint,
  unique(account_id,operation_id)
);
create index if not exists pt_recordings_usage on public.pt_recordings(account_id,created_at,status);
create table if not exists public.pt_audit(
 id bigserial primary key, account_id uuid not null references public.pt_accounts(id),
 actor_id uuid references auth.users(id), action text not null, subject_id uuid,
 occurred_at timestamptz not null default now(), details jsonb not null default '{}'::jsonb
);
alter table public.pt_accounts enable row level security;
alter table public.pt_recordings enable row level security;
alter table public.pt_audit enable row level security;
revoke all on public.pt_accounts, public.pt_recordings, public.pt_audit from anon,authenticated;
grant select on public.pt_accounts,public.pt_recordings to authenticated;
create policy pt_account_owner_read on public.pt_accounts for select to authenticated using(owner_id=auth.uid());
create policy pt_recordings_owner_read on public.pt_recordings for select to authenticated
 using(exists(select 1 from public.pt_accounts a where a.id=account_id and a.owner_id=auth.uid()));
-- No client INSERT/UPDATE/DELETE on credit tables. Writes go through Edge Function and service-role-only RPCs.
create or replace function public.pt_reserve(p_account uuid,p_user uuid,p_operation uuid,p_barcode text)
returns table(recording_id uuid, remaining integer, unlimited boolean)
language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.pt_accounts%rowtype; lim int; cnt int; rid uuid; 
begin
 if p_barcode is null or length(trim(p_barcode))<1 or length(p_barcode)>160 then raise exception 'invalid barcode'; end if;
 select * into a from public.pt_accounts where id=p_account for update;
 if not found or a.owner_id<>p_user then raise exception 'unauthorized account'; end if;
 if now()<a.period_start or now()>=a.period_end then raise exception 'billing period inactive'; end if;
 lim := case a.plan when 'Free' then 20 when 'Starter' then 50 when 'Basic' then 300 when 'Growth' then 1500 when 'Business' then 5000 else null end;
 select r.id into rid from public.pt_recordings r where r.account_id=p_account and r.operation_id=p_operation;
 if rid is not null then
   select count(*) into cnt from public.pt_recordings r where r.account_id=p_account and r.created_at>=a.period_start and r.created_at<a.period_end and r.status in ('reserved','completed');
   return query select rid,case when lim is null then null else greatest(lim-cnt,0) end,lim is null; return;
 end if;
 select count(*) into cnt from public.pt_recordings r where r.account_id=p_account and r.created_at>=a.period_start and r.created_at<a.period_end and r.status in ('reserved','completed');
 if lim is not null and cnt>=lim then raise exception 'quota exceeded'; end if;
 insert into public.pt_recordings(account_id,user_id,operation_id,barcode)
 values(p_account,p_user,p_operation,trim(p_barcode)) returning id into rid;
 insert into public.pt_audit(account_id,actor_id,action,subject_id) values(p_account,p_user,'reserve',rid);
 return query select rid, case when lim is null then null else lim-cnt-1 end, lim is null;
end $$;
create or replace function public.pt_complete(p_recording uuid,p_user uuid,p_filename text,p_bytes bigint)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.pt_recordings%rowtype;
begin
 select * into r from public.pt_recordings where id=p_recording for update;
 if not found or r.user_id<>p_user then raise exception 'unauthorized recording'; end if;
 if r.status='completed' then return true; end if;
 if r.status<>'reserved' then raise exception 'not reserved'; end if;
 if p_bytes<1000 or p_filename is null or length(p_filename)>255 then raise exception 'invalid file'; end if;
 update public.pt_recordings set status='completed',filename=p_filename,file_bytes=p_bytes,finalized_at=now() where id=r.id;
 insert into public.pt_audit(account_id,actor_id,action,subject_id) values(r.account_id,p_user,'complete',r.id);
 return true;
end $$;
create or replace function public.pt_fail(p_recording uuid,p_user uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.pt_recordings%rowtype;
begin
 select * into r from public.pt_recordings where id=p_recording for update;
 if not found or r.user_id<>p_user then raise exception 'unauthorized recording'; end if;
 if r.status='failed' then return true; end if;
 if r.status<>'reserved' then raise exception 'cannot refund completed recording'; end if;
 update public.pt_recordings set status='failed',finalized_at=now() where id=r.id;
 insert into public.pt_audit(account_id,actor_id,action,subject_id) values(r.account_id,p_user,'failed',r.id);
 return true;
end $$;
revoke all on function public.pt_reserve(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.pt_complete(uuid,uuid,text,bigint) from public,anon,authenticated;
revoke all on function public.pt_fail(uuid,uuid) from public,anon,authenticated;
grant execute on function public.pt_reserve(uuid,uuid,uuid,text) to service_role;
grant execute on function public.pt_complete(uuid,uuid,text,bigint) to service_role;
grant execute on function public.pt_fail(uuid,uuid) to service_role;
-- After creating a user in Supabase Auth, an admin must provision pt_accounts.
-- DO NOT expose service_role or SECRET keys in GitHub Pages.