-- Run once in the Supabase SQL Editor. All application reads use RLS.
-- Workspace writes are only available to the server's service-role RPC.
begin;

create table if not exists public.rd_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  data jsonb not null,
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.rd_members (
  workspace_id uuid not null references public.rd_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','planner','viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);
create index if not exists rd_members_user_idx on public.rd_members(user_id);
create table if not exists public.rd_audit (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.rd_workspaces(id) on delete cascade,
  actor_id uuid not null,
  actor_email text not null,
  action text not null,
  revision integer not null,
  created_at timestamptz not null default now()
);
create index if not exists rd_audit_workspace_time_idx on public.rd_audit(workspace_id,created_at desc);

create or replace function public.rd_role(p_workspace_id uuid)
returns text language sql stable security definer set search_path = public, pg_temp
as $$ select role from public.rd_members where workspace_id=p_workspace_id and user_id=auth.uid() $$;
revoke all on function public.rd_role(uuid) from public;
grant execute on function public.rd_role(uuid) to authenticated;

alter table public.rd_workspaces enable row level security;
alter table public.rd_members enable row level security;
alter table public.rd_audit enable row level security;
drop policy if exists rd_workspaces_read on public.rd_workspaces;
create policy rd_workspaces_read on public.rd_workspaces for select to authenticated using (public.rd_role(id) is not null);
drop policy if exists rd_members_read on public.rd_members;
create policy rd_members_read on public.rd_members for select to authenticated using (public.rd_role(workspace_id) is not null);
drop policy if exists rd_audit_read on public.rd_audit;
create policy rd_audit_read on public.rd_audit for select to authenticated using (public.rd_role(workspace_id) is not null);
revoke all on public.rd_workspaces, public.rd_members, public.rd_audit from anon, authenticated;
grant select on public.rd_workspaces, public.rd_members, public.rd_audit to authenticated;
grant all on public.rd_workspaces, public.rd_members, public.rd_audit to service_role;

create or replace function public.rd_validate_data(p_data jsonb)
returns void language plpgsql set search_path = public, pg_temp
as $$
declare
  m text; p jsonb; d jsonb; s jsonb; did text; cells jsonb; dt text; c text; snapshot jsonb;
begin
  if jsonb_typeof(p_data) is distinct from 'object' or p_data->>'schemaVersion' is distinct from '1'
     or octet_length(p_data::text) > 2097152
     or jsonb_typeof(p_data->'doctors') is distinct from 'array'
     or jsonb_typeof(p_data->'shifts') is distinct from 'array'
     or jsonb_typeof(p_data->'plans') is distinct from 'object'
     or jsonb_typeof(p_data->'settings') is distinct from 'object'
     or jsonb_typeof(p_data->'audit') is distinct from 'array' then
    raise exception 'Format data tidak valid.';
  end if;
  if jsonb_array_length(p_data->'doctors') not between 1 and 100
     or jsonb_array_length(p_data->'shifts') not between 1 and 100 then raise exception 'Jumlah dokter atau kode tidak valid.'; end if;
  if (select count(distinct x->>'id') from jsonb_array_elements(p_data->'doctors') x) <> jsonb_array_length(p_data->'doctors') then raise exception 'ID dokter ganda.'; end if;
  if (select count(distinct x->>'code') from jsonb_array_elements(p_data->'shifts') x) <> jsonb_array_length(p_data->'shifts') then raise exception 'Kode dinas ganda.'; end if;
  for d in select value from jsonb_array_elements(p_data->'doctors') loop
    if coalesce(d->>'id','')='' or length(d->>'id')>80 or coalesce(d->>'name','')='' or length(d->>'name')>100 or coalesce(d->>'unit','') not in ('rotasi','anak') then raise exception 'Data dokter tidak valid.'; end if;
  end loop;
  for s in select value from jsonb_array_elements(p_data->'shifts') loop
    if coalesce(s->>'code','') !~ '^[A-Z0-9 _-]{1,16}$' or coalesce(s->>'unit','') not in ('igd','ruangan','anak','lain','none') or coalesce(s->>'kind','') not in ('regular','long','off','leave','not_started','custom') then raise exception 'Kode dinas tidak valid.'; end if;
  end loop;
  for m,p in select key,value from jsonb_each(p_data->'plans') loop
    if m !~ '^\d{4}-(0[1-9]|1[0-2])$' or p->>'month'<>m or jsonb_typeof(p->'assignments') is distinct from 'object'
       or jsonb_typeof(p->'boundaries') is distinct from 'object' or jsonb_typeof(p->'locked') is distinct from 'boolean'
       or jsonb_typeof(p->'frozenThrough') is distinct from 'number' or jsonb_typeof(p->'validationFrom') is distinct from 'number'
       or (p->>'frozenThrough')::integer not between 0 and 31 or (p->>'validationFrom')::integer not between 1 and 31 then raise exception 'Data bulan tidak valid.'; end if;
    snapshot:=p->'shiftSnapshot';
    if jsonb_typeof(snapshot) is distinct from 'array' or jsonb_array_length(snapshot) not between 1 and 100 then raise exception 'Snapshot jam bulan belum lengkap.'; end if;
    for did,cells in select key,value from jsonb_each(p->'assignments') loop
      if not exists(select 1 from jsonb_array_elements(p_data->'doctors') x where x->>'id'=did) or jsonb_typeof(cells)<>'object' then raise exception 'Dokter jadwal tidak terdaftar.'; end if;
      for dt,c in select key,value from jsonb_each_text(cells) loop
        if dt !~ '^\d{4}-\d{2}-\d{2}$' or left(dt,7)<>m or to_char(dt::date,'YYYY-MM-DD')<>dt then raise exception 'Tanggal jadwal tidak valid.'; end if;
        if c<>'' and not exists(select 1 from jsonb_array_elements(snapshot) x where x->>'code'=c) then raise exception 'Kode dinas pada jadwal tidak ditemukan.'; end if;
      end loop;
    end loop;
  end loop;
