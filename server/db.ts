import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "../shared/types";
import type { Database } from "../client/src/lib/database.types";

type RequestSupabase = SupabaseClient<Database>;
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

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

export async function createHeldAppointment(
  supabase: RequestSupabase,
  input: {
    professionalId: string;
    clinicId: string;
    kind: "consultation" | "exam";
    startsAt: Date;
    endsAt: Date;
  }
) {
  const { data, error } = await supabase.rpc("create_held_appointment", {
    p_professional_id: input.professionalId,
    p_clinic_id: input.clinicId,
    p_kind: input.kind,
    p_starts_at: input.startsAt.toISOString(),
    p_ends_at: input.endsAt.toISOString(),
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
