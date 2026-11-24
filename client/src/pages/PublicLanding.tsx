import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/BrandLogo";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import type { Database } from "@/lib/database.types";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  HeartPulse,
  LoaderCircle,
  MapPin,
  Search,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Clinic = Pick<
  Database["public"]["Tables"]["clinics"]["Row"],
  "id" | "name" | "city" | "timezone"
>;
type BookingKind = "consultation" | "exam";
type Professional = Database["public"]["Tables"]["professionals"]["Row"];

const faq = [
  {
    question: "Como faço para agendar?",
    answer:
      "Escolha consulta ou exame, entre ou crie sua conta e siga as etapas do agendamento. As reservas são vinculadas ao seu perfil.",
  },
  {
    question: "Posso marcar para um familiar?",
    answer:
      "Sim. Cadastre o perfil do familiar na sua conta. Dependentes só podem ser selecionados quando a autorização necessária estiver registrada.",
  },
  {
    question: "Como vejo ou altero meus atendimentos?",
    answer:
      "Acesse Meus agendamentos para consultar suas reservas. Alterações dependem do status do atendimento e das regras da clínica.",
  },
  {
    question: "Meus dados de saúde ficam protegidos?",
    answer:
      "O acesso aos dados é controlado pela sua conta e pelas permissões do sistema. Compartilhe seus dados de acesso apenas com você.",
  },
];

