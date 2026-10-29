import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BrandLogo } from "@/components/BrandLogo";
import { ArrowLeft, Mail, Smartphone } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "wouter";

type RecoveryMethod = "email" | "sms";

const recoveryOptions: {
  id: RecoveryMethod;
  title: string;
  description: string;
  Icon: typeof Mail;
}[] = [
  {
    id: "email",
    title: "Enviar link para o e-mail",
    description: "v***@exemplo.com",
    Icon: Mail,
  },
  {
    id: "sms",
    title: "Enviar código por SMS",
    description: "(11) 9****-1234",
    Icon: Smartphone,
  },
];

export default function PasswordRecovery() {
  const [method, setMethod] = useState<RecoveryMethod | null>(null);
  const [notice, setNotice] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!method) return;

    setNotice(
      "O envio de instruções ainda não está disponível. Nenhuma mensagem foi enviada.",
    );
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7fbfb] px-4 py-8 text-slate-900 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center sm:mb-10">
          <BrandLogo />
        </div>

        <header className="mb-6 text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#18AFA0]">
            Recuperação de senha
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Esqueceu sua senha?
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Escolha como você deseja redefinir sua senha.
          </p>
        </header>

        <Card className="rounded-2xl border-0 bg-white shadow-[0_20px_60px_rgba(8,122,146,0.10)]">
          <CardContent className="p-5 sm:p-7">
            <form onSubmit={handleSubmit}>
              <fieldset>
                <legend className="mb-4 text-sm font-semibold text-slate-700">
                  Método de recuperação
                </legend>
                <div className="space-y-4">
                  {recoveryOptions.map(({ id, title, description, Icon }) => {
                    const selected = method === id;
                    return (
                      <label
                        key={id}
                        className={`flex min-h-[88px] cursor-pointer items-center gap-4 rounded-xl border bg-white p-4 transition-colors focus-within:ring-2 focus-within:ring-[#087A92] focus-within:ring-offset-2 ${
                          selected
                            ? "border-[#087A92] bg-[#087A92]/[0.04]"
                            : "border-slate-200 hover:border-[#087A92]/50"
                        }`}
                      >
                        <input
                          className="sr-only"
                          type="radio"
                          name="recovery-method"
                          value={id}
                          checked={selected}
                          onChange={() => {
                            setMethod(id);
                            setNotice("");
                          }}
                        />
                        <span
                          aria-hidden="true"
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                            selected
                              ? "bg-[#087A92]/10 text-[#087A92]"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-800">
                            {title}
                          </span>
                          <span className="mt-1 block text-sm text-slate-500">
                            {description}
                          </span>
                        </span>
                        <span
                          aria-hidden="true"
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            selected
                              ? "border-[#087A92]"
                              : "border-slate-300"
                          }`}
                        >
                          {selected && (
                            <span className="h-2.5 w-2.5 rounded-full bg-[#087A92]" />
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <Button
                type="submit"
                disabled={!method}
                className="mt-6 h-12 w-full bg-[#087A92] text-base text-white hover:bg-[#076b80] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Enviar instruções
              </Button>

              {notice && (
                <p
                  className="mt-4 rounded-lg bg-amber-50 p-3 text-sm leading-relaxed text-amber-800"
                  role="status"
                >
                  {notice}
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#087A92] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087A92] focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar para o login
          </Link>
        </div>
      </div>
    </main>
  );
}
