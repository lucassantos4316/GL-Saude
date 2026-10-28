import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("auth.me", () => {
  it("returns the profile resolved from the Supabase access token", async () => {
    const user: NonNullable<TrpcContext["user"]> = {
      id: "61c39c17-7401-41e7-9e2d-7bed9ade60a0",
      name: "Sample User",
      email: "sample@example.com",
      role: "patient",
      clinicId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const ctx: TrpcContext = {
      user,
      supabase: {} as TrpcContext["supabase"],
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };

    await expect(appRouter.createCaller(ctx).auth.me()).resolves.toEqual(user);
  });
});
