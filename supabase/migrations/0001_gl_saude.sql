create extension if not exists pgcrypto with schema extensions;

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  email text,
  role text not null default 'patient'
    check (role in ('patient', 'doctor', 'operator', 'admin')),
  clinic_id uuid references public.clinics (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_signed_in_at timestamptz not null default now()
);

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  display_name text not null,
  specialty text not null,
  crm text not null,
  rating numeric(2, 1) not null default 5.0 check (rating between 0 and 5),
  consultation_price numeric(10, 2) not null check (consultation_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, clinic_id)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete restrict,
  professional_id uuid not null references public.professionals (id) on delete restrict,
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  kind text not null check (kind in ('consultation', 'exam')),
  status text not null default 'held'
    check (status in ('held', 'pending_payment', 'confirmed', 'cancelled', 'completed')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  hold_expires_at timestamptz,
  cancellation_policy text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index appointments_patient_idx on public.appointments (patient_id, starts_at);
create index appointments_schedule_idx on public.appointments (professional_id, starts_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete restrict,
  method text not null check (method in ('pix', 'credit_card')),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'failed', 'refunded')),
  amount numeric(10, 2) not null check (amount >= 0),
  gateway_reference text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.clinical_documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete restrict,
  professional_id uuid not null references public.professionals (id) on delete restrict,
  appointment_id uuid references public.appointments (id) on delete set null,
  type text not null check (type in ('record', 'report', 'prescription', 'exam_request')),
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  channel text not null check (channel in ('email', 'whatsapp')),
  event text not null
    check (event in ('confirmation', 'cancellation', 'reminder_24h', 'reminder_1h', 'access_link')),
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  provider_reference text,
  created_at timestamptz not null default now()
);

create index clinical_documents_patient_idx on public.clinical_documents (patient_id, created_at desc);
create index notifications_user_idx on public.notifications (user_id, scheduled_for);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', '')
    ),
    new.email
  )
  on conflict (id) do update
  set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.create_profile_for_new_auth_user();

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create or replace function public.current_user_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select clinic_id from public.profiles where id = (select auth.uid());
$$;

create or replace function public.create_held_appointment(
  p_professional_id uuid,
  p_clinic_id uuid,
  p_kind text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_appointment_id uuid;
begin
  if auth.uid() is null or public.current_app_role() is distinct from 'patient' then
    raise exception 'Only authenticated patients can book appointments'
      using errcode = '42501';
  end if;

  if p_kind not in ('consultation', 'exam') or p_ends_at <= p_starts_at
    or p_starts_at <= now() then
    raise exception 'Invalid appointment time or kind' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_professional_id::text, 0)
  );

  if not exists (
    select 1
    from public.professionals p
    where p.id = p_professional_id
      and p.clinic_id = p_clinic_id
      and p.active
  ) then
    raise exception 'Professional is unavailable at the selected clinic'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.appointments a
    where a.professional_id = p_professional_id
      and a.starts_at < p_ends_at
      and a.ends_at > p_starts_at
      and (
        a.status in ('pending_payment', 'confirmed')
        or (a.status = 'held' and a.hold_expires_at > now())
      )
  ) then
    raise exception 'The selected time is no longer available'
      using errcode = '23P01';
  end if;

  insert into public.appointments (
    patient_id, professional_id, clinic_id, kind, starts_at, ends_at, hold_expires_at
  )
  values (
    auth.uid(), p_professional_id, p_clinic_id, p_kind, p_starts_at, p_ends_at,
    now() + interval '10 minutes'
  )
  returning id into new_appointment_id;

  return new_appointment_id;
end;
$$;

