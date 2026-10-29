import { createClient } from "@supabase/supabase-js";
import type { Request } from "express";
import type { Database } from "../client/src/lib/database.types";

export function getSupabaseServerConfig() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be configured on the server.");
  }
  return { url, anonKey };
}

export function createRequestSupabase(req: Request) {
  const { url, anonKey } = getSupabaseServerConfig();
  const authorization = req.headers.authorization;
  const accessToken =
    typeof authorization === "string" && authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;

  const client = createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });

  return { client, accessToken };
}