export default function PublicLanding({
  onLogin,
  onRegister,
  onAppointments,
  onBook,
}: {
  onLogin: () => void;
  onRegister: () => void;
  onAppointments: () => void;
  onBook: (
    kind: BookingKind,
    professionalId?: string,
    clinicId?: string
  ) => void;
}) {
  const [search, setSearch] = useState("");
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [clinicsLoading, setClinicsLoading] = useState(isSupabaseConfigured);
  const [clinicsError, setClinicsError] = useState(false);
  const professionals = trpc.clinic.professionals.useQuery();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;

    void (async () => {
      try {
        const { data, error } = await supabase
          .from("clinics")
          .select("id, name, city, timezone")
          .order("name")
          .limit(6);
        if (!active) return;
        if (error) {
          console.error("[PublicLanding] Could not load clinics:", error);
          setClinicsError(true);
        } else {
          setClinics(data ?? []);
        }
      } catch (error) {
        if (!active) return;
        console.error("[PublicLanding] Could not load clinics:", error);
        setClinicsError(true);
      } finally {
        if (active) setClinicsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const clinicById = useMemo(
    () => new Map(clinics.map(clinic => [clinic.id, clinic])),
    [clinics]
  );
  const specialties = useMemo(
    () =>
      Array.from(
        new Set(
          (professionals.data ?? []).map(professional => professional.specialty)
        )
      )
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right, "pt-BR")),
    [professionals.data]
  );
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const matchingProfessionals = useMemo(() => {
    const results = (professionals.data ?? []).filter(professional => {
      const clinic = clinicById.get(professional.clinic_id);
      const searchable = [
        professional.display_name,
        professional.specialty,
        professional.crm,
        clinic?.name,
        clinic?.city,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      return !normalizedSearch || searchable.includes(normalizedSearch);
    });
    return results.slice(0, 3);
  }, [clinicById, normalizedSearch, professionals.data]);

  const matchingClinics = useMemo(() => {
    const results = clinics.filter(clinic => {
      const searchable =
        `${clinic.name} ${clinic.city ?? ""}`.toLocaleLowerCase("pt-BR");
      return !normalizedSearch || searchable.includes(normalizedSearch);
    });
    return results.slice(0, 4);
  }, [clinics, normalizedSearch]);

  return (
    <div className="min-h-screen bg-[#f7fbfb] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <a href="/" aria-label="GGL Saúde — início">
            <BrandLogo />
          </a>
          <nav
            aria-label="Navegação principal"
            className="hidden items-center gap-6 text-sm font-medium text-slate-600 lg:flex"
          >
            <a href="#especialidades" className="hover:text-[#087A92]">
              Especialidades
            </a>
            <a href="#unidades" className="hover:text-[#087A92]">
              Clínicas
            </a>
            <a href="#como-funciona" className="hover:text-[#087A92]">
              Como funciona
            </a>
            <a href="#duvidas" className="hover:text-[#087A92]">
              Dúvidas
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onAppointments}
              className="hidden sm:inline-flex"
            >
              Meus agendamentos
            </Button>
            <Button type="button" variant="outline" onClick={onLogin}>
              Entrar
            </Button>
            <Button
              type="button"
              onClick={onRegister}
              className="hidden bg-[#087A92] text-white hover:bg-[#076b80] sm:inline-flex"
            >
              Criar conta
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="overflow-hidden bg-gradient-to-br from-[#063f50] via-[#087A92] to-[#18AFA0] text-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="relative z-10">
              <Badge className="mb-6 border-white/20 bg-white/10 text-white hover:bg-white/10">
                Cuidado conectado, no seu ritmo
              </Badge>
              <h1 className="max-w-2xl text-4xl font-extrabold leading-tight tracking-[-0.04em] sm:text-6xl">
                Encontre cuidado de saúde com mais facilidade.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-white/80">
                Descubra profissionais e unidades, organize seus atendimentos e
                acompanhe sua jornada em um só lugar.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  onClick={() => onBook("consultation")}
                  className="h-12 bg-white px-5 font-semibold text-[#087A92] hover:bg-slate-100"
                >
                  <Stethoscope className="mr-2 h-4 w-4" />
                  Agendar consulta
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onBook("exam")}
                  className="h-12 border-white/50 bg-transparent px-5 font-semibold text-white hover:bg-white/10 hover:text-white"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Agendar exame
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/80">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> Conta protegida
                </span>
                <span className="flex items-center gap-2">
                  <HeartPulse className="h-4 w-4" /> Cuidado mais próximo
                </span>
              </div>
            </div>

            <Card className="relative border-0 bg-white text-slate-900 shadow-2xl">
              <CardContent className="space-y-5 p-6 sm:p-8">
                <div>
                  <p className="text-sm font-semibold text-[#18AFA0]">
                    Encontre atendimento
                  </p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight">
                    Por onde você quer começar?
                  </h2>
                </div>
                <label htmlFor="public-search" className="sr-only">
                  Buscar profissional, especialidade ou clínica
                </label>
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <Input
                    id="public-search"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Especialidade, profissional ou cidade"
                    className="h-12 pl-10"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => onBook("consultation")}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-left hover:border-[#18AFA0] hover:bg-[#18AFA0]/5"
                  >
                    <span className="rounded-lg bg-[#087A92]/10 p-2 text-[#087A92]">
                      <Stethoscope className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block font-semibold">Consultas</span>
                      <span className="text-xs text-slate-500">
                        Encontre um profissional
                      </span>
                    </span>
                    <ArrowRight className="ml-auto h-4 w-4 text-slate-400" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onBook("exam")}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-left hover:border-[#18AFA0] hover:bg-[#18AFA0]/5"
                  >
                    <span className="rounded-lg bg-[#18AFA0]/10 p-2 text-[#087A92]">
                      <FileText className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block font-semibold">Exames</span>
                      <span className="text-xs text-slate-500">
                        Consulte unidades disponíveis
                      </span>
                    </span>
                    <ArrowRight className="ml-auto h-4 w-4 text-slate-400" />
                  </button>
                </div>
                <p className="text-xs leading-5 text-slate-500">
                  Os serviços e locais exibidos dependem do cadastro e da
                  disponibilidade de cada clínica.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section
          id="especialidades"
          className="mx-auto max-w-7xl scroll-mt-24 px-5 py-16 sm:px-8"
        >
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold text-[#18AFA0]">
                Explore cuidados
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                Encontre sua especialidade
              </h2>
              <p className="mt-2 text-slate-500">
                Opções exibidas conforme os profissionais cadastrados.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => onBook("consultation")}
            >
              Ver profissionais <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          {professionals.isLoading ? (
            <p
              className="mt-6 flex items-center gap-2 text-sm text-slate-500"
              role="status"
            >
              <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando
              especialidades…
            </p>
          ) : professionals.isError ? (
            <p
              className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800"
              role="alert"
            >
              Não foi possível carregar as especialidades. Tente novamente mais
              tarde.
            </p>
          ) : specialties.length ? (
            <div className="mt-6 flex flex-wrap gap-3">
              {specialties.map(specialty => (
                <button
                  key={specialty}
                  type="button"
                  onClick={() => {
                    setSearch(specialty);
                    document
                      .getElementById("busca")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-[#18AFA0] hover:text-[#087A92]"
                >
                  {specialty}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-6 rounded-xl bg-white p-5 text-sm text-slate-500">
              As especialidades aparecerão aqui quando os profissionais forem
              cadastrados.
            </p>
          )}
        </section>

        <section
          id="busca"
          className="mx-auto max-w-7xl scroll-mt-24 px-5 pb-16 sm:px-8"
        >
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                {normalizedSearch
                  ? `Resultados para “${search.trim()}”`
                  : "Profissionais em destaque"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Informações carregadas do catálogo do GL Saúde.
              </p>
            </div>
            {normalizedSearch && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSearch("")}
              >
                Limpar busca
              </Button>
            )}
          </div>
          {professionals.isLoading ? (
            <p className="text-sm text-slate-500">Carregando profissionais…</p>
          ) : professionals.isError ? (
            <p
              className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
              role="alert"
            >
              Não foi possível pesquisar profissionais. Atualize a página ou
              tente novamente mais tarde.
            </p>
          ) : matchingProfessionals.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {matchingProfessionals.map((professional: Professional) => (
                <Card key={professional.id} className="border-0 shadow-sm">
                  <CardContent className="flex h-full flex-col p-5">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-[#087A92]/10 p-3 text-[#087A92]">
                        <Stethoscope className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold">
                          {professional.display_name}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {professional.specialty}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-slate-500">
                      {clinicById.get(professional.clinic_id) && (
                        <p className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 shrink-0" />
                          {clinicById.get(professional.clinic_id)?.name}
                        </p>
                      )}
                      {clinicById.get(professional.clinic_id)?.city && (
                        <p className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 shrink-0" />
                          {clinicById.get(professional.clinic_id)?.city}
                        </p>
                      )}
                      <p>
                        Consulta particular: R${" "}
                        {professional.consultation_price
                          .toFixed(2)
                          .replace(".", ",")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() =>
                        onBook(
                          "consultation",
                          professional.id,
                          professional.clinic_id
                        )
                      }
                      className="mt-5 w-full bg-[#087A92] text-white hover:bg-[#076b80]"
                    >
                      Agendar com este profissional{" "}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-white p-5 text-sm text-slate-500">
              {normalizedSearch
                ? "Nenhum profissional corresponde à busca. Experimente outro nome, especialidade ou cidade."
                : "Nenhum profissional está disponível no catálogo neste momento."}
            </p>
          )}
        </section>

        <section id="unidades" className="scroll-mt-24 bg-white py-16">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-[#18AFA0]">
                Rede de atendimento
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                Clínicas e unidades
              </h2>
              <p className="mt-2 text-slate-500">
                Consulte os locais cadastrados na plataforma.
              </p>
            </div>
            {clinicsLoading ? (
              <p
                className="mt-6 flex items-center gap-2 text-sm text-slate-500"
                role="status"
              >
                <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando
                unidades…
              </p>
            ) : clinicsError ? (
              <p
                className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700"
                role="alert"
              >
                Não foi possível carregar as unidades. Tente novamente mais
                tarde.
              </p>
            ) : matchingClinics.length ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {matchingClinics.map(clinic => (
                  <Card
                    key={clinic.id}
                    className="border border-slate-100 shadow-none"
                  >
                    <CardContent className="p-5">
                      <Building2 className="h-5 w-5 text-[#087A92]" />
                      <h3 className="mt-4 font-bold">{clinic.name}</h3>
                      <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                        <MapPin className="h-4 w-4 shrink-0" />{" "}
                        {clinic.city || "Localização não informada"}
                      </p>
                      <Button
                        type="button"
                        variant="link"
                        onClick={() =>
                          onBook("consultation", undefined, clinic.id)
                        }
                        className="mt-3 h-auto p-0 text-[#087A92]"
                      >
                        Explorar profissionais{" "}
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="mt-6 rounded-xl bg-[#f7fbfb] p-5 text-sm text-slate-500">
                {normalizedSearch
                  ? "Nenhuma clínica corresponde à busca informada."
                  : "As clínicas serão exibidas aqui assim que forem cadastradas no GL Saúde."}
              </p>
            )}
          </div>
        </section>

        <section
          id="como-funciona"
          className="mx-auto max-w-7xl scroll-mt-24 px-5 py-16 sm:px-8"
        >
          <div className="text-center">
            <p className="text-sm font-semibold text-[#18AFA0]">
              Simples do começo ao fim
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              Como funciona
            </h2>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {[
              {
                number: "01",
                icon: Search,
                title: "Encontre",
                text: "Pesquise profissionais e unidades cadastrados na plataforma.",
              },
              {
                number: "02",
                icon: CalendarDays,
                title: "Escolha",
                text: "Entre na sua conta para selecionar o paciente e informar a data desejada.",
              },
              {
                number: "03",
                icon: CheckCircle2,
                title: "Acompanhe",
                text: "Consulte o status da reserva e seus próximos atendimentos no painel.",
              },
            ].map(item => (
              <Card key={item.number} className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#18AFA0]">
                      {item.number}
                    </span>
                    <item.icon className="h-5 w-5 text-[#087A92]" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {item.text}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="bg-[#eaf7f5] py-14">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 md:grid-cols-3">
            {[
              {
                icon: Clock3,
                title: "Sua rotina em ordem",
                text: "Acompanhe reservas e horários em uma área dedicada.",
              },
              {
                icon: ShieldCheck,
                title: "Acesso responsável",
                text: "Perfis e permissões ajudam a proteger informações pessoais.",
              },
              {
                icon: HeartPulse,
                title: "Cuidado conectado",
                text: "Profissionais e pacientes compartilham uma jornada mais organizada.",
              },
            ].map(item => (
              <div key={item.title} className="flex gap-4">
                <div className="h-fit rounded-xl bg-white p-3 text-[#087A92]">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {item.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          id="duvidas"
          className="mx-auto max-w-4xl scroll-mt-24 px-5 py-16 sm:px-8"
        >
          <div className="text-center">
            <p className="text-sm font-semibold text-[#18AFA0]">
              Estamos aqui para ajudar
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              Perguntas frequentes
            </h2>
          </div>
          <div className="mt-7 divide-y divide-slate-200 rounded-2xl bg-white px-5">
            {faq.map(item => (
              <details key={item.question} className="group py-4">
                <summary className="cursor-pointer list-none pr-6 font-semibold marker:hidden">
                  {item.question}
                </summary>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer id="contato" className="bg-[#073f4c] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 md:grid-cols-3">
          <div>
            <BrandLogo className="[&_div]:text-white" />
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/65">
              Plataforma para conectar pessoas, profissionais e serviços de
              saúde.
            </p>
          </div>
          <div>
            <h2 className="font-bold">Acesso rápido</h2>
            <div className="mt-3 flex flex-col items-start gap-2 text-sm text-white/70">
              <button
                type="button"
                onClick={onAppointments}
                className="hover:text-white"
              >
                Meus agendamentos
              </button>
              <button
                type="button"
                onClick={() => onBook("consultation")}
                className="hover:text-white"
              >
                Agendar consulta
              </button>
              <button
                type="button"
                onClick={() => onBook("exam")}
                className="hover:text-white"
              >
                Agendar exame
              </button>
            </div>
          </div>
          <div>
            <h2 className="font-bold">Informações</h2>
            <div className="mt-3 flex flex-col items-start gap-2 text-sm text-white/70">
              {import.meta.env.VITE_TERMS_URL ? (
                <a
                  href={import.meta.env.VITE_TERMS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white"
                >
                  Termos de uso
                </a>
              ) : (
                <span>Termos de uso: consulte a clínica responsável</span>
              )}
              {import.meta.env.VITE_PRIVACY_URL ? (
                <a
                  href={import.meta.env.VITE_PRIVACY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white"
                >
                  Política de privacidade
                </a>
              ) : (
                <span>Privacidade: consulte a clínica responsável</span>
              )}
              {import.meta.env.VITE_SUPPORT_EMAIL ? (
                <a
                  href={`mailto:${import.meta.env.VITE_SUPPORT_EMAIL}`}
                  className="hover:text-white"
                >
                  {import.meta.env.VITE_SUPPORT_EMAIL}
                </a>
              ) : (
                <span>
                  Contato: consulte a clínica responsável pelo atendimento
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 px-5 py-4 text-center text-xs text-white/50">
          © {new Date().getFullYear()} GGL Saúde. Cuidado conectado.
        </div>
      </footer>
    </div>
  );
}