create or replace function public.reschedule_held_appointment(
  p_appointment_id uuid,
  p_kind text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_professional_id uuid;
begin
  if auth.uid() is null or public.current_app_role() is distinct from 'patient' then
    raise exception 'Only authenticated patients can reschedule appointments'
      using errcode = '42501';
  end if;

  if p_kind not in ('consultation', 'exam') or p_ends_at <= p_starts_at
    or p_starts_at <= now() then
    raise exception 'Invalid appointment time or kind' using errcode = '22023';
  end if;

  select professional_id into current_professional_id
  from public.appointments
  where id = p_appointment_id
    and patient_id = auth.uid()
    and status = 'held'
    and hold_expires_at > now();

  if current_professional_id is null then
    raise exception 'Appointment not found or no longer editable'
      using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_professional_id::text, 0)
  );

  if exists (
    select 1
    from public.appointments a
    where a.id <> p_appointment_id
      and a.professional_id = current_professional_id
      and a.starts_at < p_ends_at
      and a.ends_at > p_starts_at
      and (
        a.status in ('pending_payment', 'confirmed')
        or (a.status = 'held' and a.hold_expires_at > now())
      )
  ) then
    raise exception 'The selected time is no longer available'
      using errcode = '23P01';
  end if;

  update public.appointments
  set kind = p_kind,
      starts_at = p_starts_at,
      ends_at = p_ends_at
  where id = p_appointment_id
    and patient_id = auth.uid()
    and status = 'held';

  if not found then
    raise exception 'Appointment not found or no longer editable'
      using errcode = '42501';
  end if;

  return p_appointment_id;
end;
$$;

alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.professionals enable row level security;
alter table public.appointments enable row level security;
alter table public.payments enable row level security;
alter table public.clinical_documents enable row level security;
alter table public.notifications enable row level security;

create policy "clinics are visible for scheduling"
on public.clinics for select to anon, authenticated
using (true);

create policy "users can read permitted profiles"
on public.profiles for select to authenticated
using (id = (select auth.uid()));

create policy "users can update their own basic profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "active professionals are discoverable"
on public.professionals for select to anon, authenticated
using (
  active
  or user_id = (select auth.uid())
  or (
    public.current_app_role() in ('operator', 'admin')
    and (public.current_app_role() = 'admin' or clinic_id = public.current_user_clinic_id())
  )
);

create policy "users can read their permitted appointments"
on public.appointments for select to authenticated
using (
  patient_id = (select auth.uid())
  or exists (
    select 1 from public.professionals p
    where p.id = appointments.professional_id and p.user_id = (select auth.uid())
  )
  or (
    public.current_app_role() in ('operator', 'admin')
    and (public.current_app_role() = 'admin' or clinic_id = public.current_user_clinic_id())
  )
);

create policy "patients can delete their held appointments"
on public.appointments for delete to authenticated
using (patient_id = (select auth.uid()) and status = 'held');

create policy "users can read payments for permitted appointments"
on public.payments for select to authenticated
using (
  exists (
    select 1 from public.appointments a
    where a.id = payments.appointment_id
  )
);

create policy "patients and assigned professionals can read clinical documents"
on public.clinical_documents for select to authenticated
using (
  patient_id = (select auth.uid())
  or exists (
    select 1
    from public.professionals p
    join public.appointments a
      on a.professional_id = p.id
     and a.patient_id = clinical_documents.patient_id
     and a.id = clinical_documents.appointment_id
     and a.status in ('confirmed', 'completed')
    where p.id = clinical_documents.professional_id
      and p.user_id = (select auth.uid())
  )
);

create policy "assigned professionals can create clinical documents"
on public.clinical_documents for insert to authenticated
with check (
  exists (
    select 1
    from public.professionals p
    join public.appointments a
      on a.professional_id = p.id
     and a.patient_id = clinical_documents.patient_id
     and a.id = clinical_documents.appointment_id
    where p.id = clinical_documents.professional_id
      and p.user_id = (select auth.uid())
      and p.active
      and a.status in ('confirmed', 'completed')
  )
);

create policy "users can read their own notifications"
on public.notifications for select to authenticated
using (user_id = (select auth.uid()));

grant usage on schema public to anon, authenticated;
grant select on public.clinics, public.professionals to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (name, email) on public.profiles to authenticated;
grant select, delete
  on public.appointments to authenticated;
grant select on public.payments to authenticated;
grant select, insert on public.clinical_documents to authenticated;
grant select on public.notifications to authenticated;
grant execute on function public.create_held_appointment(uuid, uuid, text, timestamptz, timestamptz)
  to authenticated;
grant execute on function public.reschedule_held_appointment(uuid, text, timestamptz, timestamptz)
  to authenticated;

revoke all on function public.current_app_role() from public, anon;
revoke all on function public.current_user_clinic_id() from public, anon;
grant execute on function public.current_app_role(), public.current_user_clinic_id()
  to anon, authenticated;
