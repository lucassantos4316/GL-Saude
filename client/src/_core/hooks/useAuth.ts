import { startLogin } from "@/const";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { useCallback, useEffect } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: isSupabaseConfigured,
  });

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void utils.auth.me.invalidate();
    });
    return () => subscription.unsubscribe();
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
    if (!redirectOnUnauthenticated || meQuery.isLoading || meQuery.data) return;
    if (typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;
    startLogin();
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    meQuery.isLoading,
    meQuery.data,
  ]);

  return {
    user: meQuery.data ?? null,
    loading: isSupabaseConfigured && meQuery.isLoading,
    error: meQuery.error ?? null,
    isAuthenticated: Boolean(meQuery.data),
    refresh: () => meQuery.refetch(),
    logout,
  };
}
