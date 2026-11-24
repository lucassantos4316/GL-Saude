import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Check, LoaderCircle, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AppointmentChangeRequests() {
  const utils = trpc.useUtils();
  const requests = trpc.operator.pendingAppointmentChanges.useQuery();
  const agenda = trpc.operator.clinicAgenda.useQuery();
  const [resolutionNotes, setResolutionNotes] = useState<
    Record<string, string>
  >({});
  const resolveRequest = trpc.operator.resolveAppointmentChange.useMutation({
    onSuccess: async (_result, variables) => {
      await Promise.all([
        utils.operator.pendingAppointmentChanges.invalidate(),
        utils.operator.clinicAgenda.invalidate(),
      ]);
      setResolutionNotes(current => ({
        ...current,
        [variables.requestId]: "",
      }));
      toast.success(
        variables.approve
          ? "Solicitação aprovada e agendamento atualizado."
          : "Solicitação recusada."
      );
    },
  });

  if (requests.isLoading || agenda.isLoading) {
    return (
      <p
        className="flex items-center gap-2 py-8 text-sm text-slate-500"
        role="status"
      >
        <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando
        solicitações…
      </p>
    );
  }

  if (requests.isError || agenda.isError) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-4 p-6">
          <p className="font-semibold">
            Não foi possível carregar as solicitações.
          </p>
          <p className="text-sm text-slate-500">
            Confirme que a migração de histórico e solicitações foi aplicada e
            que sua conta tem acesso à clínica.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void requests.refetch();
              void agenda.refetch();
            }}
          >
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const appointmentById = new Map(
    (agenda.data ?? []).map(appointment => [appointment.id, appointment])
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-[#18AFA0]">
          Operação da clínica
        </p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight">
          Solicitações de alteração
        </h2>
        <p className="mt-2 text-slate-500">
          Avalie cancelamentos e remarcações pendentes da sua clínica.
        </p>
      </div>
      <Card className="border-0 shadow-sm">
        <CardContent className="divide-y divide-slate-100 p-0">
          {requests.data?.length ? (
            requests.data.map(request => {
              const appointment = appointmentById.get(request.appointment_id);
              return (
                <article key={request.id} className="space-y-4 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">
                          {request.kind === "cancellation"
                            ? "Solicitação de cancelamento"
                            : "Solicitação de remarcação"}
                        </h3>
                        <Badge variant="outline">Aguardando análise</Badge>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        Protocolo do atendimento: {request.appointment_id}
                      </p>
                      {appointment && (
                        <p className="mt-1 text-sm text-slate-600">
                          {appointment.kind === "consultation"
                            ? "Consulta"
                            : "Exame"}{" "}
                          · {formatDate(appointment.starts_at)}
                        </p>
                      )}
                      {request.requested_starts_at && (
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                          <RefreshCw className="h-4 w-4" />
                          Novo horário solicitado:{" "}
                          {formatDate(request.requested_starts_at)}
                        </p>
                      )}
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        <strong>Motivo:</strong> {request.reason}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500">
                      Recebida em {formatDate(request.created_at)}
                    </p>
                  </div>
                  {request.kind === "reschedule" && !appointment && (
                    <p
                      className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
                      role="alert"
                    >
                      Não foi possível confirmar o atendimento relacionado.
                      Atualize a agenda antes de decidir.
                    </p>
                  )}
                  {resolveRequest.error && (
                    <p className="text-sm text-red-700" role="alert">
                      {resolveRequest.error.message}
                    </p>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor={`resolution-${request.id}`}>
                      Observação da clínica (opcional)
                    </Label>
                    <Input
                      id={`resolution-${request.id}`}
                      value={resolutionNotes[request.id] ?? ""}
                      maxLength={500}
                      onChange={event =>
                        setResolutionNotes(current => ({
                          ...current,
                          [request.id]: event.target.value,
                        }))
                      }
                      placeholder="Informe uma orientação para o paciente"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={
                        resolveRequest.isPending ||
                        (request.kind === "reschedule" && !appointment)
                      }
                      onClick={() =>
                        resolveRequest.mutate({
                          requestId: request.id,
                          approve: true,
                          resolutionNote:
                            resolutionNotes[request.id] || undefined,
                        })
                      }
                      className="bg-[#087A92] text-white hover:bg-[#076b80]"
                    >
                      {resolveRequest.isPending ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      Aprovar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={resolveRequest.isPending}
                      onClick={() =>
                        resolveRequest.mutate({
                          requestId: request.id,
                          approve: false,
                          resolutionNote:
                            resolutionNotes[request.id] || undefined,
                        })
                      }
                    >
                      <X className="mr-2 h-4 w-4" /> Recusar
                    </Button>
                  </div>
                </article>
              );
            })
          ) : (
            <p className="p-6 text-sm text-slate-500">
              Não há solicitações aguardando análise.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
