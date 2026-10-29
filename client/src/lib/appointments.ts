import type { Tables } from "./supabaseTypes";
import { supabase } from "./supabase";

export type Appointment = Tables<"appointments">;

export type NewAppointment = {
  professionalId: string;
  clinicId: string;
  kind: "consultation" | "exam";
  startsAt: string;
  endsAt: string;
  patientProfileId: string;
};

export async function createAppointment(input: NewAppointment): Promise<string> {
  const { data, error } = await supabase.rpc("create_held_appointment", {
    p_professional_id: input.professionalId,
    p_clinic_id: input.clinicId,
    p_kind: input.kind,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_patient_profile_id: input.patientProfileId,
  });
  if (error) throw error;
  return data;
}

export async function listAppointments(): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function updateAppointment(
  id: string,
  changes: Pick<Appointment, "kind" | "starts_at" | "ends_at">
): Promise<Appointment> {
  const { data: updatedId, error: updateError } = await supabase.rpc(
    "reschedule_held_appointment",
    {
      p_appointment_id: id,
      p_kind: changes.kind,
      p_starts_at: changes.starts_at,
      p_ends_at: changes.ends_at,
    }
  );
  if (updateError) throw updateError;

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", updatedId)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAppointment(id: string): Promise<void> {
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  if (error) throw error;
}
