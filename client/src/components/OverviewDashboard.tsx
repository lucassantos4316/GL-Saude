import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { CalendarDays, Check, Clock3, WalletCards } from "lucide-react";
import * as React from "react";

type Role = "patient" | "doctor" | "operator";

export default function OverviewDashboard({
  role,
  go,
}: {
  role: Role;
  go: (section: string) => void;
}) {
  const patientAppointments = trpc.clinic.myAppointments.useQuery(undefined, {
    enabled: role === "patient",
  });
  const doctorAgenda = trpc.doctor.agenda.useQuery(undefined, {
    enabled: role === "doctor",
  });
  const operatorAgenda = trpc.operator.clinicAgenda.useQuery(undefined, {
    enabled: role === "operator",
  });
  const query =
    role === "patient"
      ? patientAppointments
      : role === "doctor"
        ? doctorAgenda
        : operatorAgenda;
  const rows = [...(query.data ?? [])].sort(
    (left, right) =>
      new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime()
  );
  const upcoming = rows.filter(
    (appointment) =>
      new Date(appointment.starts_at).getTime() >= Date.now() &&
      appointment.status !== "cancelled"
  );
  const completed = rows.filter(
    (appointment) => appointment.status === "completed"
  ).length;
  const awaitingPayment = rows.filter(
    (appointment) => appointment.status === "pending_payment"
  ).length;
  const isPatient = role === "patient";
  const metrics = isPatient
    ? [
        {
          label: "Próximo atendimento",
          value: upcoming[0]
            ? new Intl.DateTimeFormat("pt-BR", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(upcoming[0].starts_at))
            : "Nenhum",
          icon: CalendarDays,
        },
        { label: "Atendimentos concluídos", value: String(completed), icon: Check },
        {
          label: "Pagamentos pendentes",
          value: String(awaitingPayment),
          icon: WalletCards,
        },
      ]
    : [
        { label: "Próximos atendimentos", value: String(upcoming.length), icon: CalendarDays },
        { label: "Aguardando pagamento", value: String(awaitingPayment), icon: Clock3 },
        { label: "Atendimentos concluídos", value: String(completed), icon: Check },
      ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-sm font-medium text-[#18AFA0]">
            {new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date())}
          </p>
          <h2 className="text-3xl font-bold tracking-[-0.03em]">
            {isPatient ? "Seu cuidado em dia." : role === "doctor" ? "Sua agenda" : "Agenda da clínica"}
          </h2>
          <p className="mt-2 text-slate-500">
            {isPatient
              ? "Consulte seus atendimentos e acompanhe suas reservas."
              : "Resumo atualizado a partir dos agendamentos registrados."}
          </p>
        </div>
        {isPatient && (
          <Button onClick={() => go("schedule")} className="bg-[#087A92] hover:bg-[#076b80]">
            <CalendarDays className="mr-2 h-4 w-4" />
            Novo agendamento
          </Button>
        )}
      </div>

      {query.isError && (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">
          Não foi possível consultar os dados no Supabase. Tente novamente.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.label} className="border-0 shadow-sm">
            <CardContent className="flex items-start justify-between p-5">
              <div>
                <p className="text-sm text-slate-500">{metric.label}</p>
                <p className="mt-2 text-xl font-bold">{query.isLoading ? "…" : metric.value}</p>
              </div>
              <div className="rounded-xl bg-[#087A92]/10 p-3 text-[#087A92]">
                <metric.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">
            {isPatient ? "Próximos cuidados" : "Próximos atendimentos"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {upcoming.slice(0, 5).map((appointment) => (
            <div
              key={appointment.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-4"
            >
              <div>
                <p className="font-semibold">
                  {appointment.kind === "consultation" ? "Consulta" : "Exame"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "long",
                    timeStyle: "short",
                  }).format(new Date(appointment.starts_at))}
                </p>
              </div>
              <span className="text-sm text-slate-600">{appointment.status}</span>
            </div>
          ))}
          {!query.isLoading && !query.isError && upcoming.length === 0 && (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              Nenhum atendimento futuro foi encontrado.
            </p>
          )}
          {isPatient && (
            <Button type="button" variant="outline" onClick={() => go("history")}>
              Ver todos os agendamentos
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
