import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "../../shared/types";
import type { Database } from "../../client/src/lib/database.types";
import { getUserProfile } from "../db";
import { createRequestSupabase } from "../supabase";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  supabase: SupabaseClient<Database>;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  const { client: supabase, accessToken } = createRequestSupabase(opts.req);

  if (accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error && error.status !== 401) throw error;
    if (!error && data.user) {
      user = await getUserProfile(supabase, data.user.id);
      if (!user) {
        throw new Error(`Supabase Auth user ${data.user.id} has no profile row.`);
      }
      user.lastSignedIn = data.user.last_sign_in_at
        ? new Date(data.user.last_sign_in_at)
        : user.lastSignedIn;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    supabase,
  };
}
