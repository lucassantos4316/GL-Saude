import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "../shared/types";
import type { Database } from "../client/src/lib/database.types";

type RequestSupabase = SupabaseClient<Database>;
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export async function hasCurrentAccountConsent(supabase: RequestSupabase) {
  const { data, error } = await supabase.rpc("has_current_account_consent");
  if (error) throw error;
  return data;
}

export async function recordCurrentAccountConsent(supabase: RequestSupabase) {
  const { error } = await supabase.rpc("record_current_account_consent");
  if (error) throw error;
}

function toUser(profile: ProfileRow): User {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    clinicId: profile.clinic_id,
    createdAt: new Date(profile.created_at),
    updatedAt: new Date(profile.updated_at),
    lastSignedIn: new Date(profile.last_signed_in_at),
  };
}

export async function getUserProfile(
  supabase: RequestSupabase,
  userId: string
): Promise<User | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? toUser(data) : null;
}

export async function updateUserProfile(
  supabase: RequestSupabase,
  userId: string,
  name: string,
  email: string | null
): Promise<User | null> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ name, email })
    .eq("id", userId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? toUser(data) : null;
}

export async function listProfessionals(
  supabase: RequestSupabase,
  filters?: { specialty?: string; clinicId?: string }
) {
  let query = supabase.from("professionals").select("*").eq("active", true);
  if (filters?.specialty) query = query.eq("specialty", filters.specialty);
  if (filters?.clinicId) query = query.eq("clinic_id", filters.clinicId);
  const { data, error } = await query.order("specialty");
  if (error) throw error;
  return data;
}

export async function listAppointmentsForPatient(
  supabase: RequestSupabase,
  patientId: string
) {
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("patient_id", patientId)
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function listPatientProfiles(
  supabase: RequestSupabase,
  ownerUserId: string
) {
  const { data, error } = await supabase
    .from("patient_profiles")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .eq("active", true)
    .order("is_self", { ascending: false })
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function updateSelfPatientProfile(
  supabase: RequestSupabase,
  ownerUserId: string,
  input: {
    fullName: string;
    cpf: string;
    birthDate: string;
    phone: string | null;
  }
) {
  const { data, error } = await supabase
    .from("patient_profiles")
    .update({
      full_name: input.fullName,
      cpf: input.cpf,
      birth_date: input.birthDate,
      phone: input.phone,
    })
    .eq("owner_user_id", ownerUserId)
    .eq("is_self", true)
    .eq("active", true)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createPatientProfile(
  supabase: RequestSupabase,
  ownerUserId: string,
  input: {
    fullName: string;
    cpf: string | null;
    birthDate: string;
    phone: string | null;
    relationship: string;
    consentEmail: string | null;
    legalGuardianConfirmed: boolean;
  }
) {
  const { data, error } = await supabase
    .from("patient_profiles")
    .insert({
      owner_user_id: ownerUserId,
      is_self: false,
      full_name: input.fullName,
      cpf: input.cpf,
      birth_date: input.birthDate,
      phone: input.phone,
      relationship: input.relationship,
      consent_email: input.consentEmail,
      legal_guardian_confirmed: input.legalGuardianConfirmed,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updatePatientProfile(
  supabase: RequestSupabase,
  ownerUserId: string,
  profileId: string,
  input: {
    fullName: string;
    cpf: string | null;
    birthDate: string;
    phone: string | null;
    relationship: string;
    consentEmail: string | null;
    legalGuardianConfirmed: boolean;
  }
) {
  const { data, error } = await supabase
    .from("patient_profiles")
    .update({
      full_name: input.fullName,
      cpf: input.cpf,
      birth_date: input.birthDate,
      phone: input.phone,
      relationship: input.relationship,
      consent_email: input.consentEmail,
      legal_guardian_confirmed: input.legalGuardianConfirmed,
    })
    .eq("id", profileId)
    .eq("owner_user_id", ownerUserId)
    .eq("is_self", false)
    .eq("active", true)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function archivePatientProfile(
  supabase: RequestSupabase,
  ownerUserId: string,
  profileId: string
) {
  const { data, error } = await supabase
    .from("patient_profiles")
    .update({ active: false })
    .eq("id", profileId)
    .eq("owner_user_id", ownerUserId)
    .eq("is_self", false)
    .eq("active", true)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function verifyAdultDependent(
  supabase: RequestSupabase,
  profileId: string
) {
  const { error } = await supabase.rpc("verify_adult_dependent", {
    p_patient_profile_id: profileId,
  });
  if (error) throw error;
}

export async function listPendingAdultDependents(supabase: RequestSupabase) {
  const { data, error } = await supabase.rpc("list_pending_adult_dependents");
  if (error) throw error;
  return data;
}

export async function createHeldAppointment(
  supabase: RequestSupabase,
  input: {
    professionalId: string;
    clinicId: string;
    kind: "consultation" | "exam";
    startsAt: Date;
    endsAt: Date;
    patientProfileId: string;
  }
) {
  const { data, error } = await supabase.rpc("create_held_appointment", {
    p_professional_id: input.professionalId,
    p_clinic_id: input.clinicId,
    p_kind: input.kind,
    p_starts_at: input.startsAt.toISOString(),
    p_ends_at: input.endsAt.toISOString(),
    p_patient_profile_id: input.patientProfileId,
  });
  if (error) throw error;
  return data;
}

export async function updateHeldAppointment(
  supabase: RequestSupabase,
  appointmentId: string,
  changes: {
    kind: "consultation" | "exam";
    startsAt: Date;
    endsAt: Date;
  }
) {
  const { data, error } = await supabase.rpc("reschedule_held_appointment", {
    p_appointment_id: appointmentId,
    p_kind: changes.kind,
    p_starts_at: changes.startsAt.toISOString(),
    p_ends_at: changes.endsAt.toISOString(),
  });
  if (error) throw error;
  return data;
}

export async function deleteHeldAppointment(
  supabase: RequestSupabase,
  appointmentId: string
) {
  const { error } = await supabase
    .from("appointments")
    .delete()
    .eq("id", appointmentId);
  if (error) throw error;
}

export async function listAppointmentsForProfessional(
  supabase: RequestSupabase,
  userId: string
) {
  const { data: professionals, error: professionalsError } = await supabase
    .from("professionals")
    .select("id")
    .eq("user_id", userId);
  if (professionalsError) throw professionalsError;
  if (professionals.length === 0) return [];

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .in("professional_id", professionals.map((professional) => professional.id))
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function listAllAppointments(
  supabase: RequestSupabase,
  clinicId?: string | null
) {
  let query = supabase.from("appointments").select("*");
  if (clinicId) query = query.eq("clinic_id", clinicId);
  const { data, error } = await query.order("starts_at", { ascending: true });
  if (error) throw error;
  return data;
}
