alter table public.clinics
  add column if not exists timezone text not null default 'America/Sao_Paulo';

alter table public.professionals
  add constraint professionals_id_clinic_key unique (id, clinic_id);

create table public.professional_schedules (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null,
  clinic_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  slot_duration_minutes integer not null check (slot_duration_minutes between 10 and 240),
  effective_from date not null default current_date,
  effective_until date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (professional_id, clinic_id)
    references public.professionals (id, clinic_id) on delete cascade,
  check (ends_at > starts_at),
  check (effective_until is null or effective_until >= effective_from)
);

create index professional_schedules_lookup_idx
  on public.professional_schedules (professional_id, weekday, active, effective_from);

create table public.professional_schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null,
  clinic_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  foreign key (professional_id, clinic_id)
    references public.professionals (id, clinic_id) on delete cascade,
  check (ends_at > starts_at)
);

create index professional_schedule_exceptions_lookup_idx
  on public.professional_schedule_exceptions (professional_id, starts_at, ends_at);

alter table public.professional_schedules enable row level security;
alter table public.professional_schedule_exceptions enable row level security;

revoke all on public.professional_schedules, public.professional_schedule_exceptions
  from anon, authenticated;
grant select, insert, update, delete
  on public.professional_schedules, public.professional_schedule_exceptions
  to authenticated;

create policy "staff can manage schedules for their clinic"
on public.professional_schedules for all to authenticated
using (
  public.current_app_role() = 'admin'
  or (
    public.current_app_role() = 'operator'
    and clinic_id = public.current_user_clinic_id()
  )
  or exists (
    select 1
    from public.professionals p
    where p.id = professional_schedules.professional_id
      and p.clinic_id = professional_schedules.clinic_id
      and p.user_id = (select auth.uid())
      and public.current_app_role() = 'doctor'
  )
)
with check (
  public.current_app_role() = 'admin'
  or (
    public.current_app_role() = 'operator'
    and clinic_id = public.current_user_clinic_id()
  )
  or exists (
    select 1
    from public.professionals p
    where p.id = professional_schedules.professional_id
      and p.clinic_id = professional_schedules.clinic_id
      and p.user_id = (select auth.uid())
      and public.current_app_role() = 'doctor'
  )
);

create policy "staff can manage schedule exceptions for their clinic"
on public.professional_schedule_exceptions for all to authenticated
using (
  public.current_app_role() = 'admin'
  or (
    public.current_app_role() = 'operator'
    and clinic_id = public.current_user_clinic_id()
  )
  or exists (
    select 1
    from public.professionals p
    where p.id = professional_schedule_exceptions.professional_id
      and p.clinic_id = professional_schedule_exceptions.clinic_id
      and p.user_id = (select auth.uid())
      and public.current_app_role() = 'doctor'
  )
)
with check (
  public.current_app_role() = 'admin'
  or (
    public.current_app_role() = 'operator'
    and clinic_id = public.current_user_clinic_id()
  )
  or exists (
    select 1
    from public.professionals p
    where p.id = professional_schedule_exceptions.professional_id
      and p.clinic_id = professional_schedule_exceptions.clinic_id
      and p.user_id = (select auth.uid())
      and public.current_app_role() = 'doctor'
  )
);

create or replace function public.professional_slot_is_configured(
  p_professional_id uuid,
  p_clinic_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.professionals p
    join public.clinics c on c.id = p.clinic_id
    join public.professional_schedules s
      on s.professional_id = p.id
     and s.clinic_id = p.clinic_id
    where p.id = p_professional_id
      and p.clinic_id = p_clinic_id
      and p.active
      and s.active
      and (p_starts_at at time zone c.timezone)::date
        between s.effective_from and coalesce(s.effective_until, 'infinity'::date)
      and extract(dow from (p_starts_at at time zone c.timezone)::date)::smallint = s.weekday
      and (p_starts_at at time zone c.timezone)::time >= s.starts_at
      and (p_ends_at at time zone c.timezone)::time <= s.ends_at
      and p_ends_at - p_starts_at = s.slot_duration_minutes * interval '1 minute'
      and mod(
        extract(epoch from (
          (p_starts_at at time zone c.timezone)::time - s.starts_at
        )),
        s.slot_duration_minutes * 60
      ) = 0
      and not exists (
        select 1
        from public.professional_schedule_exceptions e
        where e.professional_id = p.id
          and e.starts_at < p_ends_at
          and e.ends_at > p_starts_at
      )
  );
$$;

revoke all on function public.professional_slot_is_configured(uuid, uuid, timestamptz, timestamptz)
  from public, anon, authenticated;

