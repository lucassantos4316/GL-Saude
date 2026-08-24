import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, roleProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { confirmAppointmentPayment, createClinicalDocument, createHeldAppointment, listAllAppointments, listAppointmentsForPatient, listAppointmentsForProfessional, listClinicalDocumentsForPatient, listProfessionals } from "./db";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  roles: router({
    current: protectedProcedure.query(({ ctx }) => ({
      role: ctx.user.role,
      label: ctx.user.role === "doctor" ? "Médico" : ctx.user.role === "operator" ? "Operador" : "Paciente",
      permissions: ctx.user.role === "doctor"
        ? ["view_own_schedule", "manage_clinical_documents", "view_reports"]
        : ctx.user.role === "operator"
          ? ["manage_clinic_schedule", "book_for_patient", "reschedule_appointments", "cancel_appointments"]
          : ["search_professionals", "book_appointments", "pay_appointments", "view_own_history", "cancel_own_appointments"],
    })),
  }),

  doctor: router({
    dashboard: roleProcedure("doctor").query(({ ctx }) => ({ role: ctx.user.role, title: "Painel do Médico", capabilities: ["agenda diária e semanal", "prontuário eletrônico", "laudo", "receita", "pedido de exame", "relatórios"] })),
    agenda: roleProcedure("doctor").input(z.object({ professionalId: z.number() })).query(({ input }) => listAppointmentsForProfessional(input.professionalId)),
    createDocument: roleProcedure("doctor").input(z.object({ patientId: z.number(), professionalId: z.number(), appointmentId: z.number().optional(), type: z.enum(["record", "report", "prescription", "exam_request"]), title: z.string().min(1), content: z.string().min(1) })).mutation(({ input }) => createClinicalDocument(input)),
  }),

  operator: router({
    dashboard: roleProcedure("operator").query(({ ctx }) => ({ role: ctx.user.role, title: "Painel do Operador", capabilities: ["agendar em nome do paciente", "cancelar", "reagendar", "visualizar agenda da clínica"] })),
    clinicAgenda: roleProcedure("operator").input(z.object({ clinicId: z.number().optional() }).optional()).query(({ input }) => listAllAppointments(input?.clinicId)),
  }),

  patient: router({
    dashboard: roleProcedure("patient").query(({ ctx }) => ({ role: ctx.user.role, title: "Painel do Paciente", capabilities: ["buscar profissionais", "agendar consulta ou exame", "pagar", "consultar histórico", "cancelar", "reagendar"] })),
    documents: roleProcedure("patient").query(({ ctx }) => listClinicalDocumentsForPatient(ctx.user.id)),
  }),

  clinic: router({
    professionals: publicProcedure.input(z.object({ specialty: z.string().optional(), clinicId: z.number().optional() }).optional()).query(({ input }) => listProfessionals(input)),
    myAppointments: roleProcedure("patient").query(({ ctx }) => listAppointmentsForPatient(ctx.user.id)),
    holdSlot: roleProcedure("patient", "operator").input(z.object({ professionalId: z.number(), clinicId: z.number(), kind: z.enum(["consultation", "exam"]), startsAt: z.coerce.date(), endsAt: z.coerce.date() })).mutation(({ ctx, input }) => createHeldAppointment({ ...input, patientId: ctx.user.id })),
    confirmPayment: roleProcedure("patient", "operator").input(z.object({ appointmentId: z.number(), method: z.enum(["pix", "credit_card"]), amount: z.string(), gatewayReference: z.string().min(1) })).mutation(({ input }) => confirmAppointmentPayment(input.appointmentId, input.method, input.amount, input.gatewayReference)),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
