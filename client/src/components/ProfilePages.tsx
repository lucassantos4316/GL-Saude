import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import { BadgeCheck, LoaderCircle, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

export type ProfileSection = "profile" | "edit-profile" | "my-data";

const sections: { id: ProfileSection; label: string }[] = [
  { id: "profile", label: "Perfil" },
  { id: "edit-profile", label: "Editar perfil" },
  { id: "my-data", label: "Meus dados" },
];

const roleLabels: Record<string, string> = {
  patient: "Paciente",
  doctor: "Médico",
  operator: "Operador",
  admin: "Administrador",
  user: "Usuário",
};

export function ProfileNavigation({
  active,
  onSelect,
}: {
  active: ProfileSection | null;
  onSelect: (section: ProfileSection) => void;
}) {
  return (
    <section aria-label="Minha conta" className="mb-6">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
        Minha conta
      </p>
      <nav aria-label="Navegação do perfil" className="flex flex-wrap gap-2">
        {sections.map((section) => (
          <Button
            key={section.id}
            type="button"
            variant={active === section.id ? "default" : "outline"}
            aria-current={active === section.id ? "page" : undefined}
            onClick={() => onSelect(section.id)}
            className={
              active === section.id
                ? "bg-[#087A92] hover:bg-[#076b80]"
                : "border-slate-200"
            }
          >
            {section.label}
          </Button>
        ))}
      </nav>
    </section>
  );
}

export function ProfilePage({ section }: { section: ProfileSection }) {
  const utils = trpc.useUtils();
  const profile = trpc.profile.me.useQuery();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: async (updated) => {
      utils.profile.me.setData(undefined, updated);
      await Promise.all([
        utils.profile.me.invalidate(),
        utils.auth.me.invalidate(),
      ]);
      toast.success("Perfil atualizado.");
    },
  });

  useEffect(() => {
    if (!profile.data) return;
    setName(profile.data.name ?? "");
    setEmail(profile.data.email ?? "");
  }, [profile.data]);

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateProfile.mutate({ name, email });
  };

  if (profile.isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-slate-500" role="status">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        Carregando seus dados…
      </div>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <Card className="max-w-2xl border-0 shadow-sm">
        <CardContent className="space-y-4 p-6">
          <p className="font-semibold">Não foi possível carregar seu perfil.</p>
          <p className="text-sm text-slate-500">
            Entre com sua conta para consultar e atualizar os dados do perfil.
          </p>
          <Button type="button" onClick={startLogin} className="bg-[#087A92] hover:bg-[#076b80]">
            Entrar
          </Button>
        </CardContent>
      </Card>
    );
  }

  const user = profile.data;
  const fullName = user.name?.trim() || "Nome não informado";
  const emailAddress = user.email || "E-mail não informado";
  const formattedDate = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
  }).format(user.createdAt);

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium text-[#18AFA0]">Minha conta</p>
        <h2 className="text-3xl font-bold tracking-tight">
          {section === "profile"
            ? "Perfil"
            : section === "edit-profile"
              ? "Editar perfil"
              : "Meus dados"}
        </h2>
        <p className="mt-2 text-slate-500">
          Consulte e mantenha atualizadas as informações da sua conta.
        </p>
      </div>

      {section === "edit-profile" ? (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Informações pessoais</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Nome</Label>
                <Input
                  id="profile-name"
                  autoComplete="name"
                  maxLength={255}
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  aria-invalid={Boolean(updateProfile.error)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email">E-mail</Label>
                <Input
                  id="profile-email"
                  type="email"
                  autoComplete="email"
                  maxLength={320}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={Boolean(updateProfile.error)}
                />
                <p className="text-xs text-slate-500">
                  E-mail de contato do perfil; ele não altera o e-mail usado para entrar.
                </p>
              </div>
              {updateProfile.error && (
                <p className="text-sm text-red-700" role="alert">
                  Não foi possível salvar as alterações. Confira os dados e tente novamente.
                </p>
              )}
              <Button
                type="submit"
                disabled={updateProfile.isPending}
                className="bg-[#087A92] hover:bg-[#076b80]"
              >
                {updateProfile.isPending && (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                )}
                {updateProfile.isPending ? "Salvando…" : "Salvar alterações"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : section === "profile" ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#087A92]/10 text-[#087A92]">
              <UserRound className="h-8 w-8" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-bold">{fullName}</h3>
              <p className="mt-1 truncate text-sm text-slate-500">{emailAddress}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#18AFA0]/10 px-3 py-1 text-xs font-semibold text-[#087A92]">
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                {roleLabels[user.role] ?? "Usuário"}
              </span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Dados da conta</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-slate-100">
              <DataRow label="Nome" value={fullName} />
              <DataRow label="E-mail" value={emailAddress} />
              <DataRow label="Perfil de acesso" value={roleLabels[user.role] ?? "Usuário"} />
              <DataRow label="Conta criada em" value={formattedDate} />
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="break-words text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}
