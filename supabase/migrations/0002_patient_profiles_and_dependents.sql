create or replace function public.is_valid_cpf(p_cpf text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  digits text := pg_catalog.regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
  weighted_sum integer;
  check_digit integer;
  index integer;
begin
  if length(digits) <> 11 or digits = repeat(substr(digits, 1, 1), 11) then
    return false;
  end if;

  weighted_sum := 0;
  for index in 1..9 loop
    weighted_sum := weighted_sum
      + substr(digits, index, 1)::integer * (11 - index);
  end loop;
  check_digit := (weighted_sum * 10) % 11;
  if check_digit = 10 then check_digit := 0; end if;
  if check_digit <> substr(digits, 10, 1)::integer then return false; end if;

  weighted_sum := 0;
  for index in 1..10 loop
    weighted_sum := weighted_sum
      + substr(digits, index, 1)::integer * (12 - index);
  end loop;
  check_digit := (weighted_sum * 10) % 11;
  if check_digit = 10 then check_digit := 0; end if;
  return check_digit = substr(digits, 11, 1)::integer;
end;
$$;

create table if not exists public.patient_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete restrict,
  is_self boolean not null default false,
  full_name text not null check (length(btrim(full_name)) between 3 and 255),
  cpf text check (cpf is null or public.is_valid_cpf(cpf)),
  birth_date date,
  phone text,
  relationship text not null default 'self'
    check (length(btrim(relationship)) between 2 and 80),
  consent_email text,
  legal_guardian_confirmed boolean not null default false,
  authorization_status text not null default 'pending'
    check (authorization_status in ('self', 'guardian_attested', 'pending', 'verified', 'revoked')),
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  postal_code text check (postal_code is null or postal_code ~ '^[0-9]{8}$'),
  street text,
  street_number text,
  complement text,
  district text,
  city text,
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (is_self and relationship = 'self')
    or (not is_self and relationship <> 'self')
  ),
  check (is_self or birth_date is not null),
  check (
    not is_self
    or (authorization_status = 'self' and verified_by is null and verified_at is null)
  ),
  check (
    authorization_status <> 'verified'
    or (verified_by is not null and verified_at is not null)
  )
);

create unique index if not exists patient_profiles_one_self_per_owner
  on public.patient_profiles (owner_user_id) where is_self;
create unique index if not exists patient_profiles_cpf_per_owner
  on public.patient_profiles (owner_user_id, cpf) where cpf is not null;
create index if not exists patient_profiles_owner_idx
  on public.patient_profiles (owner_user_id, active, created_at);

create table if not exists public.account_consents (
  user_id uuid not null references auth.users (id) on delete restrict,
  terms_version text not null,
  privacy_version text not null,
  terms_accepted_at timestamptz not null,
  privacy_accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, terms_version, privacy_version)
);

alter table public.account_consents enable row level security;
drop policy if exists "users can read their account consents" on public.account_consents;
create policy "users can read their account consents"
on public.account_consents for select to authenticated
using (user_id = (select auth.uid()));

create or replace function public.has_current_account_consent()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.account_consents c
    where c.user_id = (select auth.uid())
      and c.terms_version = 'draft-2026-10-28'
      and c.privacy_version = 'draft-2026-10-28'
  );
$$;

create or replace function public.record_current_account_consent()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to record consent'
      using errcode = '42501';
  end if;

  insert into public.account_consents (
    user_id, terms_version, privacy_version,
    terms_accepted_at, privacy_accepted_at
  )
  values (
    auth.uid(), 'draft-2026-10-28', 'draft-2026-10-28', now(), now()
  )
  on conflict (user_id, terms_version, privacy_version) do nothing;
end;
$$;

