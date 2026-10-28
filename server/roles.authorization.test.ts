import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  createHeldAppointment: vi.fn(async () => "1c5e1f4a-0c25-42df-9ed0-98a5bb8cfd28"),
  deleteHeldAppointment: vi.fn(async () => undefined),
  getUserProfile: vi.fn(),
  listAllAppointments: vi.fn(async () => []),
  listAppointmentsForPatient: vi.fn(async () => []),
  listAppointmentsForProfessional: vi.fn(async () => []),
  listProfessionals: vi.fn(async () => []),
  updateHeldAppointment: vi.fn(async () => "1c5e1f4a-0c25-42df-9ed0-98a5bb8cfd28"),
  updateUserProfile: vi.fn(),
}));

import { createHeldAppointment } from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type Role = "patient" | "doctor" | "operator";
const ids = {
  patient: "61c39c17-7401-41e7-9e2d-7bed9ade60a0",
  doctor: "3e48090f-9854-4a2f-8984-1339d4c0ca52",
  operator: "091d45df-c5dc-4ed8-b160-525148eb7123",
};

function context(role: Role): TrpcContext {
  return {
    user: {
      id: ids[role],
      email: `${role}@example.com`,
      name: role,
      role,
      clinicId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    supabase: {} as TrpcContext["supabase"],
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("GL Saúde role authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes the correct capabilities for each role", async () => {
    const patient = await appRouter.createCaller(context("patient")).roles.current();
    const doctor = await appRouter.createCaller(context("doctor")).roles.current();
    const operator = await appRouter.createCaller(context("operator")).roles.current();

    expect(patient.label).toBe("Paciente");
    expect(patient.permissions).toContain("book_appointments");
    expect(doctor.label).toBe("Médico");
    expect(doctor.permissions).not.toContain("manage_clinical_documents");
    expect(operator.label).toBe("Operador");
    expect(operator.permissions).toContain("manage_clinic_schedule");
  });

  it("blocks role-specific dashboards from the wrong role", async () => {
    const patient = appRouter.createCaller(context("patient"));
    const doctor = appRouter.createCaller(context("doctor"));
    const operator = appRouter.createCaller(context("operator"));

    await expect(patient.doctor.dashboard()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(patient.operator.dashboard()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(doctor.patient.dashboard()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(doctor.operator.dashboard()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(operator.patient.dashboard()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(operator.doctor.dashboard()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(patient.patient.dashboard()).resolves.toMatchObject({ role: "patient" });
    await expect(doctor.doctor.dashboard()).resolves.toMatchObject({ role: "doctor" });
    await expect(operator.operator.dashboard()).resolves.toMatchObject({ role: "operator" });
  });

  it("scopes appointment reads through the authenticated Supabase client", async () => {
    const patient = appRouter.createCaller(context("patient"));
    const doctor = appRouter.createCaller(context("doctor"));
    const operator = appRouter.createCaller(context("operator"));

    await expect(patient.clinic.myAppointments()).resolves.toEqual([]);
    await expect(doctor.doctor.agenda()).resolves.toEqual([]);
    await expect(operator.operator.clinicAgenda()).resolves.toEqual([]);
  });

  it("restricts booking and appointment mutation to patient role", async () => {
    const patient = appRouter.createCaller(context("patient"));
    const doctor = appRouter.createCaller(context("doctor"));
    const operator = appRouter.createCaller(context("operator"));
    const input = {
      professionalId: "3e48090f-9854-4a2f-8984-1339d4c0ca52",
      clinicId: "091d45df-c5dc-4ed8-b160-525148eb7123",
      kind: "consultation" as const,
      startsAt: new Date(Date.now() + 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 90 * 60 * 1000),
    };

    await expect(patient.clinic.holdSlot(input)).resolves.toBeTruthy();
    expect(createHeldAppointment).toHaveBeenCalled();
    for (const caller of [doctor, operator]) {
      await expect(caller.clinic.holdSlot(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        caller.clinic.deleteHeldSlot({ appointmentId: input.professionalId })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });
});
