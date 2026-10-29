import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { CalendarClock, LoaderCircle, Trash2 } from "lucide-react";
import * as React from "react";
import { useState } from "react";
import { toast } from "sonner";

function toLocalDateTime(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

const statusLabels: Record<string, string> = {
  held: "Reservado",
  pending_payment: "Pagamento pendente",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  completed: "Concluído",
};

export default function PatientAppointments() {
  const utils = trpc.useUtils();
  const appointments = trpc.clinic.myAppointments.useQuery();
  const patientProfiles = trpc.patientProfiles.list.useQuery();
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [newStart, setNewStart] = useState("");

  const updateAppointment = trpc.clinic.updateHeldSlot.useMutation({
    onSuccess: async () => {
      await utils.clinic.myAppointments.invalidate();
      setReschedulingId(null);
      toast.success("Horário atualizado.");
    },
  });
  const deleteAppointment = trpc.clinic.deleteHeldSlot.useMutation({
    onSuccess: async () => {
      await utils.clinic.myAppointments.invalidate();
      toast.success("Reserva cancelada.");
    },
  });

  const saveReschedule = (appointment: NonNullable<typeof appointments.data>[number]) => {
    const startsAt = new Date(newStart);
    if (!Number.isFinite(startsAt.getTime()) || startsAt <= new Date()) {
      toast.error("Escolha um horário futuro válido.");
      return;
    }
    const duration = new Date(appointment.ends_at).getTime() -
      new Date(appointment.starts_at).getTime();
    updateAppointment.mutate({
      appointmentId: appointment.id,
      kind: appointment.kind,
      startsAt,
      endsAt: new Date(startsAt.getTime() + duration),
    });
  };

  if (appointments.isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-slate-500" role="status">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        Carregando agendamentos…
      </div>
    );
  }

  if (appointments.isError) {
    return (
      <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">
        Não foi possível carregar os agendamentos. Atualize a página e tente novamente.
      </p>
    );
  }

  const rows = appointments.data ?? [];

  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Meus agendamentos</h2>
        <p className="mt-2 text-slate-500">
          Acompanhe suas reservas e o status de cada atendimento.
        </p>
      </div>
      <Card className="border-0 shadow-sm">
        <CardContent className="divide-y divide-slate-100 p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">
              Você ainda não possui agendamentos.
            </p>
          ) : rows.map((appointment) => {
            const editable = appointment.status === "held";
            const patientName = patientProfiles.data?.find(
              (profile) => profile.id === appointment.patient_profile_id
            )?.full_name ?? "Paciente";
            return (
              <article key={appointment.id} className="space-y-3 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <CalendarClock className="h-6 w-6 text-[#087A92]" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="font-bold">
                      {appointment.kind === "consultation" ? "Consulta" : "Exame"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">Paciente: {patientName}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "long",
                        timeStyle: "short",
                      }).format(new Date(appointment.starts_at))}
                    </p>
                    <Badge variant="outline" className="mt-2 border-slate-200 text-slate-600">
                      {statusLabels[appointment.status] ?? appointment.status}
                    </Badge>
                    {editable && appointment.hold_expires_at && (
                      <p className="mt-2 text-xs text-amber-700">
                        Reserva expira às {new Intl.DateTimeFormat("pt-BR", {
                          timeStyle: "short",
                        }).format(new Date(appointment.hold_expires_at))}
                      </p>
                    )}
                  </div>
                  {editable && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setReschedulingId(appointment.id);
                          setNewStart(toLocalDateTime(appointment.starts_at));
                        }}
                      >
                        Reagendar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        aria-label="Cancelar reserva"
                        disabled={deleteAppointment.isPending}
                        onClick={() => deleteAppointment.mutate({ appointmentId: appointment.id })}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                {reschedulingId === appointment.id && (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      type="datetime-local"
                      value={newStart}
                      min={toLocalDateTime(new Date().toISOString())}
                      onChange={(event) => setNewStart(event.target.value)}
                      aria-label="Novo horário"
                    />
                    <Button
                      type="button"
                      disabled={updateAppointment.isPending}
                      onClick={() => saveReschedule(appointment)}
                    >
                      {updateAppointment.isPending && (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Salvar horário
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
