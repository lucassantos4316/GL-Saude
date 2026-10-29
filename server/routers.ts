import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, roleProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  archivePatientProfile,
  createHeldAppointment,
  createPatientProfile,
  deleteHeldAppointment,
  hasCurrentAccountConsent,
  listAllAppointments,
  listAppointmentsForPatient,
  listAppointmentsForProfessional,
  listPatientProfiles,
  listPendingAdultDependents,
  listProfessionals,
  recordCurrentAccountConsent,
  updateHeldAppointment,
  updatePatientProfile,
  updateSelfPatientProfile,
  updateUserProfile,
  verifyAdultDependent,
} from "./db";
import { isAdult, isValidCpf, onlyDigits } from "../shared/registration";

const patientProfileFields = z.object({
  fullName: z.string().trim().min(3).max(255),
  cpf: z.string().trim().optional().nullable().transform((value) => {
    const digits = onlyDigits(value ?? "");
    return digits || null;
  }).refine((value) => value === null || isValidCpf(value), "Informe um CPF válido."),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phone: z.string().trim().optional().nullable().transform((value) => {
    const digits = onlyDigits(value ?? "");
    return digits || null;
  }),
  relationship: z.string().trim().min(2).max(80),
  consentEmail: z.string().trim().toLowerCase()
    .pipe(z.union([z.email(), z.literal("")]))
    .transform((value) => value || null),
  legalGuardianConfirmed: z.boolean(),
});

function validatePatientProfile(
  input: z.infer<typeof patientProfileFields>,
  context: z.RefinementCtx
) {
  const birthDate = new Date(`${input.birthDate}T00:00:00`);
  if (!Number.isFinite(birthDate.getTime()) || birthDate >= new Date()) {
    context.addIssue({
      code: "custom",
      path: ["birthDate"],
      message: "Informe uma data de nascimento válida.",
    });
    return;
  }

  if (!isAdult(input.birthDate) && !input.legalGuardianConfirmed) {
    context.addIssue({
      code: "custom",
      path: ["legalGuardianConfirmed"],
      message: "Confirme que você é responsável legal pelo menor.",
    });
  }
  if (isAdult(input.birthDate) && !input.consentEmail) {
    context.addIssue({
      code: "custom",
      path: ["consentEmail"],
      message: "Informe o e-mail próprio do dependente adulto para autorização.",
    });
  }
}

const patientProfileInput = patientProfileFields.superRefine(validatePatientProfile);
const patientProfileUpdateInput = patientProfileFields
  .extend({ profileId: z.string().uuid() })
  .superRefine(validatePatientProfile);
const selfPatientProfileInput = z.object({
  fullName: z.string().trim().min(3).max(255),
  cpf: z.string().trim().transform(onlyDigits).refine(isValidCpf, "Informe um CPF válido."),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phone: z.string().trim().optional().nullable().transform((value) => {
    const digits = onlyDigits(value ?? "");
    return digits || null;
  }).refine((value) => value === null || value.length >= 10, "Informe um telefone com DDD."),
}).superRefine((input, context) => {
  const birthDate = new Date(`${input.birthDate}T00:00:00`);
  if (!Number.isFinite(birthDate.getTime()) || birthDate >= new Date() || !isAdult(input.birthDate)) {
    context.addIssue({
      code: "custom",
      path: ["birthDate"],
      message: "O titular da conta deve ser maior de 18 anos.",
    });
  }
});

function assertAdultConsentEmail(consentEmail: string | null, accountEmail: string | null) {
  if (consentEmail && accountEmail && consentEmail === accountEmail.toLowerCase()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Use o e-mail próprio do paciente adulto, diferente do e-mail do responsável.",
    });
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
  }),
  accountConsent: router({
    current: protectedProcedure.query(({ ctx }) =>
      hasCurrentAccountConsent(ctx.supabase)
    ),
    accept: protectedProcedure.mutation(async ({ ctx }) => {
      await recordCurrentAccountConsent(ctx.supabase);
      return { success: true };
    }),
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

  patientProfiles: router({
    list: roleProcedure("patient").query(({ ctx }) =>
      listPatientProfiles(ctx.supabase, ctx.user.id)
    ),
    updateSelf: roleProcedure("patient")
      .input(selfPatientProfileInput)
      .mutation(async ({ ctx, input }) => {
        const updated = await updateSelfPatientProfile(
          ctx.supabase,
          ctx.user.id,
          input
        );
        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Não foi possível localizar o perfil do titular da conta.",
          });
        }
        return updated;
      }),
    create: roleProcedure("patient")
      .input(patientProfileInput)
      .mutation(async ({ ctx, input }) => {
        assertAdultConsentEmail(input.consentEmail, ctx.user.email);
        return createPatientProfile(ctx.supabase, ctx.user.id, input);
      }),
    update: roleProcedure("patient")
      .input(patientProfileUpdateInput)
      .mutation(async ({ ctx, input }) => {
        assertAdultConsentEmail(input.consentEmail, ctx.user.email);
        const { profileId, ...changes } = input;
        const updated = await updatePatientProfile(
          ctx.supabase,
          ctx.user.id,
          profileId,
          changes
        );
        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "O perfil do dependente não foi encontrado ou não pode ser alterado.",
          });
        }
        return updated;
      }),
    archive: roleProcedure("patient")
      .input(z.object({ profileId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const archived = await archivePatientProfile(
          ctx.supabase,
          ctx.user.id,
          input.profileId
        );
        if (!archived) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "O perfil do dependente não foi encontrado ou já foi removido.",
          });
        }
        return { success: true };
      }),
    verifyAdult: roleProcedure("admin")
      .input(z.object({ profileId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await verifyAdultDependent(ctx.supabase, input.profileId);
        return { success: true };
      }),
    pendingAdultAuthorization: roleProcedure("admin").query(({ ctx }) =>
      listPendingAdultDependents(ctx.supabase)
    ),
  }),

  roles: router({
    current: protectedProcedure.query(({ ctx }) => ({
      role: ctx.user.role,
      label: ctx.user.role === "admin"
        ? "Administrador"
        : ctx.user.role === "doctor"
          ? "Médico"
          : ctx.user.role === "operator"
            ? "Operador"
            : "Paciente",
      permissions: ctx.user.role === "admin"
        ? ["manage_clinic_schedule", "review_dependent_authorizations"]
        : ctx.user.role === "doctor"
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
    holdSlot: roleProcedure("patient").input(z.object({ professionalId: z.string().uuid(), clinicId: z.string().uuid(), kind: z.enum(["consultation", "exam"]), startsAt: z.coerce.date(), endsAt: z.coerce.date(), patientProfileId: z.string().uuid() })).mutation(({ ctx, input }) => createHeldAppointment(ctx.supabase, input)),
    updateHeldSlot: roleProcedure("patient").input(z.object({ appointmentId: z.string().uuid(), kind: z.enum(["consultation", "exam"]), startsAt: z.coerce.date(), endsAt: z.coerce.date() })).mutation(({ ctx, input }) => updateHeldAppointment(ctx.supabase, input.appointmentId, input)),
    deleteHeldSlot: roleProcedure("patient").input(z.object({ appointmentId: z.string().uuid() })).mutation(({ ctx, input }) => deleteHeldAppointment(ctx.supabase, input.appointmentId)),
  }),

});

export type AppRouter = typeof appRouter;
