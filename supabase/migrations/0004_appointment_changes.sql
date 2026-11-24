create table public.appointment_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete restrict,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (
    action in (
      'created',
      'rescheduled',
      'cancelled',
      'cancellation_requested',
      'reschedule_requested',
      'change_request_approved',
      'change_request_rejected'
    )
  ),
  previous_status text,
  new_status text,
  previous_starts_at timestamptz,
  new_starts_at timestamptz,
  reason text,
  created_at timestamptz not null default now()
);

create index appointment_history_appointment_idx
  on public.appointment_history (appointment_id, created_at desc);

create table public.appointment_change_requests (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete restrict,
  requested_by uuid not null references public.profiles (id) on delete restrict,
  kind text not null check (kind in ('cancellation', 'reschedule')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reason text not null check (length(btrim(reason)) between 2 and 500),
  requested_starts_at timestamptz,
  requested_ends_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  check (
    (kind = 'cancellation' and requested_starts_at is null and requested_ends_at is null)
    or (
      kind = 'reschedule'
      and requested_starts_at is not null
      and requested_ends_at > requested_starts_at
    )
  )
);

create unique index appointment_change_one_pending_idx
  on public.appointment_change_requests (appointment_id)
  where status = 'pending';
create index appointment_change_requests_status_idx
  on public.appointment_change_requests (status, created_at);

alter table public.appointment_history enable row level security;
alter table public.appointment_change_requests enable row level security;

revoke all on public.appointment_history, public.appointment_change_requests
  from anon, authenticated;
grant select on public.appointment_history, public.appointment_change_requests
  to authenticated;

create policy "users can read permitted appointment history"
on public.appointment_history for select to authenticated
using (
  exists (
    select 1
    from public.appointments a
    where a.id = appointment_history.appointment_id
      and (
        a.patient_id = (select auth.uid())
        or a.booked_by = (select auth.uid())
        or exists (
          select 1 from public.professionals p
          where p.id = a.professional_id and p.user_id = (select auth.uid())
        )
        or (
          public.current_app_role() in ('operator', 'admin')
          and (
            public.current_app_role() = 'admin'
            or a.clinic_id = public.current_user_clinic_id()
          )
        )
      )
  )
);

create policy "users can read permitted appointment change requests"
on public.appointment_change_requests for select to authenticated
using (
  requested_by = (select auth.uid())
  or exists (
    select 1
    from public.appointments a
    where a.id = appointment_change_requests.appointment_id
      and (
        exists (
          select 1 from public.professionals p
          where p.id = a.professional_id and p.user_id = (select auth.uid())
        )
        or (
          public.current_app_role() in ('operator', 'admin')
          and (
            public.current_app_role() = 'admin'
            or a.clinic_id = public.current_user_clinic_id()
          )
        )
      )
  )
);

create or replace function public.record_appointment_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_action text;
  event_reason text;
begin
  event_reason := nullif(current_setting('gl_saude.change_reason', true), '');

  if tg_op = 'INSERT' then
    insert into public.appointment_history (
      appointment_id, actor_id, action, new_status, new_starts_at, reason
    )
    values (
      new.id, auth.uid(), 'created', new.status, new.starts_at, event_reason
    );
    return new;
  end if;

  if old.starts_at is distinct from new.starts_at
    or old.ends_at is distinct from new.ends_at then
    event_action := 'rescheduled';
  elsif old.status is distinct from new.status and new.status = 'cancelled' then
    event_action := 'cancelled';
  else
    return new;
  end if;

  insert into public.appointment_history (
    appointment_id, actor_id, action, previous_status, new_status,
    previous_starts_at, new_starts_at, reason
  )
  values (
    new.id, auth.uid(), event_action, old.status, new.status,
    old.starts_at, new.starts_at, event_reason
  );
  return new;
end;
$$;

create trigger appointments_record_history
after insert or update on public.appointments
for each row execute function public.record_appointment_history();

create or replace function public.record_appointment_change_request_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_action text;
begin
  if tg_op = 'INSERT' then
    event_action := case
      when new.kind = 'cancellation' then 'cancellation_requested'
      else 'reschedule_requested'
    end;
  elsif old.status = 'pending' and new.status in ('approved', 'rejected') then
    event_action := case
      when new.status = 'approved' then 'change_request_approved'
      else 'change_request_rejected'
    end;
  else
    return new;
  end if;

  insert into public.appointment_history (
    appointment_id, actor_id, action, reason
  )
  values (
    new.appointment_id,
    coalesce(new.reviewed_by, new.requested_by),
    event_action,
    coalesce(new.resolution_note, new.reason)
  );
  return new;
end;
$$;

create trigger appointment_change_requests_record_history
after insert or update on public.appointment_change_requests
for each row execute function public.record_appointment_change_request_history();

create or replace function public.request_appointment_change(
  p_appointment_id uuid,
  p_kind text,
  p_reason text,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  appointment_row public.appointments%rowtype;
  request_id uuid;
begin
  if auth.uid() is null or public.current_app_role() is distinct from 'patient' then
    raise exception 'Only authenticated patients can request appointment changes'
      using errcode = '42501';
  end if;

  if p_kind is null or p_kind not in ('cancellation', 'reschedule')
    or length(btrim(coalesce(p_reason, ''))) not between 2 and 500 then
    raise exception 'Provide a valid change type and reason'
      using errcode = '22023';
  end if;

  select * into appointment_row
  from public.appointments
  where id = p_appointment_id
    and (patient_id = auth.uid() or booked_by = auth.uid())
  for update;

  if not found then
    raise exception 'Appointment not found'
      using errcode = '42501';
  end if;

  if appointment_row.starts_at <= now()
    or appointment_row.status not in ('held', 'confirmed', 'pending_payment') then
    raise exception 'This appointment can no longer be changed'
      using errcode = '22023';
  end if;

  if p_kind = 'reschedule'
    and appointment_row.status = 'held'
    and (
      appointment_row.hold_expires_at is null
      or appointment_row.hold_expires_at <= now()
    ) then
    raise exception 'This temporary reservation has expired'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(appointment_row.professional_id::text, 0)
  );

  if p_kind = 'cancellation' and appointment_row.status = 'held' then
    perform set_config('gl_saude.change_reason', btrim(p_reason), true);
    update public.appointments
    set status = 'cancelled', hold_expires_at = null
    where id = p_appointment_id
      and status = 'held'
      and (patient_id = auth.uid() or booked_by = auth.uid());
    if not found then
      raise exception 'Appointment is no longer available for cancellation'
        using errcode = '22023';
    end if;
    return jsonb_build_object('status', 'cancelled', 'request_id', null);
  end if;

  if p_kind = 'reschedule' then
    if p_starts_at is null or p_ends_at is null
      or p_starts_at <= now() or p_ends_at <= p_starts_at then
      raise exception 'Select a valid future appointment slot'
        using errcode = '22023';
    end if;

    if not public.professional_slot_is_configured(
      appointment_row.professional_id,
      appointment_row.clinic_id,
      p_starts_at,
      p_ends_at
    ) then
      raise exception 'The selected time is outside the professional schedule'
        using errcode = '22023';
    end if;

    if exists (
      select 1
      from public.appointments a
      where a.id <> p_appointment_id
        and a.professional_id = appointment_row.professional_id
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

    if appointment_row.status = 'held' then
      perform set_config('gl_saude.change_reason', btrim(p_reason), true);
      update public.appointments
      set starts_at = p_starts_at, ends_at = p_ends_at
      where id = p_appointment_id
        and status = 'held'
        and (patient_id = auth.uid() or booked_by = auth.uid());
      if not found then
        raise exception 'Appointment is no longer available for rescheduling'
          using errcode = '22023';
      end if;
      return jsonb_build_object('status', 'rescheduled', 'request_id', null);
    end if;
  elsif p_kind = 'cancellation' and appointment_row.status = 'held' then
    raise exception 'This reservation has already changed'
      using errcode = '22023';
  end if;

  insert into public.appointment_change_requests (
    appointment_id, requested_by, kind, reason,
    requested_starts_at, requested_ends_at
  )
  values (
    p_appointment_id, auth.uid(), p_kind, btrim(p_reason),
    case when p_kind = 'reschedule' then p_starts_at end,
    case when p_kind = 'reschedule' then p_ends_at end
  )
  returning id into request_id;

  return jsonb_build_object('status', 'pending_review', 'request_id', request_id);
end;
$$;

revoke all on function public.request_appointment_change(
  uuid, text, text, timestamptz, timestamptz
) from public, anon;
grant execute on function public.request_appointment_change(
  uuid, text, text, timestamptz, timestamptz
) to authenticated;

create or replace function public.resolve_appointment_change_request(
  p_request_id uuid,
  p_approve boolean,
  p_resolution_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.appointment_change_requests%rowtype;
  appointment_row public.appointments%rowtype;
begin
  if auth.uid() is null
    or (
      public.current_app_role() is distinct from 'operator'
      and public.current_app_role() is distinct from 'admin'
    ) then
    raise exception 'Clinic staff authorization is required'
      using errcode = '42501';
  end if;

  select r.* into request_row
  from public.appointment_change_requests r
  join public.appointments a on a.id = r.appointment_id
  where r.id = p_request_id
    and r.status = 'pending'
    and (
      public.current_app_role() = 'admin'
      or a.clinic_id = public.current_user_clinic_id()
    )
  for update of r;

  if not found then
    raise exception 'Pending request not found for this clinic'
      using errcode = '42501';
  end if;

  select * into appointment_row
  from public.appointments
  where id = request_row.appointment_id
  for update;

  if appointment_row.status not in ('confirmed', 'pending_payment') then
    raise exception 'Appointment is no longer eligible for review'
      using errcode = '22023';
  end if;

  if p_approve and request_row.kind = 'reschedule' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(appointment_row.professional_id::text, 0)
    );

    if request_row.requested_starts_at <= now()
      or not public.professional_slot_is_configured(
        appointment_row.professional_id,
        appointment_row.clinic_id,
        request_row.requested_starts_at,
        request_row.requested_ends_at
      ) then
      raise exception 'Requested time is no longer available'
        using errcode = '23P01';
    end if;

    if exists (
      select 1
      from public.appointments a
      where a.id <> appointment_row.id
        and a.professional_id = appointment_row.professional_id
        and a.starts_at < request_row.requested_ends_at
        and a.ends_at > request_row.requested_starts_at
        and (
          a.status in ('pending_payment', 'confirmed')
          or (a.status = 'held' and a.hold_expires_at > now())
        )
    ) then
      raise exception 'Requested time is no longer available'
        using errcode = '23P01';
    end if;
  end if;

  update public.appointment_change_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      resolution_note = nullif(btrim(p_resolution_note), '')
  where id = p_request_id;

  if p_approve and request_row.kind = 'cancellation' then
    perform set_config(
      'gl_saude.change_reason',
      coalesce(nullif(btrim(p_resolution_note), ''), request_row.reason),
      true
    );
    update public.appointments
    set status = 'cancelled', hold_expires_at = null
    where id = appointment_row.id;
  elsif p_approve and request_row.kind = 'reschedule' then
    perform set_config(
      'gl_saude.change_reason',
      coalesce(nullif(btrim(p_resolution_note), ''), request_row.reason),
      true
    );
    update public.appointments
    set starts_at = request_row.requested_starts_at,
        ends_at = request_row.requested_ends_at
    where id = appointment_row.id;
  end if;
end;
$$;

revoke all on function public.resolve_appointment_change_request(uuid, boolean, text)
  from public, anon;
grant execute on function public.resolve_appointment_change_request(uuid, boolean, text)
  to authenticated;

revoke all on function public.request_appointment_change(uuid, text, text, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.request_appointment_change(uuid, text, text, timestamptz, timestamptz)
  to authenticated;
revoke all on function public.resolve_appointment_change_request(uuid, boolean, text)
  from public, anon;
grant execute on function public.resolve_appointment_change_request(uuid, boolean, text)
  to authenticated;
revoke all on function public.record_appointment_history()
  from public, anon, authenticated;
revoke all on function public.record_appointment_change_request_history()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
