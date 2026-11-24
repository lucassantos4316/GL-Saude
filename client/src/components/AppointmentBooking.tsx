import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import type { Database } from "@/lib/database.types";
import { isAdult } from "@shared/registration";
import {
  Building2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  LoaderCircle,
  Stethoscope,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

type Clinic = Pick<
  Database["public"]["Tables"]["clinics"]["Row"],
  "id" | "name" | "city" | "timezone"
>;
type Professional = Database["public"]["Tables"]["professionals"]["Row"];
type BookingKind = "consultation" | "exam";
type AvailabilitySlot = {
  starts_at: string;
  ends_at: string;
  local_date: string;
  timezone: string;
};

const steps = [
  "Unidade e área",
  "Profissional",
  "Data e horário",
  "Paciente",
  "Revisão",
];

function dateInTimezone(value: Date, timezone: string) {
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

function addCalendarDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function formatLocalDate(
  value: string,
  timezone: string,
  options: Intl.DateTimeFormatOptions
) {
  return new Intl.DateTimeFormat("pt-BR", {
    ...options,
    timeZone: timezone,
  }).format(new Date(value));
}

export default function AppointmentBooking({
  onDone,
  onViewAppointments,
  initialKind = "consultation",
  initialProfessionalId,
  initialClinicId,
}: {
  onDone: () => void;
  onViewAppointments: () => void;
  initialKind?: BookingKind;
  initialProfessionalId?: string;
  initialClinicId?: string;
}) {
  const utils = trpc.useUtils();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [clinicsLoading, setClinicsLoading] = useState(isSupabaseConfigured);
  const [clinicsError, setClinicsError] = useState(false);
  const [clinicId, setClinicId] = useState(initialClinicId ?? "");
  const [specialty, setSpecialty] = useState("");
  const [professionalId, setProfessionalId] = useState(
    initialProfessionalId ?? ""
  );
  const [kind, setKind] = useState<BookingKind>(initialKind);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(
    initialProfessionalId ? 3 : 1
  );
  const [patientProfileId, setPatientProfileId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedStart, setSelectedStart] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [reservationId, setReservationId] = useState<string | null>(null);

  const professionals = trpc.clinic.professionals.useQuery(
    clinicId ? { clinicId } : undefined,
    { enabled: kind === "consultation" }
  );
  const patientProfiles = trpc.patientProfiles.list.useQuery();
  const selectableProfiles = (patientProfiles.data ?? []).filter(
    profile =>
      ["self", "guardian_attested", "verified"].includes(
        profile.authorization_status
      ) &&
      (!profile.is_self ||
        Boolean(profile.birth_date && isAdult(profile.birth_date)))
  );
  const selectedClinic = clinics.find(clinic => clinic.id === clinicId);
  const timezone = selectedClinic?.timezone ?? "America/Sao_Paulo";
  const fromDate = dateInTimezone(new Date(), timezone);
  const toDate = addCalendarDays(fromDate, 13);
  const selectedProfessional = professionals.data?.find(
    professional => professional.id === professionalId
  );
  const selectedPatient = selectableProfiles.find(
    profile => profile.id === patientProfileId
  );
  const specialties = useMemo(
    () =>
      Array.from(
        new Set(
          (professionals.data ?? []).map(professional => professional.specialty)
        )
      ).sort((left, right) => left.localeCompare(right, "pt-BR")),
    [professionals.data]
  );
  const filteredProfessionals = (professionals.data ?? []).filter(
    professional => !specialty || professional.specialty === specialty
  );
  const availability = trpc.clinic.availability.useQuery(
    {
      professionalId,
      from: fromDate,
      to: toDate,
    },
    {
      enabled: kind === "consultation" && Boolean(professionalId),
      staleTime: 10_000,
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
    }
  );
  const availableSlots = availability.data as AvailabilitySlot[] | undefined;
  const availableDates = useMemo(
    () =>
      Array.from(new Set((availableSlots ?? []).map(slot => slot.local_date))),
    [availableSlots]
  );
  const selectedSlot = availableSlots?.find(
    slot => slot.starts_at === selectedStart
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;

    void (async () => {
      try {
        const { data, error } = await supabase
          .from("clinics")
          .select("id, name, city, timezone")
          .order("name");
        if (!active) return;
        if (error) {
          console.error("[AppointmentBooking] Could not load clinics:", error);
          setClinicsError(true);
        } else {
          setClinics(data ?? []);
        }
      } catch (error) {
        if (!active) return;
        console.error("[AppointmentBooking] Could not load clinics:", error);
        setClinicsError(true);
      } finally {
        if (active) setClinicsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!patientProfileId && selectableProfiles.length) {
      setPatientProfileId(selectableProfiles[0].id);
    } else if (
      patientProfileId &&
      !selectableProfiles.some(profile => profile.id === patientProfileId)
    ) {
      setPatientProfileId(selectableProfiles[0]?.id ?? "");
    }
  }, [patientProfileId, selectableProfiles]);

  useEffect(() => {
    if (availableDates.length && !availableDates.includes(selectedDate)) {
      setSelectedDate(availableDates[0]);
      setSelectedStart("");
    }
  }, [availableDates, selectedDate]);

  const createAppointment = trpc.clinic.holdSlot.useMutation({
    onSuccess: async id => {
      await utils.clinic.myAppointments.invalidate();
      setReservationId(id);
      toast.success("Reserva temporária criada.");
    },
    onError: error => setErrorMessage(error.message),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    if (!selectedProfessional || !selectedPatient || !selectedSlot) {
      setErrorMessage(
        "Confira a unidade, o profissional, o horário e o paciente."
      );
      return;
    }

    const startsAt = new Date(selectedSlot.starts_at);
    const endsAt = new Date(selectedSlot.ends_at);
    if (
      !Number.isFinite(startsAt.getTime()) ||
      !Number.isFinite(endsAt.getTime()) ||
      startsAt <= new Date()
    ) {
      setErrorMessage(
        "Esse horário não está mais disponível. Atualize a disponibilidade."
      );
      void availability.refetch();
      return;
    }

    createAppointment.mutate({
      professionalId: selectedProfessional.id,
      clinicId: selectedProfessional.clinic_id,
      kind,
      startsAt,
      endsAt,
      patientProfileId: selectedPatient.id,
    });
  };

  const updateClinic = (value: string) => {
    setClinicId(value);
    setSpecialty("");
    setProfessionalId("");
    setSelectedDate("");
    setSelectedStart("");
    setStep(1);
  };

  if (reservationId) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="space-y-5 p-7 sm:p-9">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <Check className="h-7 w-7" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold">
                Reserva temporária realizada
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Seu horário está reservado por até 10 minutos. Esta reserva
                ainda não é uma confirmação final; pagamento e confirmação
                online dependem da integração com a clínica.
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-sm">
              <p>
                <strong>Protocolo:</strong> {reservationId}
              </p>
              {selectedPatient && (
                <p className="mt-1">
                  <strong>Paciente:</strong> {selectedPatient.full_name}
                </p>
              )}
              {selectedProfessional && (
                <p className="mt-1">
                  <strong>Profissional:</strong>{" "}
                  {selectedProfessional.display_name}
                </p>
              )}
              {selectedSlot && (
                <p className="mt-1">
                  <strong>Horário:</strong>{" "}
                  {formatLocalDate(
                    selectedSlot.starts_at,
                    selectedSlot.timezone,
                    {
                      dateStyle: "long",
                      timeStyle: "short",
                    }
                  )}
                </p>
              )}
            </div>
            <Button
              type="button"
              onClick={onViewAppointments}
              className="w-full bg-[#087A92] text-white hover:bg-[#076b80]"
            >
              Ver meus agendamentos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
        <p className="text-sm font-semibold text-[#18AFA0]">
          Agendamento online
        </p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight">
          Vamos encontrar seu atendimento
        </h2>
        <p className="mt-2 text-slate-500">
          Escolha uma clínica e veja os horários cadastrados e livres na agenda.
        </p>
      </div>

      <div
        className="grid gap-3 sm:grid-cols-2"
        aria-label="Tipo de atendimento"
      >
        <button
          type="button"
          aria-pressed={kind === "consultation"}
          onClick={() => {
            setKind("consultation");
            setStep(1);
            setErrorMessage("");
          }}
          className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left ${
            kind === "consultation"
              ? "border-[#087A92] bg-white"
              : "border-transparent bg-white/70"
          }`}
        >
          <Stethoscope className="h-5 w-5 text-[#087A92]" />
          <span>
            <span className="block font-semibold">Consulta</span>
            <span className="text-xs text-slate-500">
              Agendamento com profissional
            </span>
          </span>
        </button>
        <button
          type="button"
          aria-pressed={kind === "exam"}
          onClick={() => {
            setKind("exam");
            setErrorMessage("");
          }}
          className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left ${
            kind === "exam"
              ? "border-[#087A92] bg-white"
              : "border-transparent bg-white/70"
          }`}
        >
          <FileText className="h-5 w-5 text-[#087A92]" />
          <span>
            <span className="block font-semibold">Exame</span>
            <span className="text-xs text-slate-500">Catálogo de exames</span>
          </span>
        </button>
      </div>

      {kind === "exam" ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="space-y-3 p-6">
            <h3 className="font-bold">
              Agendamento de exames ainda não está disponível
            </h3>
            <p className="text-sm leading-6 text-slate-600">
              O sistema ainda não possui um catálogo de exames e unidades
              habilitadas. Para evitar oferecer exames ou horários que não foram
              cadastrados, este fluxo ficará indisponível até a implantação
              desse catálogo.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setKind("consultation")}
            >
              Agendar uma consulta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <ol
            className="grid grid-cols-2 gap-2 sm:grid-cols-5"
            aria-label={`Etapa ${step} de 5`}
          >
            {steps.map((label, index) => {
              const number = index + 1;
              return (
                <li
                  key={label}
                  className="flex items-center gap-2 text-xs sm:flex-col sm:items-start"
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-bold ${
                      step > number
                        ? "bg-emerald-600 text-white"
                        : step === number
                          ? "bg-[#087A92] text-white"
                          : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {step > number ? <Check className="h-4 w-4" /> : number}
                  </span>
                  <span
                    className={
                      step === number
                        ? "font-semibold text-[#087A92]"
                        : "text-slate-500"
                    }
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 sm:p-9">
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold">
                      Escolha a unidade e a especialidade
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      As opções vêm dos cadastros da clínica.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="appointment-clinic">
                      Clínica ou unidade
                    </Label>
                    <Select value={clinicId} onValueChange={updateClinic}>
                      <SelectTrigger id="appointment-clinic">
                        <SelectValue placeholder="Selecione uma clínica" />
                      </SelectTrigger>
                      <SelectContent>
                        {clinics.map(clinic => (
                          <SelectItem key={clinic.id} value={clinic.id}>
                            {clinic.name}
                            {clinic.city ? ` · ${clinic.city}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {clinicsLoading && (
                      <p className="text-sm text-slate-500">
                        Carregando clínicas…
                      </p>
                    )}
                    {clinicsError && (
                      <p className="text-sm text-red-700" role="alert">
                        Não foi possível carregar as clínicas. Tente novamente.
                      </p>
                    )}
                    {!clinicsLoading &&
                      !clinicsError &&
                      clinics.length === 0 && (
                        <p className="text-sm text-slate-500">
                          Nenhuma clínica foi cadastrada no sistema.
                        </p>
                      )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="appointment-specialty">Especialidade</Label>
                    <Select
                      value={specialty}
                      onValueChange={value => {
                        setSpecialty(value);
                        setProfessionalId("");
                      }}
                      disabled={
                        !clinicId ||
                        professionals.isLoading ||
                        !specialties.length
                      }
                    >
                      <SelectTrigger id="appointment-specialty">
                        <SelectValue placeholder="Selecione uma especialidade" />
                      </SelectTrigger>
                      <SelectContent>
                        {specialties.map(item => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {professionals.isError && (
                      <p className="text-sm text-red-700" role="alert">
                        Não foi possível carregar as especialidades. Tente
                        novamente.
                      </p>
                    )}
                    {clinicId &&
                      !professionals.isLoading &&
                      !professionals.isError &&
                      !specialties.length && (
                        <p className="text-sm text-slate-500">
                          Não há profissionais ativos nesta unidade.
                        </p>
                      )}
                  </div>
                  <Button
                    type="button"
                    disabled={!clinicId || !specialty}
                    onClick={() => setStep(2)}
                    className="w-full bg-[#087A92] text-white hover:bg-[#076b80]"
                  >
                    Ver profissionais <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xl font-bold">
                      Escolha o profissional
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {specialty} · {selectedClinic?.name}
                    </p>
                  </div>
                  {professionals.isLoading ? (
                    <p
                      className="flex items-center gap-2 text-sm text-slate-500"
                      role="status"
                    >
                      <LoaderCircle className="h-4 w-4 animate-spin" />{" "}
                      Carregando profissionais…
                    </p>
                  ) : filteredProfessionals.length ? (
                    <div className="space-y-3">
                      {filteredProfessionals.map(
                        (professional: Professional) => (
                          <button
                            key={professional.id}
                            type="button"
                            aria-pressed={professionalId === professional.id}
                            onClick={() => setProfessionalId(professional.id)}
                            className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left ${
                              professionalId === professional.id
                                ? "border-[#087A92] bg-[#087A92]/5"
                                : "border-slate-200 hover:border-[#18AFA0]"
                            }`}
                          >
                            <span className="rounded-full bg-[#087A92]/10 p-3 text-[#087A92]">
                              <Stethoscope className="h-5 w-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold">
                                {professional.display_name}
                              </span>
                              <span className="mt-1 block text-sm text-slate-500">
                                {professional.specialty} · {professional.crm}
                              </span>
                              <span className="mt-1 block text-xs text-slate-500">
                                Consulta particular: R${" "}
                                {professional.consultation_price
                                  .toFixed(2)
                                  .replace(".", ",")}
                              </span>
                            </span>
                            {professionalId === professional.id && (
                              <Check className="h-5 w-5 text-[#087A92]" />
                            )}
                          </button>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                      Nenhum profissional ativo está cadastrado para esta
                      especialidade e unidade.
                    </p>
                  )}
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(1)}
                      className="flex-1"
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                    </Button>
                    <Button
                      type="button"
                      disabled={!selectedProfessional}
                      onClick={() => setStep(3)}
                      className="flex-1 bg-[#087A92] text-white hover:bg-[#076b80]"
                    >
                      Ver horários <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold">
                      Escolha uma data e horário
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Disponibilidade atualizada a partir da agenda da unidade.
                    </p>
                  </div>
                  {availability.isLoading ? (
                    <p
                      className="flex items-center gap-2 text-sm text-slate-500"
                      role="status"
                    >
                      <LoaderCircle className="h-4 w-4 animate-spin" />{" "}
                      Consultando horários livres…
                    </p>
                  ) : availability.isError ? (
                    <div
                      className="space-y-3 rounded-xl bg-red-50 p-4 text-sm text-red-700"
                      role="alert"
                    >
                      <p>
                        Não foi possível consultar a disponibilidade. Confira se
                        a migração de agenda foi aplicada e tente novamente.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void availability.refetch()}
                      >
                        Tentar novamente
                      </Button>
                    </div>
                  ) : availableSlots?.length ? (
                    <>
                      <div>
                        <p className="mb-3 text-sm font-semibold">
                          Dias disponíveis
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {availableDates.map(date => (
                            <button
                              key={date}
                              type="button"
                              aria-pressed={selectedDate === date}
                              onClick={() => {
                                setSelectedDate(date);
                                setSelectedStart("");
                              }}
                              className={`rounded-lg border px-3 py-2 text-sm ${
                                selectedDate === date
                                  ? "border-[#087A92] bg-[#087A92] text-white"
                                  : "border-slate-200 bg-white hover:border-[#087A92]"
                              }`}
                            >
                              {new Intl.DateTimeFormat("pt-BR", {
                                weekday: "short",
                                day: "2-digit",
                                month: "short",
                                timeZone: "UTC",
                              }).format(new Date(`${date}T12:00:00Z`))}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                          <Clock3 className="h-4 w-4 text-[#087A92]" /> Horários
                          livres
                        </p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {availableSlots
                            .filter(slot => slot.local_date === selectedDate)
                            .map(slot => (
                              <button
                                key={slot.starts_at}
                                type="button"
                                aria-pressed={selectedStart === slot.starts_at}
                                onClick={() => setSelectedStart(slot.starts_at)}
                                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                                  selectedStart === slot.starts_at
                                    ? "border-[#087A92] bg-[#087A92] text-white"
                                    : "border-slate-200 hover:border-[#087A92]"
                                }`}
                              >
                                {formatLocalDate(
                                  slot.starts_at,
                                  slot.timezone,
                                  { timeStyle: "short" }
                                )}
                              </button>
                            ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                      Não há horários livres para os próximos 14 dias. A agenda
                      pode não estar configurada ou todos os horários já estão
                      ocupados.
                    </div>
                  )}
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(2)}
                      className="flex-1"
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                    </Button>
                    <Button
                      type="button"
                      disabled={!selectedSlot}
                      onClick={() => setStep(4)}
                      className="flex-1 bg-[#087A92] text-white hover:bg-[#076b80]"
                    >
                      Identificar paciente{" "}
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xl font-bold">
                      Quem receberá o atendimento?
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Apenas perfis com autorização válida podem ser
                      selecionados.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="appointment-patient">Paciente</Label>
                    <Select
                      value={patientProfileId}
                      onValueChange={setPatientProfileId}
                    >
                      <SelectTrigger id="appointment-patient">
                        <SelectValue placeholder="Selecione o paciente" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectableProfiles.map(profile => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.full_name}
                            {profile.is_self
                              ? " · Você"
                              : ` · ${profile.relationship}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {patientProfiles.isLoading && (
                      <p className="text-sm text-slate-500">
                        Carregando pacientes autorizados…
                      </p>
                    )}
                    {patientProfiles.isError && (
                      <p className="text-sm text-red-700" role="alert">
                        Não foi possível carregar os pacientes. Tente novamente.
                      </p>
                    )}
                    {!patientProfiles.isLoading &&
                      !patientProfiles.isError &&
                      !selectableProfiles.length && (
                        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                          Nenhum perfil está autorizado a agendar. Cadastre um
                          dependente ou conclua a verificação de autorização.
                        </p>
                      )}
                  </div>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(3)}
                      className="flex-1"
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                    </Button>
                    <Button
                      type="button"
                      disabled={!selectedPatient}
                      onClick={() => setStep(5)}
                      className="flex-1 bg-[#087A92] text-white hover:bg-[#076b80]"
                    >
                      Revisar <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {step === 5 && (
                <form onSubmit={submit} className="space-y-5">
                  <div>
                    <h3 className="text-xl font-bold">Revise sua reserva</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Confira os dados antes de reservar o horário.
                    </p>
                  </div>
                  {selectedProfessional &&
                    selectedClinic &&
                    selectedPatient &&
                    selectedSlot && (
                      <div className="space-y-3 rounded-xl bg-slate-50 p-5 text-sm">
                        <p>
                          <strong>Paciente:</strong> {selectedPatient.full_name}
                        </p>
                        <p>
                          <strong>Clínica:</strong> {selectedClinic.name}
                          {selectedClinic.city
                            ? ` · ${selectedClinic.city}`
                            : ""}
                        </p>
                        <p>
                          <strong>Profissional:</strong>{" "}
                          {selectedProfessional.display_name}
                        </p>
                        <p>
                          <strong>Especialidade:</strong>{" "}
                          {selectedProfessional.specialty}
                        </p>
                        <p>
                          <strong>Data e horário:</strong>{" "}
                          {formatLocalDate(
                            selectedSlot.starts_at,
                            selectedSlot.timezone,
                            { dateStyle: "full", timeStyle: "short" }
                          )}
                        </p>
                        <p>
                          <strong>Atendimento:</strong> Consulta presencial
                        </p>
                        <p>
                          <strong>Valor particular:</strong> R${" "}
                          {selectedProfessional.consultation_price
                            .toFixed(2)
                            .replace(".", ",")}
                        </p>
                        <Badge variant="outline">
                          O convênio não está configurado neste fluxo
                        </Badge>
                      </div>
                    )}
                  <p className="rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                    Esta ação cria uma reserva temporária de 10 minutos. Ela não
                    confirma pagamento ou atendimento; a integração com gateway
                    ainda não está configurada.
                  </p>
                  {errorMessage && (
                    <p
                      className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
                      role="alert"
                    >
                      {errorMessage}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(4)}
                      className="flex-1"
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        !selectedProfessional ||
                        !selectedPatient ||
                        !selectedSlot ||
                        createAppointment.isPending
                      }
                      className="flex-1 bg-[#087A92] text-white hover:bg-[#076b80]"
                    >
                      {createAppointment.isPending ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CalendarDays className="mr-2 h-4 w-4" />
                      )}
                      Reservar por 10 minutos
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
