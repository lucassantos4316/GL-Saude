export type AppRole = "patient" | "doctor" | "operator" | "admin";

export type User = {
  id: string;
  name: string | null;
  email: string | null;
  role: AppRole;
  clinicId: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

export * from "./_core/errors";
