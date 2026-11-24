import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import type { Tables } from "@/lib/supabaseTypes";
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileText,
  LoaderCircle,
  MapPin,
  RefreshCw,
  WalletCards,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Appointment = Tables<"appointments"> & {
  professional: Tables<"professionals"> | null;
  clinic: Tables<"clinics"> | null;
  payments: Tables<"payments">[];
  changeRequests: Tables<"appointment_change_requests">[];
  history: Tables<"appointment_history">[];
};
type AvailabilitySlot = {
  starts_at: string;
  ends_at: string;
  local_date: string;
  timezone: string;
};

const statusLabels: Record<string, string> = {
  held: "Reserva temporária",
  pending_payment: "Pagamento pendente",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  completed: "Concluído",
};

const paymentStatusLabels: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  failed: "Falhou",
  refunded: "Reembolsado",
};

const historyLabels: Record<string, string> = {
  created: "Agendamento criado",
  rescheduled: "Horário alterado",
  cancelled: "Agendamento cancelado",
  cancellation_requested: "Cancelamento solicitado",
  reschedule_requested: "Remarcação solicitada",
  change_request_approved: "Solicitação aprovada",
  change_request_rejected: "Solicitação recusada",
};

function localDate(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function formatDate(
  value: string,
  timezone: string,
  options: Intl.DateTimeFormatOptions
) {
  return new Intl.DateTimeFormat("pt-BR", {
    ...options,
    timeZone: timezone,
  }).format(new Date(value));
}

function getResultStatus(result: unknown) {
  if (
    typeof result === "object" &&
    result !== null &&
    "status" in result &&
    typeof result.status === "string"
  ) {
    return result.status;
  }
  return "pending_review";
}

function AppointmentCard({
  appointment,
  patientName,
}: {
  appointment: Appointment;
  patientName: string;
}) {
  const utils = trpc.useUtils();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [cancellationOpen, setCancellationOpen] = useState(false);
  const [reschedulingOpen, setReschedulingOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [selectedStart, setSelectedStart] = useState("");
  const [documentId, setDocumentId] = useState<string | null>(null);
  const timezone = appointment.clinic?.timezone ?? "America/Sao_Paulo";
  const from = localDate(new Date(), timezone);
  const to = addDays(from, 30);
  const availability = trpc.clinic.availability.useQuery(
    {
      professionalId: appointment.professional_id,
      from,
      to,
    },
    {
      enabled: reschedulingOpen && appointment.kind === "consultation",
      refetchInterval: reschedulingOpen ? 30_000 : false,
      refetchOnWindowFocus: true,
    }
  );
  const documents = trpc.clinic.appointmentDocuments.useQuery(
    { appointmentId: appointment.id },
    { enabled: detailsOpen }
  );
  const availableSlots = availability.data as AvailabilitySlot[] | undefined;
  const changeRequest = trpc.clinic.requestChange.useMutation({
    onSuccess: async result => {
      await utils.clinic.myAppointments.invalidate();
      const state = getResultStatus(result);
      if (state === "cancelled") {
        toast.success("Reserva cancelada e horário liberado.");
      } else if (state === "rescheduled") {
        toast.success("Horário atualizado.");
      } else {
        toast.success("Solicitação enviada para análise da clínica.");
      }
      setReason("");
      setSelectedStart("");
      setCancellationOpen(false);
      setReschedulingOpen(false);
    },
  });
  const canRequestChange =
    ["held", "confirmed", "pending_payment"].includes(appointment.status) &&
    new Date(appointment.starts_at) > new Date();
  const pendingRequest = appointment.changeRequests.find(
    request => request.status === "pending"
  );
  const selectedSlot = availableSlots?.find(
    slot => slot.starts_at === selectedStart
  );

  const submitCancellation = () => {
    if (reason.trim().length < 2) {
      toast.error("Informe o motivo do cancelamento.");
      return;
    }
    changeRequest.mutate({
      appointmentId: appointment.id,
      kind: "cancellation",
      reason: reason.trim(),
    });
  };

  const submitReschedule = () => {
    if (!selectedSlot || reason.trim().length < 2) {
      toast.error("Escolha um novo horário e informe o motivo da remarcação.");
      return;
    }
    changeRequest.mutate({
      appointmentId: appointment.id,
      kind: "reschedule",
      reason: reason.trim(),
      startsAt: new Date(selectedSlot.starts_at),
      endsAt: new Date(selectedSlot.ends_at),
    });
  };

  return (
    <article className="space-y-4 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="rounded-xl bg-[#087A92]/10 p-3 text-[#087A92]">
          <CalendarClock className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold">
              {appointment.kind === "consultation" ? "Consulta" : "Exame"}
              {appointment.professional?.specialty
                ? ` · ${appointment.professional.specialty}`
                : ""}
            </h3>
            <Badge variant="outline">
              {statusLabels[appointment.status] ?? appointment.status}
            </Badge>
            {pendingRequest && (
              <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
                {pendingRequest.kind === "cancellation"
                  ? "Cancelamento em análise"
                  : "Remarcação em análise"}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {appointment.professional?.display_name ??
              "Profissional não informado"}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <MapPin className="h-4 w-4 shrink-0" />
            {appointment.clinic?.name ?? "Clínica não informada"}
            {appointment.clinic?.city ? ` · ${appointment.clinic.city}` : ""}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <Clock3 className="h-4 w-4 shrink-0" />
            {formatDate(appointment.starts_at, timezone, {
              dateStyle: "long",
              timeStyle: "short",
            })}
          </p>
          <p className="mt-1 text-sm text-slate-500">Paciente: {patientName}</p>
          {appointment.hold_expires_at && appointment.status === "held" && (
            <p className="mt-2 text-xs text-amber-700">
              Reserva expira às{" "}
              {formatDate(appointment.hold_expires_at, timezone, {
                timeStyle: "short",
              })}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => setDetailsOpen(current => !current)}
          >
            {detailsOpen ? (
              <ChevronUp className="mr-2 h-4 w-4" />
            ) : (
              <ChevronDown className="mr-2 h-4 w-4" />
            )}
            Detalhes
          </Button>
          {canRequestChange && !pendingRequest && (
            <>
              {appointment.status === "held" &&
                appointment.kind === "consultation" && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setReschedulingOpen(current => !current);
                      setCancellationOpen(false);
                    }}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" /> Remarcar
                  </Button>
                )}
              <Button
                type="button"
                variant="outline"
                className="text-red-700 hover:text-red-800"
                onClick={() => {
                  setCancellationOpen(current => !current);
                  setReschedulingOpen(false);
                }}
              >
                <X className="mr-2 h-4 w-4" />
                {appointment.status === "held"
                  ? "Cancelar reserva"
                  : "Solicitar cancelamento"}
              </Button>
            </>
          )}
        </div>
      </div>

      {cancellationOpen && (
        <div className="space-y-3 rounded-xl border border-red-100 bg-red-50/50 p-4">
          <div>
            <Label htmlFor={`cancel-reason-${appointment.id}`}>
              Motivo do cancelamento
            </Label>
            <Input
              id={`cancel-reason-${appointment.id}`}
              value={reason}
              maxLength={500}
              onChange={event => setReason(event.target.value)}
              placeholder="Conte brevemente por que precisa cancelar"
            />
          </div>
          {appointment.status !== "held" && (
            <p className="text-xs leading-5 text-amber-800">
              A solicitação dependerá da análise da clínica. O atendimento
              permanecerá ativo até a decisão.
            </p>
          )}
          {changeRequest.error && (
            <p className="text-sm text-red-700" role="alert">
              {changeRequest.error.message}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancellationOpen(false)}
            >
              Voltar
            </Button>
            <Button
              type="button"
              disabled={changeRequest.isPending || reason.trim().length < 2}
              onClick={submitCancellation}
              className="bg-red-700 text-white hover:bg-red-800"
            >
              {changeRequest.isPending && (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirmar solicitação
            </Button>
          </div>
        </div>
      )}

      {reschedulingOpen && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <h4 className="font-semibold">Escolha um novo horário</h4>
            <p className="mt-1 text-xs text-slate-500">
              Apenas horários livres nos próximos 30 dias são exibidos.
            </p>
          </div>
          {availability.isLoading ? (
            <p
              className="flex items-center gap-2 text-sm text-slate-500"
              role="status"
            >
              <LoaderCircle className="h-4 w-4 animate-spin" /> Consultando
              disponibilidade…
            </p>
          ) : availability.isError ? (
            <p className="text-sm text-red-700" role="alert">
              Não foi possível consultar os horários. Confira se a agenda está
              configurada.
            </p>
          ) : availableSlots?.length ? (
            <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {availableSlots.map(slot => (
                <button
                  key={slot.starts_at}
                  type="button"
                  aria-pressed={selectedStart === slot.starts_at}
                  onClick={() => setSelectedStart(slot.starts_at)}
                  className={`rounded-lg border px-3 py-2 text-left text-xs ${
                    selectedStart === slot.starts_at
                      ? "border-[#087A92] bg-[#087A92] text-white"
                      : "border-slate-200 bg-white hover:border-[#087A92]"
                  }`}
                >
                  {formatDate(slot.starts_at, slot.timezone, {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    timeStyle: "short",
                  })}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Não há horários livres neste período.
            </p>
          )}
          <div>
            <Label htmlFor={`reschedule-reason-${appointment.id}`}>
              Motivo da remarcação
            </Label>
            <Input
              id={`reschedule-reason-${appointment.id}`}
              value={reason}
              maxLength={500}
              onChange={event => setReason(event.target.value)}
              placeholder="Informe o motivo"
            />
          </div>
          {appointment.status !== "held" && (
            <p className="text-xs leading-5 text-amber-800">
              A nova data só será aplicada após aprovação da clínica; o horário
              atual permanece reservado até a decisão.
            </p>
          )}
          {changeRequest.error && (
            <p className="text-sm text-red-700" role="alert">
              {changeRequest.error.message}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setReschedulingOpen(false)}
            >
              Voltar
            </Button>
            <Button
              type="button"
              disabled={
                !selectedSlot ||
                reason.trim().length < 2 ||
                changeRequest.isPending
              }
              onClick={submitReschedule}
              className="bg-[#087A92] text-white hover:bg-[#076b80]"
            >
              {changeRequest.isPending && (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirmar novo horário
            </Button>
          </div>
        </div>
      )}

      {detailsOpen && (
        <div className="grid gap-5 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
          <section>
            <h4 className="flex items-center gap-2 font-semibold">
              <WalletCards className="h-4 w-4 text-[#087A92]" /> Pagamentos
            </h4>
            {appointment.payments.length ? (
              <ul className="mt-2 space-y-2 text-sm text-slate-600">
                {appointment.payments.map(payment => (
                  <li key={payment.id} className="rounded-lg bg-white p-3">
                    <p>{payment.method === "pix" ? "PIX" : "Cartão"}</p>
                    <p className="mt-1">
                      R$ {payment.amount.toFixed(2).replace(".", ",")} ·{" "}
                      {paymentStatusLabels[payment.status] ?? payment.status}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                Não há pagamento registrado para este agendamento.
              </p>
            )}
          </section>
          <section>
            <h4 className="flex items-center gap-2 font-semibold">
              <FileText className="h-4 w-4 text-[#087A92]" /> Orientações e
              documentos
            </h4>
            {documents.isLoading ? (
              <p className="mt-2 text-sm text-slate-500">
                Carregando documentos…
              </p>
            ) : documents.isError ? (
              <p className="mt-2 text-sm text-red-700" role="alert">
                Não foi possível carregar os documentos.
              </p>
            ) : documents.data?.length ? (
              <ul className="mt-2 space-y-2">
                {documents.data.map(document => (
                  <li key={document.id} className="rounded-lg bg-white p-3">
                    <button
                      type="button"
                      onClick={() =>
                        setDocumentId(current =>
                          current === document.id ? null : document.id
                        )
                      }
                      className="text-left text-sm font-semibold text-[#087A92] hover:underline"
                    >
                      {document.title}
                    </button>
                    {documentId === document.id && (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                        {document.content}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                A clínica ainda não disponibilizou documentos ou orientações.
              </p>
            )}
          </section>
          <section className="sm:col-span-2">
            <h4 className="font-semibold">Histórico</h4>
            {appointment.history.length ? (
              <ol className="mt-2 space-y-2 text-sm text-slate-600">
                {appointment.history.map(event => (
                  <li key={event.id} className="rounded-lg bg-white p-3">
                    <p className="font-medium">
                      {historyLabels[event.action] ?? "Atualização"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(event.created_at, timezone, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                    {event.reason && <p className="mt-1">{event.reason}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                Nenhuma alteração registrada.
              </p>
            )}
            {pendingRequest && (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                Solicitação de{" "}
                {pendingRequest.kind === "cancellation"
                  ? "cancelamento"
                  : "remarcação"}{" "}
                enviada em{" "}
                {formatDate(pendingRequest.created_at, timezone, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
                .
              </p>
            )}
          </section>
        </div>
      )}
    </article>
  );
}

export default function PatientAppointments() {
  const appointments = trpc.clinic.myAppointments.useQuery(undefined, {
    refetchOnWindowFocus: true,
  });
  const patientProfiles = trpc.patientProfiles.list.useQuery();
  const [activeTab, setActiveTab] = useState("upcoming");

  const rows = (appointments.data ?? []) as Appointment[];
  const upcoming = useMemo(
    () =>
      rows.filter(
        appointment =>
          appointment.status !== "cancelled" &&
          appointment.status !== "completed" &&
          new Date(appointment.starts_at) >= new Date()
      ),
    [rows]
  );
  const completedConsultations = rows.filter(
    appointment =>
      appointment.kind === "consultation" && appointment.status === "completed"
  );
  const completedExams = rows.filter(
    appointment =>
      appointment.kind === "exam" && appointment.status === "completed"
  );
  const cancelled = rows.filter(
    appointment => appointment.status === "cancelled"
  );
  const patientsById = new Map(
    (patientProfiles.data ?? []).map(profile => [profile.id, profile.full_name])
  );

  if (appointments.isLoading || patientProfiles.isLoading) {
    return (
      <div
        className="flex items-center gap-2 py-8 text-sm text-slate-500"
        role="status"
      >
        <LoaderCircle className="h-4 w-4 animate-spin" />
        Carregando agendamentos…
      </div>
    );
  }

  if (appointments.isError) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-4 p-6">
          <p className="font-semibold">
            Não foi possível carregar seus agendamentos.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void appointments.refetch()}
          >
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const groups = [
    { id: "upcoming", label: "Próximos atendimentos", rows: upcoming },
    {
      id: "consultations",
      label: "Consultas realizadas",
      rows: completedConsultations,
    },
    { id: "exams", label: "Exames realizados", rows: completedExams },
    { id: "cancelled", label: "Cancelados", rows: cancelled },
  ];

  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm font-semibold text-[#18AFA0]">Área do paciente</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight">
          Meus agendamentos
        </h2>
        <p className="mt-2 text-slate-500">
          Consulte atendimentos, pagamentos, documentos e solicitações de
          alteração.
        </p>
      </div>

      {patientProfiles.isError && (
        <p
          className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800"
          role="alert"
        >
          Não foi possível carregar os nomes dos pacientes vinculados. Atualize
          os dados dos perfis para identificá-los.
        </p>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
          {groups.map(group => (
            <TabsTrigger
              key={group.id}
              value={group.id}
              className="min-h-10 whitespace-normal text-xs sm:text-sm"
            >
              {group.label} ({group.rows.length})
            </TabsTrigger>
          ))}
        </TabsList>
        {groups.map(group => (
          <TabsContent key={group.id} value={group.id}>
            <Card className="mt-4 border-0 shadow-sm">
              <CardContent className="divide-y divide-slate-100 p-0">
                {group.rows.length ? (
                  group.rows.map(appointment => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      patientName={
                        appointment.patient_profile_id
                          ? (patientsById.get(appointment.patient_profile_id) ??
                            "Paciente")
                          : "Paciente"
                      }
                    />
                  ))
                ) : (
                  <p className="p-6 text-sm text-slate-500">
                    {group.id === "upcoming"
                      ? "Você não possui atendimentos futuros."
                      : "Não há agendamentos nesta categoria."}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
