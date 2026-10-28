import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, roleProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createHeldAppointment, deleteHeldAppointment, listAllAppointments, listAppointmentsForPatient, listAppointmentsForProfessional, listProfessionals, updateHeldAppointment, updateUserProfile } from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
  }),

  profile: router({
    me: protectedProcedure.query(({ ctx }) => ({
      id: ctx.user.id,
      name: ctx.user.name,
      email: ctx.user.email,
      role: ctx.user.role,
      createdAt: ctx.user.createdAt,
    })),
    update: protectedProcedure
      .input(z.object({
        name: z.string().trim().min(1).max(255),
        email: z.string().trim().max(320).pipe(z.union([z.email(), z.literal("")])),
      }))
      .mutation(async ({ ctx, input }) => {
        const updated = await updateUserProfile(ctx.supabase, ctx.user.id, input.name, input.email || null);
        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Não foi possível localizar o perfil para atualizar.",
          });
        }
        return updated;
      }),
  }),

  roles: router({
    current: protectedProcedure.query(({ ctx }) => ({
      role: ctx.user.role,
      label: ctx.user.role === "doctor" ? "Médico" : ctx.user.role === "operator" ? "Operador" : "Paciente",
      permissions: ctx.user.role === "doctor"
        ? ["view_own_schedule", "view_reports"]
        : ctx.user.role === "operator"
          ? ["manage_clinic_schedule", "book_for_patient", "reschedule_appointments", "cancel_appointments"]
          : ["search_professionals", "book_appointments", "pay_appointments", "view_own_history", "cancel_own_appointments"],
    })),
  }),

  doctor: router({
    dashboard: roleProcedure("doctor").query(({ ctx }) => ({ role: ctx.user.role, title: "Painel do Médico", capabilities: ["agenda diária e semanal", "relatórios"] })),
    agenda: roleProcedure("doctor").query(({ ctx }) => listAppointmentsForProfessional(ctx.supabase, ctx.user.id)),
  }),

  operator: router({
    dashboard: roleProcedure("operator", "admin").query(({ ctx }) => ({ role: ctx.user.role, title: "Painel do Operador", capabilities: ["agendar em nome do paciente", "cancelar", "reagendar", "visualizar agenda da clínica"] })),
    clinicAgenda: roleProcedure("operator", "admin").input(z.object({ clinicId: z.string().uuid().optional() }).optional()).query(({ ctx, input }) => listAllAppointments(ctx.supabase, input?.clinicId ?? ctx.user.clinicId)),
  }),

  patient: router({
    dashboard: roleProcedure("patient").query(({ ctx }) => ({ role: ctx.user.role, title: "Painel do Paciente", capabilities: ["buscar profissionais", "agendar consulta ou exame", "pagar", "consultar histórico", "cancelar", "reagendar"] })),
  }),

  clinic: router({
    professionals: publicProcedure.input(z.object({ specialty: z.string().optional(), clinicId: z.string().uuid().optional() }).optional()).query(({ ctx, input }) => listProfessionals(ctx.supabase, input)),
    myAppointments: roleProcedure("patient").query(({ ctx }) => listAppointmentsForPatient(ctx.supabase, ctx.user.id)),
    holdSlot: roleProcedure("patient").input(z.object({ professionalId: z.string().uuid(), clinicId: z.string().uuid(), kind: z.enum(["consultation", "exam"]), startsAt: z.coerce.date(), endsAt: z.coerce.date() })).mutation(({ ctx, input }) => createHeldAppointment(ctx.supabase, input)),
    updateHeldSlot: roleProcedure("patient").input(z.object({ appointmentId: z.string().uuid(), kind: z.enum(["consultation", "exam"]), startsAt: z.coerce.date(), endsAt: z.coerce.date() })).mutation(({ ctx, input }) => updateHeldAppointment(ctx.supabase, input.appointmentId, input)),
    deleteHeldSlot: roleProcedure("patient").input(z.object({ appointmentId: z.string().uuid() })).mutation(({ ctx, input }) => deleteHeldAppointment(ctx.supabase, input.appointmentId)),
  }),

});

export type AppRouter = typeof appRouter;
