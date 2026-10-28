import { useMemo, useState } from "react";
import {
  Building2,
  HeartPulse,
  MapPin,
  Search,
  Stethoscope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/BrandLogo";

export type HealthcareUnit = {
  id: string;
  name: string;
  category: string;
  location: string;
  description: string;
  specialties: string[];
  initials: string;
  theme: string;
  status: string;
};

export const healthcareUnits: HealthcareUnit[] = [
  {
    id: "santa-aurora",
    name: "Hospital Santa Aurora",
    category: "Hospital",
    location: "Campo Grande, MS",
    description: "Atendimento completo e cuidado integrado para toda a família.",
    specialties: ["Pronto atendimento", "Cardiologia", "Pediatria"],
    initials: "SA",
    theme: "from-[#087A92] to-[#18AFA0]",
    status: "Aberto hoje",
  },
  {
    id: "clinica-horizonte",
    name: "Clínica Horizonte",
    category: "Clínica médica",
    location: "Campo Grande, MS",
    description: "Consultas especializadas com uma equipe que cuida de você.",
    specialties: ["Clínica geral", "Dermatologia", "Nutrição"],
    initials: "CH",
    theme: "from-[#18AFA0] to-[#4CCB73]",
    status: "Agenda disponível",
  },
  {
    id: "instituto-vitta",
    name: "Instituto Vitta",
    category: "Centro de especialidades",
    location: "Campo Grande, MS",
    description: "Tecnologia e acolhimento em cada etapa do seu tratamento.",
    specialties: ["Ortopedia", "Fisioterapia", "Neurologia"],
    initials: "IV",
    theme: "from-[#4D7CFE] to-[#18AFA0]",
    status: "Agenda disponível",
  },
  {
    id: "centro-alameda",
    name: "Centro Médico Alameda",
    category: "Centro médico",
    location: "Campo Grande, MS",
    description: "Exames e consultas em um só lugar, com praticidade.",
    specialties: ["Exames laboratoriais", "Imagem", "Oftalmologia"],
    initials: "CA",
    theme: "from-[#8B6CE8] to-[#087A92]",
    status: "Aberto hoje",
  },
];

export default function ClinicHub({
  userName,
  onSelect,
  onBackToLogin,
}: {
  userName: string;
  onSelect: (unit: HealthcareUnit) => void;
  onBackToLogin: () => void;
}) {
  const [query, setQuery] = useState("");
  const filteredUnits = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalizedQuery) return healthcareUnits;
    return healthcareUnits.filter((unit) =>
      [
        unit.name,
        unit.category,
        unit.location,
        ...unit.specialties,
      ]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedQuery),
    );
  }, [query]);

  return (
    <div className="min-h-screen bg-[#f7fbfb] text-slate-900">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <BrandLogo />
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full bg-[#e7f7f5] px-4 py-2 text-sm font-medium text-[#087A92] sm:flex">
              <HeartPulse className="h-4 w-4" />
              Cuidado conectado
            </div>
            <Button
              onClick={onBackToLogin}
              className="h-10 bg-[#087A92] px-4 text-white hover:bg-[#076b80]"
            >
              Voltar ao login
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#075d70] via-[#087A92] to-[#18AFA0] px-6 py-9 text-white shadow-[0_24px_70px_rgba(8,122,146,0.18)] sm:px-10 sm:py-12">
          <div className="absolute -right-20 -top-32 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-36 right-1/4 h-72 w-72 rounded-full bg-[#4CCB73]/20 blur-3xl" />
          <div className="relative max-w-2xl">
            <Badge className="mb-5 border-white/20 bg-white/10 text-white hover:bg-white/10">
              <Building2 className="mr-2 h-3.5 w-3.5" />
              Sua rede de cuidado
            </Badge>
            <p className="text-sm font-medium text-white/75">Olá, {userName}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
              Onde você quer ser cuidado?
            </h1>
            <p className="mt-3 max-w-xl leading-relaxed text-white/75">
              Escolha uma clínica ou hospital para acessar os serviços,
              agendamentos e informações da unidade.
            </p>
          </div>
          <div className="relative mt-8 flex flex-wrap gap-5 text-sm text-white/80">
            <span className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              Especialistas perto de você
            </span>
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Campo Grande e região
            </span>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#18AFA0]">
                Unidades disponíveis
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">
                Encontre seu próximo atendimento
              </h2>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                aria-label="Buscar clínica, hospital ou especialidade"
                placeholder="Buscar unidade ou especialidade"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-11 border-slate-200 bg-white pl-10"
              />
            </div>
          </div>

          {filteredUnits.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {filteredUnits.map((unit) => (
                <Card
                  key={unit.id}
                  className="group flex h-full flex-col overflow-hidden border-0 shadow-[0_8px_30px_rgba(23,52,58,0.06)] transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(8,122,146,0.13)]"
                >
                  <CardContent className="flex h-full flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${unit.theme} text-sm font-bold text-white shadow-md`}
                        aria-hidden="true"
                      >
                        {unit.initials}
                      </div>
                      <Badge
                        variant="outline"
                        className="border-[#dff6e8] bg-[#f2fbf5] text-[#20864b]"
                      >
                        {unit.status}
                      </Badge>
                    </div>
                    <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-[#18AFA0]">
                      {unit.category}
                    </p>
                    <h3 className="mt-1 text-lg font-bold leading-snug">
                      {unit.name}
                    </h3>
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {unit.location}
                    </p>
                    <p className="mt-4 min-h-[3rem] text-sm leading-relaxed text-slate-500">
                      {unit.description}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {unit.specialties.map((specialty) => (
                        <span
                          key={specialty}
                          className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600"
                        >
                          {specialty}
                        </span>
                      ))}
                    </div>
                    <Button
                      onClick={() => onSelect(unit)}
                      className="mt-auto h-11 w-full bg-[#087A92] px-4 text-white transition-transform hover:scale-[1.03] hover:bg-[#076b80]"
                    >
                      Acessar unidade
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
              <Building2 className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 font-semibold">Nenhuma unidade encontrada</p>
              <p className="mt-1 text-sm text-slate-500">
                Tente buscar por outra unidade ou especialidade.
              </p>
            </div>
          )}
        </section>

        <p className="mt-10 text-center text-xs text-slate-400">
          Seus dados são protegidos e compartilhados somente com a unidade
          selecionada.
        </p>
      </main>
    </div>
  );
}