create or replace function public.get_professional_availability(
  p_professional_id uuid,
  p_from date,
  p_to date
)
returns table (
  starts_at timestamptz,
  ends_at timestamptz,
  local_date date,
  timezone text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  clinic_timezone text;
begin
  if auth.uid() is null or public.current_app_role() is distinct from 'patient' then
    raise exception 'Only authenticated patients can view professional availability'
      using errcode = '42501';
  end if;

  if p_from is null or p_to is null or p_to < p_from or p_to > p_from + 30 then
    raise exception 'Availability range must be between 1 and 31 days'
      using errcode = '22023';
  end if;

  select c.timezone into clinic_timezone
  from public.professionals p
  join public.clinics c on c.id = p.clinic_id
  where p.id = p_professional_id
    and p.active;

  if clinic_timezone is null then
    raise exception 'Professional is unavailable'
      using errcode = '22023';
  end if;

  if p_from < (now() at time zone clinic_timezone)::date then
    raise exception 'Availability cannot be requested for past dates'
      using errcode = '22023';
  end if;

  return query
  with dates as (
    select generated_date::date as appointment_date
    from pg_catalog.generate_series(p_from, p_to, interval '1 day') generated_date
  ),
  slots as (
    select distinct
      slot.local_start,
      slot.local_start + s.slot_duration_minutes * interval '1 minute' as local_end,
      c.timezone as clinic_timezone,
      p.clinic_id
    from public.professionals p
    join public.clinics c on c.id = p.clinic_id
    join public.professional_schedules s
      on s.professional_id = p.id
     and s.clinic_id = p.clinic_id
     and s.active
    join dates d
      on extract(dow from d.appointment_date)::smallint = s.weekday
     and d.appointment_date >= s.effective_from
     and (s.effective_until is null or d.appointment_date <= s.effective_until)
    cross join lateral pg_catalog.generate_series(
      d.appointment_date + s.starts_at,
      d.appointment_date + s.ends_at - s.slot_duration_minutes * interval '1 minute',
      s.slot_duration_minutes * interval '1 minute'
    ) as slot(local_start)
    where p.id = p_professional_id
      and p.active
  )
  select
    (s.local_start at time zone s.clinic_timezone),
    (s.local_end at time zone s.clinic_timezone),
    s.local_start::date,
    s.clinic_timezone
  from slots s
  where (s.local_start at time zone s.clinic_timezone) > now()
    and not exists (
      select 1
      from public.appointments a
      where a.professional_id = p_professional_id
        and a.starts_at < (s.local_end at time zone s.clinic_timezone)
        and a.ends_at > (s.local_start at time zone s.clinic_timezone)
        and (
          a.status in ('pending_payment', 'confirmed')
          or (a.status = 'held' and a.hold_expires_at > now())
        )
    )
    and not exists (
      select 1
      from public.professional_schedule_exceptions e
      where e.professional_id = p_professional_id
        and e.starts_at < (s.local_end at time zone s.clinic_timezone)
        and e.ends_at > (s.local_start at time zone s.clinic_timezone)
    )
  order by 1;
end;
$$;

revoke all on function public.get_professional_availability(uuid, date, date)
  from public, anon;
grant execute on function public.get_professional_availability(uuid, date, date)
  to authenticated;

create or replace function public.create_held_appointment(
  p_professional_id uuid,
  p_clinic_id uuid,
  p_kind text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_patient_profile_id uuid
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

  if p_kind is distinct from 'consultation' then
    raise exception 'Only consultation bookings are currently available'
      using errcode = '22023';
  end if;

  if p_ends_at <= p_starts_at or p_starts_at <= now() then
    raise exception 'Invalid appointment time' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.patient_profiles pp
    where pp.id = p_patient_profile_id
      and pp.owner_user_id = auth.uid()
      and pp.active
      and (
        (
          pp.is_self
          and pp.birth_date is not null
          and pp.birth_date <= current_date - interval '18 years'
        )
        or (
          not pp.is_self
          and pp.authorization_status in ('guardian_attested', 'verified')
        )
      )
  ) then
    raise exception 'Patient profile is not available for this account'
      using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_professional_id::text, 0)
  );

  if not public.professional_slot_is_configured(
    p_professional_id, p_clinic_id, p_starts_at, p_ends_at
  ) then
    raise exception 'The selected time is outside the professional schedule'
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
    patient_id, patient_profile_id, booked_by, professional_id, clinic_id,
    kind, starts_at, ends_at, hold_expires_at
  )
  values (
    auth.uid(), p_patient_profile_id, auth.uid(), p_professional_id, p_clinic_id,
    p_kind, p_starts_at, p_ends_at, now() + interval '10 minutes'
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
  current_clinic_id uuid;
begin
  if auth.uid() is null or public.current_app_role() is distinct from 'patient' then
    raise exception 'Only authenticated patients can reschedule appointments'
      using errcode = '42501';
  end if;

  if p_kind is distinct from 'consultation' then
    raise exception 'Only consultation bookings are currently available'
      using errcode = '22023';
  end if;

  if p_ends_at <= p_starts_at or p_starts_at <= now() then
    raise exception 'Invalid appointment time' using errcode = '22023';
  end if;

  select professional_id, clinic_id
  into current_professional_id, current_clinic_id
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

  if not public.professional_slot_is_configured(
    current_professional_id, current_clinic_id, p_starts_at, p_ends_at
  ) then
    raise exception 'The selected time is outside the professional schedule'
      using errcode = '22023';
  end if;

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
    and status = 'held'
    and hold_expires_at > now();

  if not found then
    raise exception 'Appointment not found or no longer editable'
      using errcode = '42501';
  end if;

  return p_appointment_id;
end;
$$;

notify pgrst, 'reload schema';
