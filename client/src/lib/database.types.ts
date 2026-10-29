export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      clinics: Table<
        { id: string; name: string; city: string | null; created_at: string },
        { id?: string; name: string; city?: string | null; created_at?: string },
        { id?: string; name?: string; city?: string | null; created_at?: string }
      >;
      profiles: Table<
        {
          id: string;
          name: string | null;
          email: string | null;
          role: "patient" | "doctor" | "operator" | "admin";
          clinic_id: string | null;
          created_at: string;
          updated_at: string;
          last_signed_in_at: string;
        },
        {
          id: string;
          name?: string | null;
          email?: string | null;
          role?: "patient" | "doctor" | "operator" | "admin";
          clinic_id?: string | null;
          created_at?: string;
          updated_at?: string;
          last_signed_in_at?: string;
        },
        {
          id?: string;
          name?: string | null;
          email?: string | null;
          role?: "patient" | "doctor" | "operator" | "admin";
          clinic_id?: string | null;
          created_at?: string;
          updated_at?: string;
          last_signed_in_at?: string;
        }
      >;
      professionals: Table<
        {
          id: string;
          user_id: string;
          clinic_id: string;
          display_name: string;
          specialty: string;
          crm: string;
          rating: number;
          consultation_price: number;
          active: boolean;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          clinic_id: string;
          display_name: string;
          specialty: string;
          crm: string;
          rating?: number;
          consultation_price: number;
          active?: boolean;
          created_at?: string;
        },
        {
          id?: string;
          user_id?: string;
          clinic_id?: string;
          display_name?: string;
          specialty?: string;
          crm?: string;
          rating?: number;
          consultation_price?: number;
          active?: boolean;
          created_at?: string;
        }
      >;
      appointments: Table<
        {
          id: string;
          patient_id: string;
          professional_id: string;
          clinic_id: string;
          kind: "consultation" | "exam";
          status: "held" | "pending_payment" | "confirmed" | "cancelled" | "completed";
          starts_at: string;
          ends_at: string;
          hold_expires_at: string | null;
          cancellation_policy: string | null;
          created_at: string;
        },
        {
          id?: string;
          patient_id: string;
          professional_id: string;
          clinic_id: string;
          kind: "consultation" | "exam";
          status?: "held" | "pending_payment" | "confirmed" | "cancelled" | "completed";
          starts_at: string;
          ends_at: string;
          hold_expires_at?: string | null;
          cancellation_policy?: string | null;
          created_at?: string;
        },
        {
          id?: string;
          patient_id?: string;
          professional_id?: string;
          clinic_id?: string;
          kind?: "consultation" | "exam";
          status?: "held" | "pending_payment" | "confirmed" | "cancelled" | "completed";
          starts_at?: string;
          ends_at?: string;
          hold_expires_at?: string | null;
          cancellation_policy?: string | null;
          created_at?: string;
        }
      >;
      payments: Table<
        {
          id: string;
          appointment_id: string;
          method: "pix" | "credit_card";
          status: "pending" | "confirmed" | "failed" | "refunded";
          amount: number;
          gateway_reference: string | null;
          confirmed_at: string | null;
          created_at: string;
        },
        {
          id?: string;
          appointment_id: string;
          method: "pix" | "credit_card";
          status?: "pending" | "confirmed" | "failed" | "refunded";
          amount: number;
          gateway_reference?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
        },
        {
          id?: string;
          appointment_id?: string;
          method?: "pix" | "credit_card";
          status?: "pending" | "confirmed" | "failed" | "refunded";
          amount?: number;
          gateway_reference?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
        }
      >;
      clinical_documents: Table<
        {
          id: string;
          patient_id: string;
          professional_id: string;
          appointment_id: string | null;
          type: "record" | "report" | "prescription" | "exam_request";
          title: string;
          content: string;
          created_at: string;
        },
        {
          id?: string;
          patient_id: string;
          professional_id: string;
          appointment_id?: string | null;
          type: "record" | "report" | "prescription" | "exam_request";
          title: string;
          content: string;
          created_at?: string;
        },
        {
          id?: string;
          patient_id?: string;
          professional_id?: string;
          appointment_id?: string | null;
          type?: "record" | "report" | "prescription" | "exam_request";
          title?: string;
          content?: string;
          created_at?: string;
        }
      >;
      notifications: Table<
        {
          id: string;
          user_id: string;
          appointment_id: string | null;
          channel: "email" | "whatsapp";
          event: "confirmation" | "cancellation" | "reminder_24h" | "reminder_1h" | "access_link";
          status: "queued" | "sent" | "failed";
          scheduled_for: string;
          sent_at: string | null;
          provider_reference: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          appointment_id?: string | null;
          channel: "email" | "whatsapp";
          event: "confirmation" | "cancellation" | "reminder_24h" | "reminder_1h" | "access_link";
          status?: "queued" | "sent" | "failed";
          scheduled_for: string;
          sent_at?: string | null;
          provider_reference?: string | null;
          created_at?: string;
        },
        {
          id?: string;
          user_id?: string;
          appointment_id?: string | null;
          channel?: "email" | "whatsapp";
          event?: "confirmation" | "cancellation" | "reminder_24h" | "reminder_1h" | "access_link";
          status?: "queued" | "sent" | "failed";
          scheduled_for?: string;
          sent_at?: string | null;
          provider_reference?: string | null;
          created_at?: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      create_held_appointment: {
        Args: {
          p_professional_id: string;
          p_clinic_id: string;
          p_kind: "consultation" | "exam";
          p_starts_at: string;
          p_ends_at: string;
        };
        Returns: string;
      };
      reschedule_held_appointment: {
        Args: {
          p_appointment_id: string;
          p_kind: "consultation" | "exam";
          p_starts_at: string;
          p_ends_at: string;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
