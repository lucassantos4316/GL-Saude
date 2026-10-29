import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { ChevronRight, HeartPulse, LoaderCircle, ShieldCheck } from "lucide-react";
import * as React from "react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { BrandLogo } from "./BrandLogo";

type AuthMode = "sign_in" | "sign_up" | "update_password";

export default function SupabaseLogin() {
  const [mode, setMode] = useState<AuthMode>(() =>
    typeof window !== "undefined" && window.location.hash.includes("type=recovery")
      ? "update_password"
      : "sign_in"
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    try {
      if (mode === "update_password") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        window.history.replaceState(null, "", window.location.pathname);
        window.location.assign("/dashboard/patient");
        return;
      }

      if (mode === "sign_in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign("/dashboard/patient");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: name.trim() },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      if (!data.session) {
        toast.success("Conta criada. Confirme seu e-mail para entrar.");
        setMode("sign_in");
        return;
      }
      window.location.assign("/dashboard/patient");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível autenticar.";
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  const signInWithGoogle = async () => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível entrar com Google.");
      setSubmitting(false);
    }
  };

  const sendPasswordReset = async () => {
    if (!email.trim()) {
      setErrorMessage("Informe seu e-mail para receber o link de recuperação.");
      return;
    }
    setSubmitting(true);
    setErrorMessage("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      toast.success("Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível solicitar a redefinição.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7fbfb] text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-[#087A92] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#18AFA0]/40 blur-3xl" />
          <div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-[#4CCB73]/30 blur-3xl" />
          <BrandLogo className="relative brightness-0 invert" />
          <div className="relative max-w-xl pb-16">
            <Badge className="mb-7 border-white/20 bg-white/10 text-white hover:bg-white/10">
              Cuidado conectado, de um jeito mais simples
            </Badge>
            <h1 className="max-w-lg text-5xl font-bold leading-[1.06] tracking-[-0.04em]">
              A saúde que acompanha o seu ritmo.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-white/75">
              Agende consultas e exames, acompanhe seu cuidado e tenha tudo organizado em um só lugar.
            </p>
            <div className="mt-10 flex items-center gap-6 text-sm text-white/80">
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Dados protegidos</span>
              <span className="flex items-center gap-2"><HeartPulse className="h-4 w-4" /> Cuidado humano</span>
            </div>
          </div>
          <p className="relative text-xs text-white/50">
            GGL saude · Gestão inteligente para clínicas e pacientes
          </p>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">
            <div className="mb-10 lg:hidden"><BrandLogo /></div>
            <div className="mb-8">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#18AFA0]">
                Bem-vindo à GGL saude
              </p>
              <h2 className="text-3xl font-bold tracking-tight">
                {mode === "sign_in"
                  ? "Acesse sua conta"
                  : mode === "sign_up"
                    ? "Crie sua conta"
                    : "Redefina sua senha"}
              </h2>
              <p className="mt-2 text-slate-500">Entre para cuidar do que realmente importa.</p>
            </div>

            <Card className="border-0 bg-white shadow-[0_20px_60px_rgba(8,122,146,0.10)]">
              <CardContent className="space-y-5 p-7">
                <form onSubmit={submit} className="space-y-5">
                  {mode === "sign_up" && (
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Nome</Label>
                      <Input
                        id="signup-name"
                        autoComplete="name"
                        required
                        maxLength={255}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    {mode !== "update_password" && (
                      <>
                        <Label htmlFor="supabase-email">E-mail</Label>
                        <Input
                          id="supabase-email"
                          type="email"
                          autoComplete="email"
                          placeholder="voce@exemplo.com"
                          required
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                        />
                      </>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="supabase-password">Senha</Label>
                      {mode === "sign_in" && (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={sendPasswordReset}
                          className="text-xs font-semibold text-[#087A92] hover:underline"
                        >
                          Esqueci minha senha
                        </button>
                      )}
                    </div>
                    <Input
                      id="supabase-password"
                      type="password"
                      autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
                      minLength={8}
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </div>
                  {errorMessage && (
                    <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
                      {errorMessage}
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="h-12 w-full bg-[#087A92] text-base hover:bg-[#076b80]"
                    disabled={submitting}
                  >
                    {submitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                    {mode === "sign_in" ? "Entrar" : mode === "sign_up" ? "Criar conta" : "Atualizar senha"}
                    {!submitting && <ChevronRight className="ml-2 h-4 w-4" />}
                  </Button>
                </form>

                <p className="text-center text-xs text-slate-400">
                  Ambiente seguro com autenticação Supabase.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={signInWithGoogle}
                  disabled={submitting}
                  className="h-12 w-full border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Continuar com Google
                </Button>
              </CardContent>
            </Card>

            <p className="mt-7 text-center text-sm text-slate-500">
              {mode !== "update_password" && (
                <>
                  {mode === "sign_in" ? "Ainda não possui uma conta?" : "Já possui uma conta?"}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage("");
                      setMode(mode === "sign_in" ? "sign_up" : "sign_in");
                    }}
                    className="font-semibold text-[#087A92]"
                  >
                    {mode === "sign_in" ? "Cadastre-se" : "Entrar"}
                  </button>
                </>
              )}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
