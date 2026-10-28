import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { CalendarDays, LoaderCircle } from "lucide-react";
import * as React from "react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

function localDateTimeValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export default function AppointmentBooking({ onDone }: { onDone: () => void }) {
  const utils = trpc.useUtils();
  const professionals = trpc.clinic.professionals.useQuery();
  const [professionalId, setProfessionalId] = useState("");
  const [kind, setKind] = useState<"consultation" | "exam">("consultation");
  const [startsAt, setStartsAt] = useState(() =>
    localDateTimeValue(new Date(Date.now() + 60 * 60 * 1000))
  );
  const [errorMessage, setErrorMessage] = useState("");
  const createAppointment = trpc.clinic.holdSlot.useMutation({
    onSuccess: async () => {
      await utils.clinic.myAppointments.invalidate();
      toast.success("Horário reservado por 10 minutos.");
      onDone();
    },
    onError: (error) => setErrorMessage(error.message),
  });

  const selectedProfessional = professionals.data?.find(
    (professional) => professional.id === professionalId
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    if (!selectedProfessional) {
      setErrorMessage("Selecione um profissional disponível.");
      return;
    }

    const start = new Date(startsAt);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    if (!Number.isFinite(start.getTime()) || start <= new Date()) {
      setErrorMessage("Escolha um horário futuro válido.");
      return;
    }

    createAppointment.mutate({
      professionalId: selectedProfessional.id,
      clinicId: selectedProfessional.clinic_id,
      kind,
      startsAt: start,
      endsAt: end,
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <div>
        <button
          type="button"
          className="mb-4 text-sm font-semibold text-[#087A92]"
          onClick={onDone}
        >
          ← Voltar ao painel
        </button>
        <h2 className="text-3xl font-bold tracking-tight">Novo agendamento</h2>
        <p className="mt-2 text-slate-500">
          Escolha o profissional e um horário disponível para seu atendimento.
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-6 sm:p-9">
          <form onSubmit={submit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="appointment-kind">Tipo de atendimento</Label>
            <Select
              value={kind}
              onValueChange={(value) => setKind(value === "exam" ? "exam" : "consultation")}
            >
              <SelectTrigger id="appointment-kind"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="consultation">Consulta</SelectItem>
                <SelectItem value="exam">Exame</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="appointment-professional">Profissional</Label>
            <Select value={professionalId} onValueChange={setProfessionalId}>
              <SelectTrigger id="appointment-professional">
                <SelectValue placeholder="Selecione um profissional" />
              </SelectTrigger>
              <SelectContent>
                {professionals.data?.map((professional) => (
                  <SelectItem key={professional.id} value={professional.id}>
                  {professional.display_name} · {professional.specialty}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {professionals.isLoading && (
              <p className="text-sm text-slate-500">Carregando profissionais…</p>
            )}
            {professionals.isError && (
              <p className="text-sm text-red-700" role="alert">
                Não foi possível carregar os profissionais. Tente novamente.
              </p>
            )}
            {!professionals.isLoading && !professionals.isError && !professionals.data?.length && (
              <p className="text-sm text-slate-500">
                Nenhum profissional ativo foi cadastrado no Supabase.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="appointment-start">Data e hora</Label>
            <input
              id="appointment-start"
              type="datetime-local"
              min={localDateTimeValue(new Date())}
              required
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-500">
              A reserva dura 10 minutos. A confirmação de pagamento depende da integração do gateway.
            </p>
          </div>

          {selectedProfessional && (
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="font-semibold">{selectedProfessional.display_name}</p>
              <p className="mt-1 text-sm text-slate-500">
                {selectedProfessional.specialty} · {selectedProfessional.crm} · R$ {selectedProfessional.consultation_price.toFixed(2)}
              </p>
              <Badge className="mt-3 bg-[#18AFA0]/10 text-[#087A92]">
                {kind === "consultation" ? "Consulta" : "Exame"}
              </Badge>
            </div>
          )}

          {errorMessage && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
              {errorMessage}
            </p>
          )}

          <Button
            disabled={!selectedProfessional || createAppointment.isPending}
            type="submit"
            className="h-11 w-full bg-[#087A92] hover:bg-[#076b80]"
          >
            {createAppointment.isPending ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CalendarDays className="mr-2 h-4 w-4" />
            )}
            Reservar horário
          </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
