import { startLogin } from "@/const";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useState } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();
  const [sessionState, setSessionState] = useState<
    "checking" | "authenticated" | "anonymous"
  >("checking");
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: sessionState === "authenticated",
  });

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSessionState("anonymous");
      return;
    }
    let disposed = false;
    let receivedAuthEvent = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedAuthEvent = true;
      setSessionState(session ? "authenticated" : "anonymous");
      if (session) {
        window.setTimeout(() => {
          if (!disposed) void utils.auth.me.invalidate();
        }, 0);
      } else {
        utils.auth.me.setData(undefined, null);
      }
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (disposed || receivedAuthEvent) return;
      if (error) {
        console.error("[Auth] Could not restore the Supabase session:", error);
        setSessionState("anonymous");
        return;
      }
      setSessionState(data.session ? "authenticated" : "anonymous");
    }).catch((error: unknown) => {
      if (disposed || receivedAuthEvent) return;
      console.error("[Auth] Could not restore the Supabase session:", error);
      setSessionState("anonymous");
    });

    return () => {
      disposed = true;
      subscription.unsubscribe();
    };
  }, [utils]);

  const logout = useCallback(async () => {
    if (!isSupabaseConfigured) {
      throw new Error("Configure o Supabase para sair de uma sessão.");
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    utils.auth.me.setData(undefined, null);
    await utils.auth.me.invalidate();
  }, [utils]);

  useEffect(() => {
    if (!redirectOnUnauthenticated || sessionState !== "anonymous") return;
    if (typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;
    startLogin();
  }, [redirectOnUnauthenticated, redirectPath, sessionState]);

  return {
    user: meQuery.data ?? null,
    loading:
      sessionState === "checking" ||
      (sessionState === "authenticated" && meQuery.isLoading),
    error: meQuery.error ?? null,
    hasSession: sessionState === "authenticated",
    isAuthenticated: Boolean(meQuery.data),
    refresh: () => meQuery.refetch(),
    logout,
  };
}