create or replace function public.set_patient_profile_authorization()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.cpf is not null and not public.is_valid_cpf(new.cpf) then
    raise exception 'Patient CPF is invalid' using errcode = '22023';
  end if;

  if new.is_self then
    new.relationship := 'self';
    new.authorization_status := 'self';
    new.legal_guardian_confirmed := false;
    new.consent_email := null;
    new.verified_by := null;
    new.verified_at := null;
  elsif new.birth_date is not null
    and new.birth_date > current_date - interval '18 years'
    and new.legal_guardian_confirmed then
    new.authorization_status := 'guardian_attested';
    new.verified_by := null;
    new.verified_at := null;
  elsif new.birth_date <= current_date - interval '18 years'
    and new.consent_email is null then
    raise exception 'Adult dependents require their own email for consent verification'
      using errcode = '22023';
  elsif new.authorization_status <> 'verified'
    or new.birth_date is distinct from old.birth_date
    or new.owner_user_id is distinct from old.owner_user_id
    or new.consent_email is distinct from old.consent_email then
    new.authorization_status := 'pending';
    new.verified_by := null;
    new.verified_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists patient_profiles_set_authorization on public.patient_profiles;
create trigger patient_profiles_set_authorization
before insert or update on public.patient_profiles
for each row execute function public.set_patient_profile_authorization();

insert into public.profiles (id, name, email)
select
  u.id,
  coalesce(
    nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), '')
  ),
  u.email
from auth.users u
on conflict (id) do nothing;

