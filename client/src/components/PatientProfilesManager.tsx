import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { isAdult, isValidCpf, onlyDigits } from "@shared/registration";
import { LoaderCircle, Pencil, Plus, UserRound, UserRoundX } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

type DependentForm = {
  fullName: string;
  cpf: string;
  birthDate: string;
  phone: string;
  relationship: string;
  consentEmail: string;
  legalGuardianConfirmed: boolean;
};

const emptyForm: DependentForm = {
  fullName: "",
  cpf: "",
  birthDate: "",
  phone: "",
  relationship: "filho(a)",
  consentEmail: "",
  legalGuardianConfirmed: false,
};

const authorizationLabels: Record<string, string> = {
  self: "Perfil do titular",
  guardian_attested: "Responsabilidade declarada",
  pending: "Autorização pendente",
  verified: "Autorização verificada",
  revoked: "Vínculo encerrado",
};

function formatCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export default function PatientProfilesManager() {
  const utils = trpc.useUtils();
  const profiles = trpc.patientProfiles.list.useQuery();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DependentForm>(emptyForm);
  const [selfEditing, setSelfEditing] = useState(false);
  const [selfForm, setSelfForm] = useState({
    fullName: "",
    cpf: "",
    birthDate: "",
    phone: "",
  });
  const selfProfile = profiles.data?.find((profile) => profile.is_self);

  const refreshProfiles = async () => {
    await utils.patientProfiles.list.invalidate();
  };
  const createProfile = trpc.patientProfiles.create.useMutation({
    onSuccess: async () => {
      await refreshProfiles();
      setForm(emptyForm);
      toast.success("Dependente cadastrado.");
    },
  });
  const updateProfile = trpc.patientProfiles.update.useMutation({
    onSuccess: async () => {
      await refreshProfiles();
      setEditingId(null);
      setForm(emptyForm);
      toast.success("Dados do dependente atualizados.");
    },
  });
  const archiveProfile = trpc.patientProfiles.archive.useMutation({
    onSuccess: async () => {
      await refreshProfiles();
      toast.success("Vínculo encerrado. Os agendamentos anteriores foram preservados.");
    },
  });
  const updateSelf = trpc.patientProfiles.updateSelf.useMutation({
    onSuccess: async () => {
      await refreshProfiles();
      setSelfEditing(false);
      toast.success("Seu perfil de paciente foi atualizado.");
    },
  });

  const dependentRows = (profiles.data ?? []).filter((profile) => !profile.is_self);
  const submitting = createProfile.isPending || updateProfile.isPending;
  const isMinor = form.birthDate ? !isAdult(form.birthDate) : false;
  const cpfDigits = onlyDigits(form.cpf);
  const errorMessage =
    createProfile.error?.message ||
    updateProfile.error?.message ||
    archiveProfile.error?.message;

  useEffect(() => {
    if (!selfProfile) return;
    setSelfForm({
      fullName: selfProfile.full_name,
      cpf: selfProfile.cpf ?? "",
      birthDate: selfProfile.birth_date ?? "",
      phone: selfProfile.phone ?? "",
    });
  }, [selfProfile]);

  const setField = <K extends keyof DependentForm>(field: K, value: DependentForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const saveSelfProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValidCpf(selfForm.cpf)) {
      toast.error("Informe um CPF válido.");
      return;
    }
    if (!isAdult(selfForm.birthDate)) {
      toast.error("O titular da conta deve ser maior de 18 anos.");
      return;
    }
    updateSelf.mutate({
      fullName: selfForm.fullName.trim(),
      cpf: onlyDigits(selfForm.cpf),
      birthDate: selfForm.birthDate,
      phone: onlyDigits(selfForm.phone) || null,
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.cpf && !isValidCpf(form.cpf)) {
      toast.error("Informe um CPF válido ou deixe o campo em branco.");
      return;
    }
    if (isMinor && !form.legalGuardianConfirmed) {
      toast.error("Confirme que você é responsável legal pelo menor.");
      return;
    }
    if (!isMinor && !form.consentEmail.trim()) {
      toast.error("Informe o e-mail próprio do dependente adulto para autorização.");
      return;
    }

    const input = {
      fullName: form.fullName.trim(),
      cpf: cpfDigits || null,
      birthDate: form.birthDate,
      phone: onlyDigits(form.phone) || null,
      relationship: form.relationship.trim(),
      consentEmail: form.consentEmail.trim().toLowerCase(),
      legalGuardianConfirmed: form.legalGuardianConfirmed,
    };

    if (editingId) {
      updateProfile.mutate({ profileId: editingId, ...input });
    } else {
      createProfile.mutate(input);
    }
  };

  const edit = (profile: NonNullable<typeof profiles.data>[number]) => {
    setEditingId(profile.id);
    setForm({
      fullName: profile.full_name,
      cpf: profile.cpf ?? "",
      birthDate: profile.birth_date ?? "",
      phone: profile.phone ?? "",
      relationship: profile.relationship,
      consentEmail: profile.consent_email ?? "",
      legalGuardianConfirmed: profile.legal_guardian_confirmed,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    createProfile.reset();
    updateProfile.reset();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Pacientes e dependentes</h2>
        <p className="mt-2 text-slate-500">
          Mantenha cada perfil separado. O encerramento de um vínculo não exclui o histórico de atendimentos.
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-lg">Meu perfil de paciente</CardTitle>
          {!selfEditing && (
            <Button type="button" size="sm" variant="outline" onClick={() => setSelfEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Atualizar dados
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {selfEditing ? (
            <form onSubmit={saveSelfProfile} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="self-full-name">Nome completo</Label>
                  <Input id="self-full-name" required minLength={3} value={selfForm.fullName} onChange={(event) => setSelfForm((current) => ({ ...current, fullName: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="self-cpf">CPF</Label>
                  <Input id="self-cpf" required inputMode="numeric" placeholder="000.000.000-00" value={selfForm.cpf} onChange={(event) => setSelfForm((current) => ({ ...current, cpf: formatCpf(event.target.value) }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="self-birth-date">Data de nascimento</Label>
                  <Input id="self-birth-date" required type="date" value={selfForm.birthDate} onChange={(event) => setSelfForm((current) => ({ ...current, birthDate: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="self-phone">Telefone (opcional)</Label>
                  <Input id="self-phone" type="tel" value={selfForm.phone} onChange={(event) => setSelfForm((current) => ({ ...current, phone: event.target.value }))} />
                </div>
              </div>
              {updateSelf.error && <p className="text-sm text-red-700" role="alert">{updateSelf.error.message}</p>}
              <div className="flex gap-3">
                <Button type="submit" disabled={updateSelf.isPending} className="bg-[#087A92] hover:bg-[#076b80]">
                  {updateSelf.isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar dados
                </Button>
                <Button type="button" variant="outline" onClick={() => setSelfEditing(false)}>Cancelar</Button>
              </div>
            </form>
          ) : selfProfile ? (
            <div className="space-y-1 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">{selfProfile.full_name}</p>
              <p>{selfProfile.cpf ? `CPF: ${selfProfile.cpf}` : "CPF não informado"}{selfProfile.birth_date ? ` · Nascimento: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(`${selfProfile.birth_date}T00:00:00`))}` : " · Data de nascimento não informada"}</p>
            </div>
          ) : (
            <p className="text-sm text-red-700" role="alert">O perfil do titular ainda não foi criado. Aplique as migrações do Supabase.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{editingId ? "Editar dependente" : "Adicionar dependente"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="dependent-full-name">Nome completo</Label>
                <Input id="dependent-full-name" required minLength={3} maxLength={255} value={form.fullName} onChange={(event) => setField("fullName", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dependent-cpf">CPF (quando aplicável)</Label>
                <Input id="dependent-cpf" inputMode="numeric" placeholder="000.000.000-00" value={form.cpf} onChange={(event) => setField("cpf", formatCpf(event.target.value))} aria-invalid={Boolean(form.cpf && !isValidCpf(form.cpf))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dependent-birth-date">Data de nascimento</Label>
                <Input id="dependent-birth-date" type="date" required value={form.birthDate} onChange={(event) => setField("birthDate", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dependent-phone">Telefone (opcional)</Label>
                <Input id="dependent-phone" type="tel" value={form.phone} onChange={(event) => setField("phone", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dependent-relationship">Grau de parentesco ou vínculo</Label>
                <Input id="dependent-relationship" required maxLength={80} value={form.relationship} onChange={(event) => setField("relationship", event.target.value)} />
              </div>
              {form.birthDate && !isMinor && (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="dependent-consent-email">E-mail próprio do dependente adulto</Label>
                  <Input id="dependent-consent-email" type="email" required value={form.consentEmail} onChange={(event) => setField("consentEmail", event.target.value)} />
                  <p className="text-xs text-slate-500">
                    O perfil ficará com autorização pendente e não poderá ser usado para agendar até a verificação de consentimento por um administrador.
                  </p>
                </div>
              )}
            </div>

            {isMinor && (
              <label className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                <input type="checkbox" checked={form.legalGuardianConfirmed} onChange={(event) => setField("legalGuardianConfirmed", event.target.checked)} className="mt-1 accent-[#087A92]" />
                Confirmo que sou responsável legal por este menor e estou autorizado(a) a gerenciar seu cadastro e agendamentos.
              </label>
            )}

            {errorMessage && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{errorMessage}</p>
            )}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={submitting} className="bg-[#087A92] hover:bg-[#076b80]">
                {submitting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                {editingId ? "Salvar alterações" : "Adicionar dependente"}
              </Button>
              {editingId && <Button type="button" variant="outline" onClick={cancelEdit}>Cancelar edição</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Perfis autorizados nesta conta</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100 p-0">
          {profiles.isLoading && (
            <div className="flex items-center gap-2 p-6 text-sm text-slate-500" role="status">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando perfis…
            </div>
          )}
          {profiles.isError && (
            <div className="p-6 text-sm text-red-700" role="alert">
              Não foi possível carregar os perfis. Confira se a migração de dependentes foi aplicada e tente novamente.
            </div>
          )}
          {!profiles.isLoading && !profiles.isError && dependentRows.map((profile) => (
            <article key={profile.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#087A92]/10 text-[#087A92]">
                <UserRound className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{profile.full_name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {profile.is_self ? "Titular da conta" : profile.relationship}
                  {profile.birth_date ? ` · ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(`${profile.birth_date}T00:00:00`))}` : ""}
                </p>
                <Badge variant="outline" className={`mt-2 ${
                  profile.authorization_status === "pending"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-[#18AFA0]/30 bg-[#18AFA0]/10 text-[#087A92]"
                }`}>
                  {authorizationLabels[profile.authorization_status] ?? profile.authorization_status}
                </Badge>
                {profile.authorization_status === "pending" && (
                  <p className="mt-2 text-xs text-amber-800">
                    Agendamentos para este paciente serão liberados após validação do consentimento ou da documentação.
                  </p>
                )}
              </div>
              {!profile.is_self && (
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => edit(profile)} aria-label={`Editar ${profile.full_name}`}>
                    <Pencil className="mr-2 h-4 w-4" /> Editar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={archiveProfile.isPending}
                    onClick={() => {
                      if (window.confirm(`Encerrar o vínculo com ${profile.full_name}? O histórico será preservado.`)) {
                        archiveProfile.mutate({ profileId: profile.id });
                      }
                    }}
                    aria-label={`Encerrar vínculo com ${profile.full_name}`}
                    className="text-red-600 hover:text-red-700"
                  >
                    {archiveProfile.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserRoundX className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </article>
          ))}
          {!profiles.isLoading && !profiles.isError && dependentRows.length === 0 && (
            <p className="p-6 text-sm text-slate-500">Nenhum perfil foi encontrado nesta conta.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
