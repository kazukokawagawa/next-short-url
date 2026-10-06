-- Run in the Supabase SQL editor after backing up existing schema and policies.
-- Application account suspension; does not delete users or disable public redirects.
begin;

alter table public.profiles
  add column if not exists status text not null default 'active',
  add column if not exists display_name text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists last_seen_at timestamptz,
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_by uuid references auth.users(id);

update public.profiles set role = 'user' where role is null;
alter table public.profiles alter column role set not null;
alter table public.profiles alter column role set default 'user';
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check check (status in ('active', 'disabled'));

insert into public.profiles (id, email, role, created_at)
select id, email, 'user', created_at from auth.users
on conflict (id) do nothing;

create index if not exists profiles_created_id_idx on public.profiles(created_at desc, id);
create index if not exists links_owner_created_idx on public.links(user_id, created_at desc, id);

create or replace function public.sync_user_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.profiles (id, email, role, status, created_at)
    values (new.id, new.email, 'user', 'active', new.created_at)
    on conflict (id) do nothing;
  else
    update public.profiles set email = new.email, updated_at = clock_timestamp() where id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_user_profile() from public, anon, authenticated;
drop trigger if exists linkflow_sync_user_profile on auth.users;
create trigger linkflow_sync_user_profile after insert or update of email on auth.users
for each row execute function public.sync_user_profile();

create or replace function public.is_active_account()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active');
$$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;
revoke all on function public.is_active_account() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_active_account() to authenticated;
grant execute on function public.is_admin() to authenticated;

create or replace function public.record_account_activity()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active_account() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update public.profiles set last_seen_at = now()
  where id = auth.uid() and (last_seen_at is null or last_seen_at < now() - interval '5 minutes');
end;
$$;
revoke all on function public.record_account_activity() from public, anon;
grant execute on function public.record_account_activity() to authenticated;

create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_email text,
  target_id uuid not null,
  target_email text,
  action text not null check (action in ('user.role', 'user.status', 'link.delete', 'links.delete', 'links.clean')),
  before_value jsonb not null,
  after_value jsonb not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists audit_target_created_idx on public.admin_audit_logs(target_id, created_at desc, id);
alter table public.admin_audit_logs enable row level security;
revoke all on public.admin_audit_logs from anon, authenticated;
grant select on public.admin_audit_logs to authenticated;
drop policy if exists "Active admins read audit" on public.admin_audit_logs;
create policy "Active admins read audit" on public.admin_audit_logs for select to authenticated using (public.is_admin());

alter table public.profiles enable row level security;
revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles" on public.profiles for select to authenticated using (public.is_admin());

-- Restrictive policies intersect every existing permissive policy, including historical ones.
drop policy if exists "Profile read boundary" on public.profiles;
create policy "Profile read boundary" on public.profiles as restrictive for select to authenticated
using (id = auth.uid() or public.is_admin());
alter table public.links enable row level security;
drop policy if exists "Active accounts access links" on public.links;
create policy "Active accounts access links" on public.links as restrictive for all to authenticated
using (public.is_active_account() and (user_id = auth.uid() or public.is_admin()))
with check (public.is_active_account() and user_id = auth.uid());
drop policy if exists "Users update own links" on public.links;
create policy "Users update own links" on public.links for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Admins read links" on public.links;
create policy "Admins read links" on public.links for select to authenticated using (public.is_admin());
drop policy if exists "Admins delete links" on public.links;
create policy "Admins delete links" on public.links for delete to authenticated using (public.is_admin());

alter table public.settings enable row level security;
drop policy if exists "Active admins write settings" on public.settings;
create policy "Active admins write settings" on public.settings as restrictive for insert to authenticated with check (public.is_admin());
drop policy if exists "Active admins update settings" on public.settings;
create policy "Active admins update settings" on public.settings as restrictive for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Active admins delete settings" on public.settings;
create policy "Active admins delete settings" on public.settings as restrictive for delete to authenticated using (public.is_admin());

