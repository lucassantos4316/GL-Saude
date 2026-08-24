import { describe, expect, it } from "vitest";
import { clearAuthState, dashboardPath, isAppRole, persistSelectedRole } from "../shared/authFlow";

function storage() {
  const values = new Map<string, string>();
  return {
    values,
    setItem(key: string, value: string) { values.set(key, value); },
    removeItem(key: string) { values.delete(key); },
  };
}

describe("GGL saude auth flow", () => {
  it("accepts the three selectable profiles and builds their dashboard routes", () => {
    expect(isAppRole("patient")).toBe(true);
    expect(isAppRole("doctor")).toBe(true);
    expect(isAppRole("operator")).toBe(true);
    expect(isAppRole("admin")).toBe(false);
    expect(dashboardPath("patient")).toBe("/dashboard/patient");
    expect(dashboardPath("doctor")).toBe("/dashboard/doctor");
    expect(dashboardPath("operator")).toBe("/dashboard/operator");
  });

  it("persists the selected profile and clears it on logout", () => {
    const state = storage();
    expect(persistSelectedRole(state, "doctor")).toBe("/dashboard/doctor");
    expect(state.values.get("GGL saude-role")).toBe("doctor");
    state.values.set("manus-runtime-user-info", "session");
    expect(clearAuthState(state)).toBe("/");
    expect(state.values.size).toBe(0);
  });
});
