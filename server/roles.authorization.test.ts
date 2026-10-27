import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type Role = "patient" | "doctor" | "operator";

function context(role: Role): TrpcContext {
  return {
    user: {
      id: role === "patient" ? 1 : role === "doctor" ? 2 : 3,
      openId: `${role}-test`,
      email: `${role}@example.com`,
      name: role,
      loginMethod: "test",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("GGL saude role authorization", () => {
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

  it("allows each role to access its read-only protected resources", async () => {
    const patient = appRouter.createCaller(context("patient"));
    const doctor = appRouter.createCaller(context("doctor"));
    const operator = appRouter.createCaller(context("operator"));

    await expect(patient.clinic.myAppointments()).resolves.toBeInstanceOf(Array);
    await expect(doctor.doctor.agenda({ professionalId: 1 })).resolves.toBeInstanceOf(Array);
    await expect(operator.operator.clinicAgenda()).resolves.toBeInstanceOf(Array);
  });

  it("protects patient booking and payment procedures from doctors and operators", async () => {
    const doctor = appRouter.createCaller(context("doctor"));
    const operator = appRouter.createCaller(context("operator"));
    const input = { professionalId: 1, clinicId: 1, kind: "consultation" as const, startsAt: new Date(), endsAt: new Date() };
    const payment = { appointmentId: 1, method: "pix" as const, amount: "100.00", gatewayReference: "test" };

    for (const caller of [doctor, operator]) {
      await expect(caller.clinic.myAppointments()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(doctor.clinic.holdSlot(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(doctor.clinic.confirmPayment(payment)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