end;
$$;
revoke all on function public.rd_validate_data(jsonb) from public,anon,authenticated;
grant execute on function public.rd_validate_data(jsonb) to service_role;

create or replace function public.rd_create_workspace(p_name text,p_data jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_id uuid; v_email text;
begin
  if auth.uid() is null then raise exception 'Masuk terlebih dahulu.'; end if;
  -- Serialize onboarding for one account to avoid duplicate workspaces.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  if exists(select 1 from public.rd_members where user_id=auth.uid()) then raise exception 'Akun ini sudah memiliki ruang kerja.'; end if;
  if length(trim(p_name)) not between 1 and 180 then raise exception 'Nama fasilitas tidak valid.'; end if;
  perform public.rd_validate_data(p_data);
  select email into v_email from auth.users where id=auth.uid();
  insert into public.rd_workspaces(name,data) values(trim(p_name),p_data) returning id into v_id;
  insert into public.rd_members(workspace_id,user_id,email,role) values(v_id,auth.uid(),v_email,'admin');
  insert into public.rd_audit(workspace_id,actor_id,actor_email,action,revision) values(v_id,auth.uid(),v_email,'Membuat ruang kerja',0);
  return v_id;
end;
$$;
revoke all on function public.rd_create_workspace(text,jsonb) from public,anon;
grant execute on function public.rd_create_workspace(text,jsonb) to authenticated;

create or replace function public.rd_save_workspace(
  p_workspace_id uuid,p_data jsonb,p_expected_revision integer,p_action text,p_actor uuid,p_administration boolean
) returns integer language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_role text; v_old jsonb; v_revision integer; v_email text;
  m text; old_plan jsonb; new_plan jsonb; did text; dt text; old_cells jsonb; new_cells jsonb; v_frozen integer;
begin
  -- EXECUTE is granted only to service_role. p_actor is verified by the API.
  select role,email into v_role,v_email from public.rd_members where workspace_id=p_workspace_id and user_id=p_actor;
  if v_role is null or v_role='viewer' then raise exception 'Akun tidak boleh mengubah jadwal.'; end if;
  if p_administration and v_role<>'admin' then raise exception 'Perubahan ini hanya tersedia untuk admin.'; end if;
  select data,revision into v_old,v_revision from public.rd_workspaces where id=p_workspace_id for update;
  if v_old is null then raise exception 'Ruang kerja tidak ditemukan.'; end if;
  if v_revision<>p_expected_revision then raise exception 'Data berubah oleh pengguna lain. Muat ulang sebelum menyimpan.'; end if;
  perform public.rd_validate_data(p_data);
  if not p_administration then
    if (p_data->'settings') is distinct from (v_old->'settings') or (p_data->'doctors') is distinct from (v_old->'doctors') or (p_data->'shifts') is distinct from (v_old->'shifts') then raise exception 'Master hanya dapat diubah oleh admin.'; end if;
    for m,old_plan in select key,value from jsonb_each(v_old->'plans') loop
      new_plan:=p_data->'plans'->m;
      if new_plan is null then raise exception 'Jadwal lama tidak dapat dihapus.'; end if;
      if old_plan=new_plan then continue; end if;
      if (old_plan->>'locked')::boolean then raise exception 'Bulan ini sudah dikunci.'; end if;
      if (old_plan-'assignments') is distinct from (new_plan-'assignments') then raise exception 'Pengaturan bulan hanya dapat diubah oleh admin.'; end if;
      v_frozen:=(old_plan->>'frozenThrough')::integer;
      for did in select jsonb_object_keys((old_plan->'assignments') || (new_plan->'assignments')) loop
        old_cells:=coalesce(old_plan->'assignments'->did,'{}'::jsonb); new_cells:=coalesce(new_plan->'assignments'->did,'{}'::jsonb);
        for dt in select jsonb_object_keys(old_cells || new_cells) loop
          if right(dt,2)::integer<=v_frozen and (old_cells->dt) is distinct from (new_cells->dt) then raise exception 'Tanggal riwayat sudah dikunci.'; end if;
        end loop;
      end loop;
    end loop;
    for m,new_plan in select key,value from jsonb_each(p_data->'plans') loop
      if (v_old->'plans') ? m then continue; end if;
      if (new_plan->>'locked')::boolean or (new_plan->>'frozenThrough')::integer<>0 or (new_plan->>'validationFrom')::integer<>1 or (new_plan->'shiftSnapshot') is distinct from (p_data->'shifts') then raise exception 'Bulan baru harus dimulai sebagai draf dengan master saat ini.'; end if;
    end loop;
  end if;
  v_revision:=v_revision+1;
  update public.rd_workspaces set data=p_data,name=p_data->'settings'->>'hospital',revision=v_revision,updated_at=now() where id=p_workspace_id;
  insert into public.rd_audit(workspace_id,actor_id,actor_email,action,revision) values(p_workspace_id,p_actor,v_email,left(p_action,250),v_revision);
  return v_revision;
end;
$$;
revoke all on function public.rd_save_workspace(uuid,jsonb,integer,text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.rd_save_workspace(uuid,jsonb,integer,text,uuid,boolean) to service_role;

create or replace function public.rd_add_member(p_workspace_id uuid,p_email text,p_role text)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare target_id uuid; target_email text; previous_role text; actor_email text;
begin
  if public.rd_role(p_workspace_id) is distinct from 'admin' then raise exception 'Hanya admin yang dapat mengelola pengguna.'; end if;
  perform 1 from public.rd_workspaces where id=p_workspace_id for update;
  if p_role not in ('admin','planner','viewer') then raise exception 'Hak akses tidak valid.'; end if;
  select id,email into target_id,target_email from auth.users where lower(email)=lower(trim(p_email)) and email_confirmed_at is not null limit 1;
  if target_id is null then raise exception 'Pengguna belum terdaftar atau belum memverifikasi email.'; end if;
  if exists(select 1 from public.rd_members where user_id=target_id and workspace_id<>p_workspace_id) then raise exception 'Pengguna sudah tergabung di ruang kerja lain. Versi ini mendukung satu ruang kerja per akun.'; end if;
  select role into previous_role from public.rd_members where workspace_id=p_workspace_id and user_id=target_id;
  if previous_role='admin' and p_role<>'admin' and (select count(*) from public.rd_members where workspace_id=p_workspace_id and role='admin')<=1 then raise exception 'Ruang kerja harus memiliki minimal satu admin.'; end if;
  insert into public.rd_members(workspace_id,user_id,email,role) values(p_workspace_id,target_id,target_email,p_role) on conflict(workspace_id,user_id) do update set role=excluded.role,email=excluded.email;
  select email into actor_email from auth.users where id=auth.uid();
  insert into public.rd_audit(workspace_id,actor_id,actor_email,action,revision) select p_workspace_id,auth.uid(),actor_email,'Mengatur akses '||target_email||' sebagai '||p_role,revision from public.rd_workspaces where id=p_workspace_id;
end;
$$;
revoke all on function public.rd_add_member(uuid,text,text) from public,anon;
grant execute on function public.rd_add_member(uuid,text,text) to authenticated;

create or replace function public.rd_remove_member(p_workspace_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_role text; target_email text; actor_email text;
begin
  if public.rd_role(p_workspace_id) is distinct from 'admin' then raise exception 'Hanya admin yang dapat mengelola pengguna.'; end if;
  perform 1 from public.rd_workspaces where id=p_workspace_id for update;
  select role,email into v_role,target_email from public.rd_members where workspace_id=p_workspace_id and user_id=p_user_id;
  if v_role='admin' and (select count(*) from public.rd_members where workspace_id=p_workspace_id and role='admin')<=1 then raise exception 'Admin terakhir tidak dapat dihapus.'; end if;
  delete from public.rd_members where workspace_id=p_workspace_id and user_id=p_user_id;
  select email into actor_email from auth.users where id=auth.uid();
  insert into public.rd_audit(workspace_id,actor_id,actor_email,action,revision) select p_workspace_id,auth.uid(),actor_email,'Menghapus akses '||coalesce(target_email,'akun'),revision from public.rd_workspaces where id=p_workspace_id;
end;
$$;
revoke all on function public.rd_remove_member(uuid,uuid) from public,anon;
grant execute on function public.rd_remove_member(uuid,uuid) to authenticated;
commit;
