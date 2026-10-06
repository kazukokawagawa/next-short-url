-- Execute the SQL contents after 202610070001_user_permissions.sql.
begin;

alter table public.admin_audit_logs drop constraint if exists admin_audit_logs_action_check;
alter table public.admin_audit_logs add constraint admin_audit_logs_action_check
check (action in ('user.role', 'user.status', 'user.delete', 'link.delete', 'links.delete', 'links.clean'));

alter table public.profiles drop constraint if exists profiles_disabled_by_fkey;
alter table public.profiles add constraint profiles_disabled_by_fkey
foreign key (disabled_by) references auth.users(id) on delete set null;

-- Authentication records, owned links, profile and audit are changed atomically.
-- Shares the lock used by role/status mutations to protect the final admin.
create or replace function public.admin_delete_user(p_id uuid, p_expected_updated_at timestamptz, p_confirmation text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.profiles%rowtype; actor public.profiles%rowtype; deleted_links bigint;
begin
  perform pg_advisory_xact_lock(728410215);
  select * into actor from public.profiles where id = auth.uid() for update;
  if not found or actor.role <> 'admin' or actor.status <> 'active' then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into target from public.profiles where id = p_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if p_expected_updated_at is null or target.updated_at <> p_expected_updated_at then raise exception 'STALE_USER'; end if;
  if target.role = 'admin' and target.status = 'active'
    and (select count(*) from public.profiles where role = 'admin' and status = 'active') <= 1 then raise exception 'LAST_ADMIN'; end if;
  if p_id = auth.uid() then raise exception 'SELF_DELETE'; end if;
  if p_confirmation is distinct from coalesce(target.email, target.id::text)
    or length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then raise exception 'INVALID_INPUT' using errcode = '22023'; end if;

  delete from public.links where user_id = target.id;
  get diagnostics deleted_links = row_count;
  insert into public.admin_audit_logs(actor_id, actor_email, target_id, target_email, action, before_value, after_value, reason)
  values (actor.id, actor.email, target.id, target.email, 'user.delete',
    jsonb_build_object('role', target.role, 'status', target.status, 'deleted_links', deleted_links), '{}'::jsonb, btrim(p_reason));
  delete from auth.users where id = target.id;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.admin_delete_user(uuid, timestamptz, text, text) from public, anon;
grant execute on function public.admin_delete_user(uuid, timestamptz, text, text) to authenticated;

commit;