insert into public.patient_profiles (
  id, owner_user_id, is_self, full_name, cpf, birth_date, phone,
  postal_code, street, street_number, complement, district, city, state
)
select
  p.id,
  p.id,
  true,
  coalesce(nullif(btrim(p.name), ''), 'Usuário'),
  case
    when public.is_valid_cpf(u.raw_user_meta_data ->> 'cpf')
      then nullif(regexp_replace(u.raw_user_meta_data ->> 'cpf', '[^0-9]', '', 'g'), '')
    else null
  end,
  nullif(u.raw_user_meta_data ->> 'birth_date', '')::date,
  nullif(regexp_replace(coalesce(u.raw_user_meta_data ->> 'phone', ''), '[^0-9]', '', 'g'), ''),
  nullif(regexp_replace(coalesce(u.raw_user_meta_data #>> '{address,postal_code}', ''), '[^0-9]', '', 'g'), ''),
  nullif(u.raw_user_meta_data #>> '{address,street}', ''),
  nullif(u.raw_user_meta_data #>> '{address,number}', ''),
  nullif(u.raw_user_meta_data #>> '{address,complement}', ''),
  nullif(u.raw_user_meta_data #>> '{address,district}', ''),
  nullif(u.raw_user_meta_data #>> '{address,city}', ''),
  nullif(upper(u.raw_user_meta_data #>> '{address,state}'), '')
from public.profiles p
join auth.users u on u.id = p.id
on conflict (id) do nothing;

create or replace function public.create_profile_for_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata_address jsonb := coalesce(new.raw_user_meta_data -> 'address', '{}'::jsonb);
  dependent jsonb := new.raw_user_meta_data -> 'initial_dependent';
  account_purpose text := new.raw_user_meta_data ->> 'account_purpose';
  account_birth_date date;
  dependent_birth_date date;
begin
  if account_purpose is not null
    and account_purpose not in ('self', 'minor', 'adult') then
    raise exception 'Invalid account purpose' using errcode = '22023';
  end if;

  if account_purpose in ('self', 'minor', 'adult') then
    if coalesce(new.raw_user_meta_data ->> 'terms_accepted', '') <> 'true'
      or coalesce(new.raw_user_meta_data ->> 'privacy_accepted', '') <> 'true'
      or coalesce(new.raw_user_meta_data ->> 'terms_version', '') <> 'draft-2026-10-28'
      or coalesce(new.raw_user_meta_data ->> 'privacy_version', '') <> 'draft-2026-10-28' then
      raise exception 'Current terms and privacy consent are required'
        using errcode = '22023';
    end if;

    if not public.is_valid_cpf(new.raw_user_meta_data ->> 'cpf') then
      raise exception 'A valid account-holder CPF is required'
        using errcode = '22023';
    end if;

    account_birth_date := nullif(new.raw_user_meta_data ->> 'birth_date', '')::date;
    if account_birth_date is null
      or account_birth_date > current_date - interval '18 years' then
      raise exception 'The account holder must be at least 18 years old'
        using errcode = '22023';
    end if;

    if length(regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '[^0-9]', '', 'g')) < 10
      or length(regexp_replace(coalesce(metadata_address ->> 'postal_code', ''), '[^0-9]', '', 'g')) <> 8
      or nullif(btrim(metadata_address ->> 'street'), '') is null
      or nullif(btrim(metadata_address ->> 'number'), '') is null
      or nullif(btrim(metadata_address ->> 'district'), '') is null
      or nullif(btrim(metadata_address ->> 'city'), '') is null
      or length(btrim(coalesce(metadata_address ->> 'state', ''))) <> 2 then
      raise exception 'Complete contact and address details are required'
        using errcode = '22023';
    end if;

    if account_purpose = 'self' and jsonb_typeof(dependent) = 'object' then
      raise exception 'A self account cannot include an initial dependent'
        using errcode = '22023';
    end if;
    if account_purpose in ('minor', 'adult')
      and jsonb_typeof(dependent) is distinct from 'object' then
      raise exception 'Dependent details are required for this account purpose'
        using errcode = '22023';
    end if;
  end if;

  if account_purpose in ('minor', 'adult') then
    if length(btrim(coalesce(dependent ->> 'name', ''))) < 3
      or length(btrim(coalesce(dependent ->> 'relationship', ''))) < 2 then
      raise exception 'Dependent name and relationship are required'
        using errcode = '22023';
    end if;

    dependent_birth_date := nullif(dependent ->> 'birth_date', '')::date;
    if dependent_birth_date is null then
      raise exception 'Dependent birth date is required'
        using errcode = '22023';
    end if;
    if nullif(dependent ->> 'cpf', '') is not null
      and not public.is_valid_cpf(dependent ->> 'cpf') then
      raise exception 'Dependent CPF is invalid' using errcode = '22023';
    end if;

    if account_purpose = 'minor'
      and (dependent_birth_date <= current_date - interval '18 years'
        or coalesce((dependent ->> 'legal_guardian_confirmed')::boolean, false) is false) then
      raise exception 'A minor dependent requires a legal-guardian confirmation'
        using errcode = '22023';
    end if;
    if account_purpose = 'adult'
      and (dependent_birth_date > current_date - interval '18 years'
        or nullif(btrim(dependent ->> 'consent_email'), '') is null
        or lower(btrim(dependent ->> 'consent_email')) = lower(new.email)) then
      raise exception 'Adult dependents require their own email and consent verification'
        using errcode = '22023';
    end if;
  end if;

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
  set email = excluded.email,
      name = coalesce(public.profiles.name, excluded.name);

  insert into public.patient_profiles (
    id, owner_user_id, is_self, full_name, cpf, birth_date, phone, relationship,
    postal_code, street, street_number, complement, district, city, state
  )
  values (
    new.id,
    new.id,
    true,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      'Usuário'
    ),
    case
      when public.is_valid_cpf(new.raw_user_meta_data ->> 'cpf')
        then nullif(regexp_replace(new.raw_user_meta_data ->> 'cpf', '[^0-9]', '', 'g'), '')
      else null
    end,
    nullif(new.raw_user_meta_data ->> 'birth_date', '')::date,
    nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '[^0-9]', '', 'g'), ''),
    'self',
    nullif(regexp_replace(coalesce(metadata_address ->> 'postal_code', ''), '[^0-9]', '', 'g'), ''),
    nullif(metadata_address ->> 'street', ''),
    nullif(metadata_address ->> 'number', ''),
    nullif(metadata_address ->> 'complement', ''),
    nullif(metadata_address ->> 'district', ''),
    nullif(metadata_address ->> 'city', ''),
    nullif(upper(metadata_address ->> 'state'), '')
  )
  on conflict (id) do nothing;

  if jsonb_typeof(dependent) = 'object' then
    insert into public.patient_profiles (
      owner_user_id, is_self, full_name, cpf, birth_date, relationship,
      consent_email, legal_guardian_confirmed
    )
    values (
      new.id,
      false,
      btrim(dependent ->> 'name'),
      case
        when public.is_valid_cpf(dependent ->> 'cpf')
          then nullif(regexp_replace(dependent ->> 'cpf', '[^0-9]', '', 'g'), '')
        else null
      end,
      nullif(dependent ->> 'birth_date', '')::date,
      coalesce(nullif(btrim(dependent ->> 'relationship'), ''), 'outro'),
      nullif(lower(btrim(dependent ->> 'consent_email')), ''),
      coalesce((dependent ->> 'legal_guardian_confirmed')::boolean, false)
    );
  end if;

  if new.raw_user_meta_data ->> 'terms_accepted' = 'true'
    and new.raw_user_meta_data ->> 'privacy_accepted' = 'true'
    and new.raw_user_meta_data ->> 'terms_version' = 'draft-2026-10-28'
    and new.raw_user_meta_data ->> 'privacy_version' = 'draft-2026-10-28' then
    insert into public.account_consents (
      user_id, terms_version, privacy_version,
      terms_accepted_at, privacy_accepted_at
    )
    values (
      new.id,
      'draft-2026-10-28',
      'draft-2026-10-28',
      now(),
      now()
    )
    on conflict (user_id, terms_version, privacy_version) do nothing;
  end if;

  return new;
end;
$$;

alter table public.appointments
  add column if not exists patient_profile_id uuid
    references public.patient_profiles (id) on delete restrict,
  add column if not exists booked_by uuid
    references auth.users (id) on delete restrict;

update public.appointments a
set patient_profile_id = pp.id,
    booked_by = coalesce(a.booked_by, a.patient_id)
from public.patient_profiles pp
where pp.owner_user_id = a.patient_id
  and pp.is_self
  and a.patient_profile_id is null;

update public.appointments
set booked_by = patient_id
where booked_by is null;

create index if not exists appointments_patient_profile_idx
  on public.appointments (patient_profile_id, starts_at);

alter table public.clinical_documents
  add column if not exists patient_profile_id uuid
    references public.patient_profiles (id) on delete restrict;

update public.clinical_documents d
set patient_profile_id = a.patient_profile_id
from public.appointments a
where d.appointment_id = a.id
  and d.patient_profile_id is null;

create or replace function public.verify_adult_dependent(p_patient_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_app_role() is distinct from 'admin' then
    raise exception 'Only administrators can verify adult dependent authorization'
      using errcode = '42501';
  end if;

  update public.patient_profiles
  set authorization_status = 'verified',
      verified_by = auth.uid(),
      verified_at = now()
  where id = p_patient_profile_id
    and not is_self
    and active
    and birth_date <= current_date - interval '18 years'
    and authorization_status = 'pending'
    and consent_email is not null;

  if not found then
    raise exception 'Adult dependent not found or not eligible for verification'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.list_pending_adult_dependents()
returns table (
  patient_profile_id uuid,
  patient_name text,
  patient_birth_date date,
  consent_email text,
  relationship text,
  account_owner_name text,
  account_owner_email text,
  requested_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pp.id,
    pp.full_name,
    pp.birth_date,
    pp.consent_email,
    pp.relationship,
    coalesce(p.name, 'Usuário'),
    p.email,
    pp.created_at
  from public.patient_profiles pp
  join public.profiles p on p.id = pp.owner_user_id
  where public.current_app_role() = 'admin'
    and not pp.is_self
    and pp.active
    and pp.authorization_status = 'pending'
    and pp.birth_date <= current_date - interval '18 years'
    and pp.consent_email is not null
  order by pp.created_at;
$$;

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

  if p_kind not in ('consultation', 'exam') or p_ends_at <= p_starts_at
    or p_starts_at <= now() then
    raise exception 'Invalid appointment time or kind' using errcode = '22023';
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

drop function if exists public.create_held_appointment(
  uuid, uuid, text, timestamptz, timestamptz
);

alter table public.patient_profiles enable row level security;

drop policy if exists "owners can read their patient profiles" on public.patient_profiles;
create policy "owners can read their patient profiles"
on public.patient_profiles for select to authenticated
using (owner_user_id = (select auth.uid()));

drop policy if exists "owners can create dependent profiles" on public.patient_profiles;
create policy "owners can create dependent profiles"
on public.patient_profiles for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and not is_self
);

drop policy if exists "owners can update dependent profiles" on public.patient_profiles;
drop policy if exists "owners can update their patient profiles" on public.patient_profiles;
create policy "owners can update their patient profiles"
on public.patient_profiles for update to authenticated
using (owner_user_id = (select auth.uid()))
with check (owner_user_id = (select auth.uid()));

drop policy if exists "users can read their permitted appointments" on public.appointments;
create policy "users can read their permitted appointments"
on public.appointments for select to authenticated
using (
  patient_id = (select auth.uid())
  or booked_by = (select auth.uid())
  or exists (
    select 1 from public.professionals p
    where p.id = appointments.professional_id and p.user_id = (select auth.uid())
  )
  or (
    public.current_app_role() in ('operator', 'admin')
    and (public.current_app_role() = 'admin' or clinic_id = public.current_user_clinic_id())
  )
);

drop policy if exists "patients and assigned professionals can read clinical documents"
  on public.clinical_documents;
create policy "patients and assigned professionals can read clinical documents"
on public.clinical_documents for select to authenticated
using (
  patient_id = (select auth.uid())
  or exists (
    select 1
    from public.patient_profiles pp
    where pp.id = clinical_documents.patient_profile_id
      and pp.owner_user_id = (select auth.uid())
      and pp.active
  )
  or exists (
    select 1
    from public.professionals p
    join public.appointments a
      on a.professional_id = p.id
     and a.patient_id = clinical_documents.patient_id
     and a.id = clinical_documents.appointment_id
     and a.patient_profile_id is not distinct from clinical_documents.patient_profile_id
     and a.status in ('confirmed', 'completed')
    where p.id = clinical_documents.professional_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists "assigned professionals can create clinical documents"
  on public.clinical_documents;
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
     and a.patient_profile_id is not distinct from clinical_documents.patient_profile_id
    where p.id = clinical_documents.professional_id
      and p.user_id = (select auth.uid())
      and p.active
      and a.status in ('confirmed', 'completed')
  )
);

revoke all on public.patient_profiles from anon, authenticated;
grant select on public.patient_profiles to authenticated;
grant insert (
  owner_user_id, is_self, full_name, cpf, birth_date, phone, relationship,
  consent_email, legal_guardian_confirmed, postal_code, street, street_number,
  complement, district, city, state
) on public.patient_profiles to authenticated;
grant update (
  full_name, cpf, birth_date, phone, relationship, consent_email,
  legal_guardian_confirmed, postal_code, street, street_number,
  complement, district, city, state, active
) on public.patient_profiles to authenticated;
revoke all on public.account_consents from anon, authenticated;
grant select on public.account_consents to authenticated;
grant execute on function public.create_held_appointment(
  uuid, uuid, text, timestamptz, timestamptz, uuid
) to authenticated;
grant execute on function public.verify_adult_dependent(uuid) to authenticated;
revoke all on function public.create_held_appointment(
  uuid, uuid, text, timestamptz, timestamptz, uuid
) from public, anon;
revoke all on function public.verify_adult_dependent(uuid) from public, anon;
revoke all on function public.list_pending_adult_dependents() from public, anon;
grant execute on function public.list_pending_adult_dependents() to authenticated;
revoke all on function public.has_current_account_consent() from public, anon;
grant execute on function public.has_current_account_consent() to authenticated;
revoke all on function public.record_current_account_consent() from public, anon;
grant execute on function public.record_current_account_consent() to authenticated;
revoke all on function public.set_patient_profile_authorization() from public, anon, authenticated;

notify pgrst, 'reload schema';
