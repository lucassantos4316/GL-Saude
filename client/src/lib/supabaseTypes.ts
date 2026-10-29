import type { Database } from "./database.types";

export type Tables<Name extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][Name]["Row"];