create or replace function public.admin_list_users(p_search text default '', p_role text default 'all', p_status text default 'all', p_page integer default 1)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_page is null or p_page < 1 or p_page > 100000 or p_role not in ('all', 'user', 'admin') or p_status not in ('all', 'active', 'disabled') or p_role is null or p_status is null or length(coalesce(p_search, '')) > 200 then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  with filtered as (
    select p.* from public.profiles p
    where (p_role = 'all' or p.role = p_role) and (p_status = 'all' or p.status = p_status)
      and (coalesce(p_search, '') = '' or position(lower(p_search) in lower(coalesce(p.email, '') || ' ' || coalesce(p.display_name, '') || ' ' || p.id::text)) > 0)
  ), page_rows as (
    select f.id, f.email, f.display_name, f.role, f.status, f.created_at, f.updated_at, f.last_seen_at,
      (select count(*) from public.links l where l.user_id = f.id) as link_count
    from filtered f order by f.created_at desc, f.id limit 20 offset ((p_page - 1) * 20)
  )
  select jsonb_build_object('users', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc, r.id) from page_rows r), '[]'::jsonb),
    'total', (select count(*) from filtered), 'page', p_page, 'pageSize', 20) into result;
  return result;
end;
$$;
revoke all on function public.admin_list_users(text, text, text, integer) from public, anon;
grant execute on function public.admin_list_users(text, text, text, integer) to authenticated;

-- Serialize mutations so two administrators cannot concurrently remove the last admin.
-- Optimistic comparison prevents stale dialogs from overwriting newer permissions.
create or replace function public.admin_update_user(p_id uuid, p_field text, p_value text, p_expected_updated_at timestamptz, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.profiles%rowtype; actor public.profiles%rowtype; next_role text; next_status text;
begin
  perform pg_advisory_xact_lock(728410215);
  select * into actor from public.profiles where id = auth.uid() for update;
  if not found or actor.role <> 'admin' or actor.status <> 'active' then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_field is null or p_value is null or p_field not in ('role', 'status') or (p_field = 'role' and p_value not in ('user', 'admin')) or (p_field = 'status' and p_value not in ('active', 'disabled')) or length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  select * into target from public.profiles where id = p_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if p_expected_updated_at is null or target.updated_at <> p_expected_updated_at then raise exception 'STALE_USER'; end if;
  next_role := case when p_field = 'role' then p_value else target.role end;
  next_status := case when p_field = 'status' then p_value else target.status end;
  if next_role = target.role and next_status = target.status then raise exception 'NO_CHANGE'; end if;
  if target.role = 'admin' and target.status = 'active' and (next_role <> 'admin' or next_status <> 'active')
    and (select count(*) from public.profiles where role = 'admin' and status = 'active') <= 1 then
    raise exception 'LAST_ADMIN';
  end if;
  if p_id = auth.uid() and next_status = 'disabled' then raise exception 'SELF_DISABLE'; end if;
  update public.profiles set role = next_role, status = next_status, updated_at = clock_timestamp(),
    disabled_at = case when next_status = 'disabled' then coalesce(disabled_at, now()) else null end,
    disabled_by = case when next_status = 'disabled' then coalesce(disabled_by, auth.uid()) else null end
  where id = p_id;
  insert into public.admin_audit_logs(actor_id, actor_email, target_id, target_email, action, before_value, after_value, reason)
  values (actor.id, actor.email, target.id, target.email, 'user.' || p_field,
    jsonb_build_object('role', target.role, 'status', target.status), jsonb_build_object('role', next_role, 'status', next_status), btrim(p_reason));
end;
$$;
revoke all on function public.admin_update_user(uuid, text, text, timestamptz, text) from public, anon;
grant execute on function public.admin_update_user(uuid, text, text, timestamptz, text) to authenticated;

-- Audit privileged deletions in the same transaction, without logging target URLs or hashes.
create or replace function public.audit_admin_link_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() then
    insert into public.admin_audit_logs(actor_id, actor_email, target_id, target_email, action, before_value, after_value)
    values (auth.uid(), (select email from public.profiles where id = auth.uid()), coalesce(old.user_id, auth.uid()), old.user_email,
      'link.delete', jsonb_build_object('link_id', old.id, 'slug', old.slug), '{}'::jsonb);
  end if;
  return old;
end;
$$;
revoke all on function public.audit_admin_link_delete() from public, anon, authenticated;
drop trigger if exists linkflow_audit_link_delete on public.links;
create trigger linkflow_audit_link_delete after delete on public.links for each row execute function public.audit_admin_link_delete();

commit;
