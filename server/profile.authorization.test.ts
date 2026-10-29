import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  createHeldAppointment: vi.fn(),
  deleteHeldAppointment: vi.fn(),
  getUserProfile: vi.fn(),
  listAllAppointments: vi.fn(),
  listAppointmentsForPatient: vi.fn(),
  listAppointmentsForProfessional: vi.fn(),
  listProfessionals: vi.fn(),
  updateHeldAppointment: vi.fn(),
  updateUserProfile: vi.fn(async (_client, id: string, name: string, email: string | null) => ({
    id,
    name,
    email,
    role: "doctor" as const,
    clinicId: null,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    lastSignedIn: new Date("2025-01-01T00:00:00Z"),
  })),
}));

import { updateUserProfile } from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type Role = "patient" | "doctor" | "operator" | "admin";
const testUserId = "61c39c17-7401-41e7-9e2d-7bed9ade60a0";

function context(role: Role | null, id = testUserId): TrpcContext {
  return {
    user: role
      ? {
          id,
          email: `${role}@example.com`,
          name: `${role} test`,
          role,
          clinicId: null,
          createdAt: new Date("2024-01-01T00:00:00Z"),
          updatedAt: new Date("2024-01-01T00:00:00Z"),
          lastSignedIn: new Date("2024-01-01T00:00:00Z"),
        }
      : null,
    supabase: {} as TrpcContext["supabase"],
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("profile procedures", () => {
  beforeEach(() => {
    vi.mocked(updateUserProfile).mockClear();
  });

  it("returns only the signed-in user's non-clinical profile fields for each role", async () => {
    for (const role of ["patient", "doctor", "operator", "admin"] as const) {
      const profile = await appRouter.createCaller(context(role)).profile.me();
      expect(profile).toMatchObject({
        id: testUserId,
        name: `${role} test`,
        email: `${role}@example.com`,
        role,
      });
      expect(profile).not.toHaveProperty("loginMethod");
    }
  });

  it("updates only the authenticated user's own profile and normalizes values", async () => {
    const ctx = context("doctor");
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.profile.update({ name: "  Dra. Exemplo  ", email: "   " }),
    ).resolves.toMatchObject({
      id: testUserId,
      name: "Dra. Exemplo",
      email: null,
    });
    expect(updateUserProfile).toHaveBeenCalledWith(
      ctx.supabase,
      testUserId,
      "Dra. Exemplo",
      null
    );
  });

  it("requires authentication and validates profile input before persistence", async () => {
    const anonymous = appRouter.createCaller(context(null));
    await expect(anonymous.profile.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      anonymous.profile.update({ name: "Paciente", email: "" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const patient = appRouter.createCaller(context("patient"));
    await expect(
      patient.profile.update({ name: " ", email: "não-é-email" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(updateUserProfile).not.toHaveBeenCalled();
  });
});
