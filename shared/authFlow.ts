export type AppRole = "patient" | "doctor" | "operator";

export const APP_ROLES: readonly AppRole[] = ["patient", "doctor", "operator"];

export function isAppRole(value: string | null | undefined): value is AppRole {
  return value !== null && value !== undefined && APP_ROLES.includes(value as AppRole);
}

export function dashboardPath(role: AppRole) {
  return `/dashboard/${role}`;
}

export function persistSelectedRole(storage: Pick<Storage, "setItem">, role: AppRole) {
  storage.setItem("GGL saude-role", role);
  return dashboardPath(role);
}

export function clearAuthState(storage: Pick<Storage, "removeItem">) {
  storage.removeItem("GGL saude-role");
  storage.removeItem("manus-runtime-user-info");
  return "/";
}
