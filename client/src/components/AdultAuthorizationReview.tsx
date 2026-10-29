import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, LoaderCircle, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdultAuthorizationReview() {
  const utils = trpc.useUtils();
  const requests = trpc.patientProfiles.pendingAdultAuthorization.useQuery();
  const [verifiedIds, setVerifiedIds] = useState<string[]>([]);
  const verify = trpc.patientProfiles.verifyAdult.useMutation({
    onSuccess: async () => {
      await utils.patientProfiles.pendingAdultAuthorization.invalidate();
      toast.success("Autorização verificada e registrada.");
    },
  });

  if (requests.isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-slate-500" role="status">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando solicitações…
      </div>
    );
  }

  if (requests.isError) {
    return (
      <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">
        Não foi possível consultar as autorizações pendentes. Esta área está disponível somente para administradores.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Autorizações de pacientes adultos</h2>
        <p className="mt-2 text-slate-500">
          Confirme o consentimento diretamente com o paciente antes de liberar o acesso do responsável.
        </p>
      </div>
      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p>
          Parentesco ou declaração do responsável não substituem o consentimento do paciente adulto. Registre a verificação somente após confirmar a autorização de forma adequada com a clínica.
        </p>
      </div>
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-lg">Pendentes de verificação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {verify.error && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
              Não foi possível registrar a verificação: {verify.error.message}
            </p>
          )}
          {!requests.data?.length && (
            <p className="text-sm text-slate-500">Não há solicitações de autorização pendentes.</p>
          )}
          {requests.data?.map((request) => {
            const checked = verifiedIds.includes(request.patient_profile_id);
            return (
              <article key={request.patient_profile_id} className="space-y-4 rounded-xl border border-slate-200 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{request.patient_name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {request.relationship} · Nascimento: {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(`${request.patient_birth_date}T00:00:00`))}
                    </p>
                    <p className="mt-2 text-sm">E-mail do paciente: {request.consent_email}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Conta responsável: {request.account_owner_name}{request.account_owner_email ? ` · ${request.account_owner_email}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className="w-fit border-amber-200 bg-amber-50 text-amber-800">Pendente</Badge>
                </div>
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => setVerifiedIds((current) =>
                      event.target.checked
                        ? [...current, request.patient_profile_id]
                        : current.filter((id) => id !== request.patient_profile_id)
                    )}
                    className="mt-1 accent-[#087A92]"
                  />
                  Confirmo que validei o consentimento expresso do paciente e a documentação exigida pela clínica.
                </label>
                <Button
                  type="button"
                  disabled={!checked || verify.isPending}
                  onClick={() => verify.mutate({ profileId: request.patient_profile_id })}
                  className="bg-[#087A92] hover:bg-[#076b80]"
                >
                  {verify.isPending
                    ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Registrar verificação
                </Button>
              </article>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
