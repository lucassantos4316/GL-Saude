import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    updateUserProfile: vi.fn(async (id: number, name: string, email: string | null) => ({
      id,
      name,
      email,
      role: "patient" as const,
      createdAt: new Date("2025-01-01T00:00:00Z"),
    })),
  };
});

import { updateUserProfile } from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type Role = "patient" | "doctor" | "operator" | "admin";

function context(role: Role | null, id = 12): TrpcContext {
  return {
    user: role
      ? {
          id,
          openId: `${role}-profile-test`,
          email: `${role}@example.com`,
          name: `${role} test`,
          loginMethod: "test",
          role,
          createdAt: new Date("2024-01-01T00:00:00Z"),
          updatedAt: new Date("2024-01-01T00:00:00Z"),
          lastSignedIn: new Date("2024-01-01T00:00:00Z"),
          failedLoginAttempts: 0,
          lockedUntil: null,
        }
      : null,
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
      const profile = await appRouter.createCaller(context(role, 31)).profile.me();
      expect(profile).toMatchObject({
        id: 31,
        name: `${role} test`,
        email: `${role}@example.com`,
        role,
      });
      expect(profile).not.toHaveProperty("openId");
      expect(profile).not.toHaveProperty("loginMethod");
    }
  });

  it("updates only the authenticated user's own profile and normalizes values", async () => {
    const caller = appRouter.createCaller(context("doctor", 42));

    await expect(
      caller.profile.update({ name: "  Dra. Exemplo  ", email: "   " }),
    ).resolves.toMatchObject({
      id: 42,
      name: "Dra. Exemplo",
      email: null,
    });
    expect(updateUserProfile).toHaveBeenCalledWith(42, "Dra. Exemplo", null);
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
