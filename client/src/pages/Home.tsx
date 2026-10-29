import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import AppointmentBooking from "@/components/AppointmentBooking";
import OverviewDashboard from "@/components/OverviewDashboard";
import PatientAppointments from "@/components/PatientAppointments";
import PatientProfilesManager from "@/components/PatientProfilesManager";
import AdultAuthorizationReview from "@/components/AdultAuthorizationReview";
import SupabaseLogin from "@/components/SupabaseLogin";
import { trpc } from "@/lib/trpc";
import { ProfileNavigation, ProfilePage } from "@/components/ProfilePages";
import type { ProfileSection } from "@/components/ProfilePages";
import { clearAuthState } from "@shared/authFlow";
import { CURRENT_CONSENT_VERSION } from "@shared/registration";
import { BrandLogo } from "@/components/BrandLogo";
import ClinicHub, { healthcareUnits, type HealthcareUnit } from "@/pages/ClinicHub";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Bell, Building2, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, FileText, HeartPulse, LayoutDashboard, LoaderCircle, LogOut, Mail, Menu, Search, ShieldCheck, Stethoscope, UserRound, Users, WalletCards, X } from "lucide-react";

type Role = "patient" | "doctor" | "operator";
const roleLabels: Record<Role, string> = { patient: "Usuário comum / Paciente", doctor: "Médico", operator: "Operador" };

const appointments = [
  { id: 1, day: "18", month: "JUN", title: "Consulta cardiológica", professional: "Dra. Camila Ribeiro", time: "09:30", status: "Confirmada", color: "bg-teal-50 text-[#087A92]" },
  { id: 2, day: "22", month: "JUN", title: "Exame de imagem", professional: "Centro Diagnóstico Vida", time: "14:00", status: "Pagamento pendente", color: "bg-amber-50 text-amber-700" },
];

const doctors = [
  { name: "Dra. Camila Ribeiro", specialty: "Cardiologia", crm: "CRM-MS 12458", rating: "4,9", price: "R$ 280,00", initials: "CR", accent: "from-[#087A92] to-[#18AFA0]" },
  { name: "Dr. Lucas Andrade", specialty: "Clínica geral", crm: "CRM-MS 15882", rating: "4,8", price: "R$ 180,00", initials: "LA", accent: "from-[#18AFA0] to-[#4CCB73]" },
  { name: "Dra. Marina Costa", specialty: "Dermatologia", crm: "CRM-MS 13904", rating: "4,9", price: "R$ 240,00", initials: "MC", accent: "from-[#087A92] to-[#4CCB73]" },
];

function LegacyDemoLogin({ onEnter }: { onEnter: (role: Role) => void }) {
  const [attempts, setAttempts] = useState(0);
  const locked = attempts >= 3;
  return <div className="min-h-screen bg-[#f7fbfb] text-slate-900">
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#087A92] p-12 text-white lg:flex lg:flex-col lg:justify-between lg:[clip-path:polygon(0_0,100%_0,94%_100%,0_100%)]">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#18AFA0]/40 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-[#4CCB73]/30 blur-3xl" />
        <svg
          aria-hidden="true"
          viewBox="0 0 440 500"
          fill="none"
          className="pointer-events-none absolute right-[3%] top-[20%] h-[58%] w-[42%] text-white/[0.12]"
        >
          <circle cx="238" cy="250" r="172" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="238" cy="250" r="132" stroke="currentColor" strokeWidth="1" />
          <path
            d="M238 355c-21-19-99-81-99-143 0-48 59-67 99-21 40-46 99-27 99 21 0 62-78 124-99 143Z"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            d="M72 250h66l27-45 38 92 32-64 23 37h108"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="368" cy="118" r="9" fill="currentColor" />
          <circle cx="99" cy="364" r="6" fill="currentColor" />
        </svg>
        <BrandLogo className="relative brightness-0 invert" />
        <div className="relative max-w-xl pb-8">
          <Badge className="mb-7 border-white/20 bg-white/10 text-white hover:bg-white/10">Cuidado conectado, de um jeito mais simples</Badge>
          <h1 className="max-w-lg text-5xl font-bold leading-[1.06] tracking-[-0.04em]">A saúde que acompanha o seu ritmo.</h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-white/75">Agende consultas e exames, acompanhe seu cuidado e tenha tudo organizado em um só lugar.</p>
          <div className="mt-10 flex items-center gap-6 text-sm text-white/80"><span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Dados protegidos</span><span className="flex items-center gap-2"><HeartPulse className="h-4 w-4" /> Cuidado humano</span></div>
          <div className="mt-9 grid max-w-lg grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-4 backdrop-blur-sm">
              <p className="text-xl font-bold tracking-tight">Mais perto</p>
              <p className="mt-1 text-xs leading-relaxed text-white/65">Unidades e especialistas em um só lugar</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-4 backdrop-blur-sm">
              <p className="text-xl font-bold tracking-tight">Sempre com você</p>
              <p className="mt-1 text-xs leading-relaxed text-white/65">Uma jornada de cuidado simples e segura</p>
            </div>
          </div>
        </div>
        <p className="relative text-xs text-white/50">GGL saude · Gestão inteligente para clínicas e pacientes</p>
      </section>
      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden"><BrandLogo /></div>
          <div className="mb-8"><p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#18AFA0]">Bem-vindo à GGL saude</p><h2 className="text-3xl font-bold tracking-tight">Acesse sua conta</h2><p className="mt-2 text-slate-500">Entre para cuidar do que realmente importa.</p></div>
          <Card className="border-0 bg-white shadow-[0_20px_60px_rgba(8,122,146,0.10)]"><CardContent className="space-y-5 p-7">
            <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" placeholder="voce@exemplo.com" disabled={locked} /></div>
            <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="password">Senha</Label><Link href="/recuperar-senha" className="text-xs font-semibold text-[#087A92] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087A92] focus-visible:ring-offset-2">Esqueci minha senha</Link></div><Input id="password" type="password" placeholder="••••••••" disabled={locked} /></div>
            {locked && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Conta temporariamente bloqueada após 3 tentativas. Tente novamente em 15 minutos.</div>}
            <Button type="button" className="h-12 w-full bg-[#087A92] text-base text-white hover:bg-[#076b80]" disabled={locked} onClick={() => { localStorage.setItem("GGL saude-role", "patient"); onEnter("patient"); }}>Entrar</Button>
            <p className="text-center text-xs text-slate-400">Ambiente seguro com autenticação protegida</p>
            <Button
              type="button"
              variant="outline"
              onClick={startLogin}
              className="h-12 w-full border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 48 48"
                className="mr-2 h-5 w-5"
              >
                <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z" />
                <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2C9.2 39.5 16.1 44 24 44Z" />
                <path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.2H5.8a20 20 0 0 0 0 17.6l6.8-5.2Z" />
                <path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6 29.5 4 24 4 16.1 4 9.2 8.5 5.8 15.2l6.8 5.2C14.2 15.6 18.7 12 24 12Z" />
              </svg>
              Continuar com Google
            </Button>
          </CardContent></Card>
          <p className="mt-7 text-center text-sm text-slate-500">Ainda não possui uma conta? <button onClick={() => toast.info("O cadastro estará disponível após a configuração do banco de dados.")} className="font-semibold text-[#087A92]">Cadastre-se</button></p>
        </div>
      </section>
    </div>
  </div>;
}

export const Login = SupabaseLogin;

function Shell({
  role,
  userName,
  onExit,
  onChangeUnit,
  selectedUnit,
  isAdmin,
  children,
  active,
  setActive,
}: {
  role: Role;
  userName: string;
  onExit: () => void | Promise<void>;
  onChangeUnit: () => void;
  selectedUnit: HealthcareUnit | null;
  isAdmin: boolean;
  children: React.ReactNode;
  active: string;
  setActive: (value: string) => void;
}) {
  const nav =
    role === "patient"
      ? [
          { id: "overview", label: "Visão geral", icon: LayoutDashboard },
          { id: "schedule", label: "Novo agendamento", icon: CalendarDays },
          { id: "history", label: "Meus agendamentos", icon: Clock3 },
          { id: "dependents", label: "Pacientes e dependentes", icon: Users },
        ]
      : role === "doctor"
        ? [
            { id: "overview", label: "Visão geral", icon: LayoutDashboard },
            { id: "agenda", label: "Minha agenda", icon: CalendarDays },
            { id: "patients", label: "Pacientes", icon: Users },
          ]
        : [
            { id: "overview", label: "Visão geral", icon: LayoutDashboard },
            { id: "agenda", label: "Agenda da clínica", icon: CalendarDays },
            { id: "schedule", label: "Novo agendamento", icon: UserRound },
            { id: "reports", label: "Relatórios", icon: FileText },
            ...(isAdmin
              ? [{ id: "adult-authorizations", label: "Autorizações", icon: ShieldCheck }]
              : []),
          ];
  const initials = userName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "U";
  const greetingName = userName.trim().split(/\s+/)[0] || "Usuário";

  return (
    <div className="min-h-screen bg-[#f7fbfb] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-100 bg-white lg:flex lg:flex-col">
        <div className="flex h-20 items-center border-b border-slate-100 px-7">
          <BrandLogo compact={false} />
        </div>
        <div className="px-4 py-6">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Menu principal
          </p>
          <nav className="space-y-1">
            {nav.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition-all ${
                  active === item.id
                    ? "bg-[#087A92]/10 font-semibold text-[#087A92]"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <item.icon className="h-[18px] w-[18px]" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto border-t border-slate-100 p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#087A92] to-[#4CCB73] text-xs font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{userName}</p>
              <p className="text-xs text-slate-400">{roleLabels[role]}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onChangeUnit}
            className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#087A92] hover:bg-[#e7f7f5]"
          >
            <Building2 className="h-4 w-4" />
            Trocar unidade
          </button>
          <button
            type="button"
            onClick={onExit}
            className="flex w-full items-center gap-3 px-3 py-2 text-sm text-slate-500 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </button>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-100 bg-white/90 px-5 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <Menu className="h-5 w-5 text-slate-500" />
            <BrandLogo compact />
          </div>
          <div className="hidden lg:block">
            <p className="text-sm text-slate-400">
              {selectedUnit?.name ??
                (role === "doctor"
                  ? "Painel médico"
                  : role === "operator"
                    ? "Operação da clínica"
                    : "Área do paciente")}
            </p>
            <h1 className="text-lg font-bold">Olá, {greetingName}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-xl px-3 py-2 text-sm font-semibold text-[#087A92] hover:bg-[#e7f7f5] lg:hidden"
              onClick={onChangeUnit}
            >
              Trocar unidade
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#087A92]/10 text-sm font-bold text-[#087A92]">
              {initials}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}

function Overview({ role, go }: { role: Role; go: (id: string) => void }) {
  const isPatient = role === "patient";
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(2026, 5, 1));
  const [selectedDay, setSelectedDay] = useState(17);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(calendarMonth);
  const monthDays = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() + 1,
    0,
  ).getDate();
  const firstWeekday = (new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth(),
    1,
  ).getDay() + 6) % 7;
  const calendarCells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: monthDays }, (_, index) => index + 1),
  ];
  const appointmentDays =
    calendarMonth.getFullYear() === 2026 && calendarMonth.getMonth() === 5
      ? appointments.map((item) => Number(item.day))
      : [];
  const stats = isPatient
    ? [
        {
          label: "Próxima consulta",
          value: "18 jun",
          hint: "Dra. Camila · 09:30",
          icon: CalendarDays,
          tint: "bg-[#087A92]/10 text-[#087A92]",
        },
        {
          label: "Consultas realizadas",
          value: "12",
          hint: "+2 este semestre",
          icon: Check,
          tint: "bg-[#4CCB73]/15 text-[#20864b]",
        },
        {
          label: "Pagamentos",
          value: "R$ 280",
          hint: "Próximo pagamento",
          icon: WalletCards,
          tint: "bg-amber-50 text-amber-600",
        },
      ]
    : role === "doctor"
      ? [
          {
            label: "Consultas hoje",
            value: "08",
            hint: "2 aguardando confirmação",
            icon: CalendarDays,
            tint: "bg-[#087A92]/10 text-[#087A92]",
          },
          {
            label: "Pacientes ativos",
            value: "124",
            hint: "+8 neste mês",
            icon: Users,
            tint: "bg-[#4CCB73]/15 text-[#20864b]",
          },
          {
            label: "Taxa de presença",
            value: "94%",
            hint: "+6% vs. mês anterior",
            icon: Check,
            tint: "bg-violet-50 text-violet-600",
          },
          {
            label: "Receita mensal",
            value: "R$ 18,4k",
            hint: "Até o momento",
            icon: WalletCards,
            tint: "bg-amber-50 text-amber-600",
          },
        ]
      : [
          {
            label: "Agendamentos hoje",
            value: "32",
            hint: "6 novos desde ontem",
            icon: CalendarDays,
            tint: "bg-[#087A92]/10 text-[#087A92]",
          },
          {
            label: "Ocupação da agenda",
            value: "86%",
            hint: "Nesta semana",
            icon: Users,
            tint: "bg-[#4CCB73]/15 text-[#20864b]",
          },
          {
            label: "Aguardando confirmação",
            value: "06",
            hint: "Requer atenção",
            icon: Clock3,
            tint: "bg-amber-50 text-amber-600",
          },
          {
            label: "Cancelamentos",
            value: "02",
            hint: "Hoje",
            icon: X,
            tint: "bg-red-50 text-red-600",
          },
        ];

  const changeMonth = (amount: number) => {
    setCalendarMonth(
      (month) => new Date(month.getFullYear(), month.getMonth() + amount, 1),
    );
    setSelectedDay(1);
  };

  const dashboardHeader = (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="mb-2 text-sm font-medium text-[#18AFA0]">
          {isPatient ? "Quarta-feira, 17 de junho de 2026" : "Resumo operacional"}
        </p>
        <h2 className="text-3xl font-bold tracking-[-0.03em]">
          {isPatient
            ? "Seu cuidado em dia."
            : role === "doctor"
              ? "Sua agenda, sob controle."
              : "A clínica em movimento."}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          {isPatient
            ? "Acompanhe seus próximos passos e cuide do seu tempo."
            : "Veja os principais indicadores de hoje."}
        </p>
      </div>
      {isPatient && (
        <Button
          onClick={() => go("schedule")}
          className="h-10 shrink-0 bg-[#087A92] text-white hover:bg-[#076b80]"
        >
          <CalendarDays className="mr-2 h-4 w-4" />
          Novo agendamento
        </Button>
      )}
    </div>
  );

  const statsGrid = (
    <div
      className={`grid gap-4 ${isPatient ? "sm:grid-cols-3" : "sm:grid-cols-2 2xl:grid-cols-4"}`}
    >
      {stats.map((item) => (
        <Card
          key={item.label}
          className="rounded-xl border-0 bg-white shadow-[0_1px_4px_rgba(15,23,42,0.05)]"
        >
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">{item.label}</p>
              <p className="mt-1.5 text-2xl font-bold leading-none">{item.value}</p>
              <p className="mt-2 truncate text-xs text-slate-400">{item.hint}</p>
            </div>
            <div className={`shrink-0 rounded-full p-2.5 ${item.tint}`}>
              <item.icon className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const appointmentsCard = (
    <Card className="flex min-h-[260px] flex-1 flex-col rounded-xl border-0 bg-white shadow-[0_1px_4px_rgba(15,23,42,0.05)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-5 pb-3 pt-5">
        <div>
          <CardTitle className="text-base">
            {isPatient ? "Próximos cuidados" : "Agenda de hoje"}
          </CardTitle>
          <p className="mt-1 text-xs text-slate-500">
            {isPatient ? "Seus próximos compromissos de saúde" : "Resumo dos atendimentos"}
          </p>
        </div>
        {isPatient && (
          <button
            type="button"
            onClick={() => go("history")}
            className="text-xs font-semibold text-[#087A92] hover:underline"
          >
            Ver todos
          </button>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2 px-5 pb-5">
        {appointments.slice(0, isPatient ? 2 : 1).map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center gap-3 rounded-xl bg-[#f8faf9] p-3 sm:flex-nowrap"
          >
            <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-[#e7f7f5] text-[#087A92]">
              <span className="text-sm font-bold leading-none">{item.day}</span>
              <span className="mt-1 text-[9px] font-bold">{item.month}</span>
            </div>
            <div className="min-w-[130px] flex-1">
              <p className="truncate text-sm font-semibold">{item.title}</p>
              <p className="mt-1 truncate text-xs text-slate-500">
                {item.professional} · {item.time}
              </p>
            </div>
            <div className="ml-auto flex w-full items-center justify-end gap-2 sm:w-auto">
              <Badge
                variant="outline"
                className={`whitespace-nowrap border-0 text-[10px] ${item.color}`}
              >
                {item.status}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-[#087A92]"
                onClick={() => toast.info("Detalhes do agendamento")}
              >
                Detalhes
              </Button>
            </div>
          </div>
        ))}
        <div className="mt-auto flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-[#087A92]" />
          Seus compromissos estão organizados em um só lugar.
        </div>
      </CardContent>
    </Card>
  );

  if (!isPatient) {
    return (
      <div className="space-y-5">
        {dashboardHeader}
        {statsGrid}
        {appointmentsCard}
      </div>
    );
  }

  return (
    <div className="grid items-stretch gap-5 min-[1200px]:min-h-[calc(100vh-8rem)] min-[1200px]:grid-cols-[minmax(0,2.2fr)_minmax(280px,0.9fr)]">
      <section className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => go("profile")}
            className="h-9 rounded-lg border-slate-200 bg-white px-3 text-xs text-slate-600 hover:border-[#087A92]/30 hover:bg-[#e7f7f5] hover:text-[#087A92]"
          >
            <UserRound className="mr-1.5 h-4 w-4" />
            Perfil
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => go("my-data")}
            className="h-9 rounded-lg border-slate-200 bg-white px-3 text-xs text-slate-600 hover:border-[#087A92]/30 hover:bg-[#e7f7f5] hover:text-[#087A92]"
          >
            <FileText className="mr-1.5 h-4 w-4" />
            Meus dados
          </Button>
        </div>
        {dashboardHeader}
        {statsGrid}
        {appointmentsCard}
      </section>

      <aside className="flex min-w-0 flex-col gap-4 min-[1200px]:sticky min-[1200px]:top-24">
        <Card className="rounded-xl border-0 bg-white shadow-[0_1px_4px_rgba(15,23,42,0.05)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-5 pb-3 pt-5">
            <div>
              <CardTitle className="text-base">Calendário rápido</CardTitle>
              <p className="mt-1 text-xs capitalize text-slate-500">{monthLabel}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Mês anterior"
                onClick={() => changeMonth(-1)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Próximo mês"
                onClick={() => changeMonth(1)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="mb-2 grid grid-cols-7 text-center text-[10px] font-semibold uppercase text-slate-400">
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => (
                <span key={day} className="py-1">{day}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1 text-center">
              {calendarCells.map((day, index) =>
                day === null ? (
                  <span key={`empty-${index}`} aria-hidden="true" />
                ) : (
                  <button
                    key={day}
                    type="button"
                    aria-label={`${day} de ${monthLabel}`}
                    aria-pressed={selectedDay === day}
                    onClick={() => setSelectedDay(day)}
                    className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs transition-colors ${
                      selectedDay === day
                        ? "bg-[#087A92] font-semibold text-white"
                        : "text-slate-600 hover:bg-[#e7f7f5] hover:text-[#087A92]"
                    }`}
                  >
                    {day}
                    {appointmentDays.includes(day) && (
                      <span
                        className={`absolute bottom-0.5 h-1 w-1 rounded-full ${
                          selectedDay === day ? "bg-white" : "bg-[#18AFA0]"
                        }`}
                      />
                    )}
                  </button>
                ),
              )}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#f4f7f6] px-3 py-2 text-xs text-slate-500">
              <span className="h-2 w-2 rounded-full bg-[#18AFA0]" />
              {appointmentDays.includes(selectedDay)
                ? `Você tem um cuidado agendado para ${selectedDay} de ${monthLabel}.`
                : `Nenhum agendamento em ${selectedDay} de ${monthLabel}.`}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-0 bg-white shadow-[0_1px_4px_rgba(15,23,42,0.05)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-5 pb-3 pt-5">
            <CardTitle className="text-base">Notificações recentes</CardTitle>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e7f7f5] text-[#087A92]">
              <Bell className="h-3.5 w-3.5" />
            </span>
          </CardHeader>
          <CardContent className="space-y-3 px-5 pb-5">
            <div className="flex gap-3">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#18AFA0]" />
              <div>
                <p className="text-xs font-semibold text-slate-700">Consulta confirmada</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Dra. Camila Ribeiro · 18 jun, às 09:30
                </p>
                <p className="mt-1 text-[10px] text-slate-400">Hoje, 09:14</p>
              </div>
            </div>
            <div className="border-t border-slate-100 pt-3">
              <div className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                <div>
                  <p className="text-xs font-semibold text-slate-700">Pagamento pendente</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    Exame de imagem · vence em 22 jun
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">Ontem, 16:42</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function Booking({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(1); const [type, setType] = useState("Consulta médica"); const [selected, setSelected] = useState(doctors[0].name); const [method, setMethod] = useState("Pix");
  const steps = ["Tipo", "Profissional", "Horário", "Pagamento"];
  return <div className="mx-auto max-w-4xl space-y-7"><div><button className="mb-4 text-sm font-semibold text-[#087A92]" onClick={onDone}>Voltar ao painel</button><h2 className="text-3xl font-bold tracking-tight">Novo agendamento</h2><p className="mt-2 text-slate-500">Escolha o melhor momento para cuidar de você.</p></div><div className="flex items-center gap-2 overflow-x-auto pb-2">{steps.map((name, index) => <div key={name} className="flex min-w-fit items-center gap-2"><div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${step > index + 1 ? "bg-[#4CCB73] text-white" : step === index + 1 ? "bg-[#087A92] text-white" : "bg-slate-100 text-slate-400"}`}>{step > index + 1 ? <Check className="h-4 w-4" /> : index + 1}</div><span className={`text-sm ${step === index + 1 ? "font-bold text-[#087A92]" : "text-slate-400"}`}>{name}</span>{index < 3 && <div className="mx-2 h-px w-8 bg-slate-200 sm:w-16" />}</div>)}</div><Card className="border-0 shadow-sm"><CardContent className="p-6 sm:p-9">{step === 1 && <div className="space-y-6"><div><h3 className="text-xl font-bold">O que você precisa?</h3><p className="mt-1 text-sm text-slate-500">Selecione uma opção para começar.</p></div><div className="grid gap-4 sm:grid-cols-2">{["Consulta médica", "Exame laboratorial"].map((item) => <button key={item} onClick={() => setType(item)} className={`rounded-2xl border-2 p-6 text-left transition ${type === item ? "border-[#18AFA0] bg-[#18AFA0]/5" : "border-slate-100 hover:border-[#18AFA0]/40"}`}><div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${type === item ? "bg-[#087A92] text-white" : "bg-slate-100 text-slate-500"}`}>{item.startsWith("Consulta") ? <Stethoscope className="h-6 w-6" /> : <FileText className="h-6 w-6" />}</div><p className="font-bold">{item}</p><p className="mt-1 text-sm text-slate-500">{item.startsWith("Consulta") ? "Encontre o especialista ideal para você." : "Laboratoriais e exames de imagem."}</p></button>)}</div><Button onClick={() => setStep(2)} className="h-11 w-full bg-[#087A92] text-white hover:bg-[#076b80]">Continuar</Button></div>}{step === 2 && <div className="space-y-6"><div><h3 className="text-xl font-bold">Encontre seu profissional</h3><p className="mt-1 text-sm text-slate-500">Filtre por especialidade, nome ou localização.</p></div><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Buscar por nome ou especialidade" /></div><div className="space-y-3">{doctors.map((doctor) => <button key={doctor.name} onClick={() => setSelected(doctor.name)} className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${selected === doctor.name ? "border-[#18AFA0] bg-[#18AFA0]/5" : "border-slate-100 hover:border-[#18AFA0]/40"}`}><div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${doctor.accent} text-sm font-bold text-white`}>{doctor.initials}</div><div className="min-w-0 flex-1"><p className="font-bold">{doctor.name}</p><p className="text-sm text-slate-500">{doctor.specialty} · {doctor.crm}</p><p className="mt-1 text-xs text-amber-600">★ {doctor.rating} <span className="text-slate-400">· {doctor.price}</span></p></div>{selected === doctor.name && <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#4CCB73] text-white"><Check className="h-4 w-4" /></div>}</button>)}</div><Button onClick={() => setStep(3)} className="h-11 w-full bg-[#087A92] text-white hover:bg-[#076b80]">Escolher horário</Button></div>}{step === 3 && <div className="space-y-6"><div><h3 className="text-xl font-bold">Escolha o melhor horário</h3><p className="mt-1 text-sm text-slate-500">O horário fica reservado por 10 minutos.</p></div><div className="rounded-2xl border border-[#18AFA0]/20 bg-[#18AFA0]/5 p-4 text-sm text-[#087A92]"><Clock3 className="mr-2 inline h-4 w-4" /> Você terá 10:00 minutos para concluir a confirmação.</div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{["18 jun · 09:30", "18 jun · 11:00", "19 jun · 14:00", "20 jun · 08:30", "20 jun · 10:00", "21 jun · 15:30", "23 jun · 09:00", "23 jun · 16:00"].map((time) => <button key={time} onClick={() => setSelected(time)} className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${selected === time ? "border-[#087A92] bg-[#087A92] text-white" : "border-slate-100 hover:border-[#18AFA0]"}`}>{time}</button>)}</div><Button onClick={() => setStep(4)} className="h-11 w-full bg-[#087A92] text-white hover:bg-[#076b80]">Revisar agendamento</Button></div>}{step === 4 && <div className="space-y-6"><div><h3 className="text-xl font-bold">Confirme e pague</h3><p className="mt-1 text-sm text-slate-500">O agendamento será confirmado após o pagamento.</p></div><div className="rounded-2xl bg-slate-50 p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">{type}</p><p className="mt-1 font-bold">{selected === doctors[0].name ? doctors[0].name : selected}</p></div><Badge className="bg-[#4CCB73] text-white">R$ 280,00</Badge></div><div className="mt-5 grid gap-3 border-t border-slate-200 pt-4 text-sm sm:grid-cols-2"><span><strong>Data e hora</strong><br /><span className="text-slate-500">18 de junho, 09:30</span></span><span><strong>Local</strong><br /><span className="text-slate-500">Clínica saude · Sala 02</span></span></div></div><div><p className="mb-3 text-sm font-bold">Forma de pagamento</p><div className="grid grid-cols-3 gap-3"><button onClick={() => setMethod("Pix")} className={`rounded-xl border-2 p-4 text-left ${method === "Pix" ? "border-[#18AFA0] bg-[#18AFA0]/5" : "border-slate-100"}`}><p className="font-bold">Pix</p><p className="mt-1 text-xs text-slate-500">Aprovação imediata</p></button><button onClick={() => setMethod("Cartão de crédito")} className={`rounded-xl border-2 p-4 text-left ${method === "Cartão de crédito" ? "border-[#18AFA0] bg-[#18AFA0]/5" : "border-slate-100"}`}><p className="font-bold">Cartão de crédito</p><p className="mt-1 text-xs text-slate-500">Até 6x sem juros</p></button><button onClick={() => setMethod("Pagar presencialmente")} className={`rounded-xl border-2 p-4 text-left ${method === "Pagar presencialmente" ? "border-[#18AFA0] bg-[#18AFA0]/5" : "border-slate-100"}`}><p className="font-bold">Pagar presencialmente</p><p className="mt-1 text-xs text-slate-500">Pagamento no local</p></button></div></div><Button onClick={() => { if (method === "Pagar presencialmente") { toast.success("Agendamento confirmado para pagamento presencial."); onDone(); return; } toast.success("Pagamento confirmado e agendamento realizado!"); onDone(); }} className="h-12 w-full bg-[#087A92] text-base text-white hover:bg-[#076b80]"><ShieldCheck className="mr-2 h-4 w-4" /> {method === "Pagar presencialmente" ? "Confirmar agendamento" : `Pagar com ${method}`}</Button><p className="text-center text-xs text-slate-400">Pagamento seguro · Seus dados estão protegidos</p></div>}</CardContent></Card></div>;
}

function WorkspacePanel({ role, active }: { role: Role; active: string }) {
  const [query, setQuery] = useState("");
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);
  const [bookingPatient, setBookingPatient] = useState("");
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const doctorAgenda = trpc.doctor.agenda.useQuery(undefined, { enabled: role === "doctor" && active === "agenda" });
  const operatorAgenda = trpc.operator.clinicAgenda.useQuery(undefined, { enabled: role === "operator" && active === "agenda" });
  const panel = active === "agenda"
    ? { title: role === "doctor" ? "Minha agenda" : "Agenda da clínica", description: role === "doctor" ? "Organize consultas do dia e da semana." : "Acompanhe a operação da clínica e os horários disponíveis." }
    : active === "patients" ? { title: "Meus pacientes", description: "Consulte a lista de pacientes." }
    : active === "reports" ? { title: "Relatórios", description: "Gere indicadores operacionais da clínica." }
    : { title: "Agendamento em nome do paciente", description: "Registre o atendimento solicitado pelo paciente." };
  const filteredPatients = ["João da Silva", "Maria Oliveira", "Carlos Mendes"].filter((name) => name.toLowerCase().includes(query.toLowerCase()));
  if (active === "schedule" && role === "operator") {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{panel.title}</h2>
          <p className="mt-2 text-slate-500">{panel.description}</p>
        </div>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 text-sm text-slate-600">
            Reservas em nome de pacientes ainda não estão habilitadas. A criação de reservas está disponível
            para pacientes autenticados; não foi criada nenhuma reserva por esta tela.
          </CardContent>
        </Card>
      </div>
    );
  }
  if (active === "patients" || active === "reports") {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{panel.title}</h2>
          <p className="mt-2 text-slate-500">{panel.description}</p>
        </div>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 text-sm text-slate-600">
            {active === "patients"
              ? "A lista será exibida quando o vínculo clínico e as permissões de acesso a pacientes forem configurados."
              : "Os relatórios aparecerão após a configuração das consultas e métricas persistidas no Supabase."}
          </CardContent>
        </Card>
      </div>
    );
  }
  const view = active === "agenda" ? <Card className="border-0 shadow-sm"><CardContent className="space-y-3 p-6">{(role === "doctor" ? doctorAgenda.data : operatorAgenda.data)?.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-4"><span className="font-semibold">{new Date(item.starts_at).toLocaleString("pt-BR")} · {item.status}</span><span className="text-sm text-slate-500">{item.kind === "consultation" ? "Consulta" : "Exame"}</span></div>)}{(role === "doctor" ? doctorAgenda.isLoading : operatorAgenda.isLoading) && <p className="text-sm text-slate-500">Carregando agenda…</p>}{!(role === "doctor" ? doctorAgenda.data?.length : operatorAgenda.data?.length) && !(role === "doctor" ? doctorAgenda.isLoading : operatorAgenda.isLoading) && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum agendamento encontrado para este perfil.</p>}</CardContent></Card>
    : active === "patients" ? <Card className="border-0 shadow-sm"><CardContent className="space-y-4 p-6"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar paciente por nome" />{filteredPatients.map((name) => <div key={name} className="flex w-full items-center justify-between rounded-xl border border-slate-100 p-4 text-left"><span className="font-semibold">{name}</span></div>)}</CardContent></Card>
    : active === "reports" ? <Card className="border-0 shadow-sm"><CardContent className="space-y-5 p-6"><div className="grid gap-3 sm:grid-cols-2"><Input type="date" /><Input type="date" /></div><Button onClick={() => setGeneratedReport("Relatório gerado com consultas, pacientes e taxa de presença.")} className="bg-[#087A92] hover:bg-[#076b80]">Gerar relatório</Button>{generatedReport && <div className="rounded-xl bg-[#18AFA0]/10 p-4 text-sm text-[#087A92]">{generatedReport}</div>}</CardContent></Card>
    : <Card className="border-0 shadow-sm"><CardContent className="space-y-4 p-6"><Input value={bookingPatient} onChange={(event) => setBookingPatient(event.target.value)} placeholder="Nome do paciente" /><Select><SelectTrigger><SelectValue placeholder="Escolha o profissional" /></SelectTrigger><SelectContent>{doctors.map((doctor) => <SelectItem key={doctor.name} value={doctor.name}>{doctor.name} · {doctor.specialty}</SelectItem>)}</SelectContent></Select><Button disabled={!bookingPatient.trim()} onClick={() => { setBookingConfirmed(true); toast.success("Agendamento reservado por 10 minutos."); }} className="bg-[#087A92] hover:bg-[#076b80]">Reservar horário</Button>{bookingConfirmed && <p className="rounded-xl bg-green-50 p-3 text-sm text-green-700">Reserva criada para {bookingPatient}; aguardando confirmação do pagamento.</p>}</CardContent></Card>;
  return <div className="space-y-7"><div><p className="mb-2 text-sm font-medium text-[#18AFA0]">{roleLabels[role]}</p><h2 className="text-3xl font-bold tracking-tight">{panel.title}</h2><p className="mt-2 text-slate-500">{panel.description}</p></div>{view}</div>;
}

function PatientHistory() {
  return <div className="space-y-7"><div><h2 className="text-3xl font-bold tracking-tight">Meus agendamentos</h2><p className="mt-2 text-slate-500">Acompanhe consultas, exames e pagamentos.</p></div><Card className="border-0 shadow-sm"><CardContent className="divide-y divide-slate-100 p-0">{appointments.map((item) => <div key={item.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${item.color}`}><span className="font-bold">{item.day}</span><span className="text-[10px] font-bold">{item.month}</span></div><div className="flex-1"><p className="font-bold">{item.title}</p><p className="mt-1 text-sm text-slate-500">{item.professional} · {item.time}</p><Badge variant="outline" className="mt-2 border-slate-200 text-slate-500">{item.status}</Badge></div><div className="flex gap-2"><Button variant="outline" onClick={() => toast.info("O reagendamento abrirá os horários deste profissional.")}>Reagendar</Button><Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => toast.success("Solicitação de cancelamento registrada.")}>Cancelar</Button></div></div>)}</CardContent></Card></div>;
}

function AppContent({ role, userName, onExit, onChangeUnit, selectedUnit, isAdmin }: { role: Role; userName: string; onExit: () => void; onChangeUnit: () => void; selectedUnit: HealthcareUnit | null; isAdmin: boolean }) {
  const [active, setActive] = useState("overview");
  const content = useMemo(() => active, [active]);
  const profileSections: ProfileSection[] = ["profile", "edit-profile", "my-data"];
  const profileSection = profileSections.includes(content as ProfileSection)
    ? (content as ProfileSection)
    : null;
  const view = profileSection ? (
    <ProfilePage section={profileSection} />
  ) : content === "overview" ? (
    <OverviewDashboard role={role} go={setActive} />
  ) : content === "history" ? (
    <PatientAppointments />
  ) : content === "schedule" && role === "patient" ? (
    <AppointmentBooking onDone={() => setActive("overview")} />
  ) : content === "dependents" && role === "patient" ? (
    <PatientProfilesManager />
  ) : content === "adult-authorizations" && isAdmin ? (
    <AdultAuthorizationReview />
  ) : (
    <WorkspacePanel role={role} active={content} />
  );

  return (
    <Shell role={role} userName={userName} onExit={onExit} onChangeUnit={onChangeUnit} selectedUnit={selectedUnit} isAdmin={isAdmin} active={active} setActive={setActive}>
      {profileSection && (
        <ProfileNavigation
          active={profileSection}
          onSelect={(section) => setActive(section)}
        />
      )}
      {view}
    </Shell>
  );
}

function AccountConsentGate({
  pending,
  error,
  onAccept,
}: {
  pending: boolean;
  error?: string;
  onAccept: () => void;
}) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const termsUrl = import.meta.env.VITE_TERMS_URL?.trim();
  const privacyUrl = import.meta.env.VITE_PRIVACY_URL?.trim();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7fbfb] p-5">
      <Card className="w-full max-w-xl border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Revise os consentimentos da sua conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm leading-6 text-slate-600">
            Para continuar, confirme que teve acesso aos documentos legais vigentes da clínica.
            O consentimento será registrado para esta versão: {CURRENT_CONSENT_VERSION}.
          </p>
          {(!termsUrl || !privacyUrl) && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800" role="status">
              Configure VITE_TERMS_URL e VITE_PRIVACY_URL com os documentos aprovados pela clínica antes de usar este fluxo em produção.
            </p>
          )}
          <div className="space-y-3">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-1 accent-[#087A92]" />
              <span>
                Li e aceito{" "}
                {termsUrl ? <a href={termsUrl} target="_blank" rel="noreferrer" className="font-semibold text-[#087A92] underline">os Termos de Uso</a> : <strong>os Termos de Uso</strong>}.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} className="mt-1 accent-[#087A92]" />
              <span>
                Li e aceito{" "}
                {privacyUrl ? <a href={privacyUrl} target="_blank" rel="noreferrer" className="font-semibold text-[#087A92] underline">a Política de Privacidade</a> : <strong>a Política de Privacidade</strong>}.
              </span>
            </label>
          </div>
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          <Button
            type="button"
            disabled={pending || !termsAccepted || !privacyAccepted}
            onClick={onAccept}
            className="w-full bg-[#087A92] hover:bg-[#076b80]"
          >
            {pending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar consentimentos
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

export default function Home() {
  const [, navigate] = useLocation();
  const { user, logout, loading, error, hasSession, refresh } = useAuth();
  const utils = trpc.useUtils();
  const accountConsent = trpc.accountConsent.current.useQuery(undefined, {
    enabled: Boolean(user),
    retry: false,
  });
  const acceptAccountConsent = trpc.accountConsent.accept.useMutation({
    onSuccess: async () => {
      await utils.accountConsent.current.invalidate();
    },
  });
  const forceLogin = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("loggedOut");
  const recoveringPassword = typeof window !== "undefined" && window.location.hash.includes("type=recovery");
  const [showHub, setShowHub] = useState(() => !localStorage.getItem("GGL saude-unit"));
  const [selectedUnit, setSelectedUnit] = useState<HealthcareUnit | null>(() => {
    const unitId = localStorage.getItem("GGL saude-unit");
    return healthcareUnits.find((unit) => unit.id === unitId) ?? null;
  });
  const role: Role | null = user
    ? user.role === "doctor"
      ? "doctor"
      : user.role === "operator" || user.role === "admin"
        ? "operator"
        : "patient"
    : null;

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Verificando sua sessão…</div>;
  }

  if (hasSession && error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7fbfb] p-5">
        <Card className="w-full max-w-xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Não foi possível carregar seu perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              Sua sessão Supabase está ativa, mas o perfil do aplicativo não respondeu.
              Verifique se as migrações do banco foram aplicadas e tente novamente.
            </p>
            <details className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              <summary className="cursor-pointer font-semibold">Detalhes técnicos</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words">{error.message}</pre>
            </details>
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={() => void refresh()} className="bg-[#087A92] hover:bg-[#076b80]">
                Tentar novamente
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  try {
                    await logout();
                    navigate("/");
                  } catch (logoutError) {
                    console.error("[Auth] Failed to sign out after profile error:", logoutError);
                    toast.error("Não foi possível sair da conta. Tente novamente.");
                  }
                }}
              >
                Sair da conta
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (forceLogin || recoveringPassword || !user || !role) return <SupabaseLogin />;
  if (accountConsent.isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Verificando suas autorizações…</div>;
  }
  if (accountConsent.isError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7fbfb] p-5">
        <Card className="w-full max-w-xl border-0 shadow-sm">
          <CardHeader><CardTitle>Não foi possível verificar seus consentimentos</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              A verificação de consentimento não respondeu. Confirme se a migração de dependentes e consentimentos foi aplicada.
            </p>
            <Button type="button" onClick={() => void accountConsent.refetch()} className="bg-[#087A92] hover:bg-[#076b80]">
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }
  if (!accountConsent.data) {
    return (
      <AccountConsentGate
        pending={acceptAccountConsent.isPending}
        error={acceptAccountConsent.error?.message}
        onAccept={() => acceptAccountConsent.mutate()}
      />
    );
  }
  if (showHub) return <ClinicHub userName={user?.name ?? "João"} onSelect={(unit) => {
    localStorage.setItem("GGL saude-unit", unit.id);
    setSelectedUnit(unit);
    setShowHub(false);
    navigate(`/dashboard/${role}`);
  }} onBackToLogin={async () => {
    try {
      await logout();
      setSelectedUnit(null);
      setShowHub(false);
      localStorage.removeItem("GGL saude-unit");
      navigate(clearAuthState(localStorage));
    } catch (error) {
      console.error("[Auth] Failed to sign out from clinic selection:", error);
      toast.error("Não foi possível sair da conta. Tente novamente.");
    }
  }} />;
  return <AppContent role={role} userName={user.name?.trim() || "Usuário"} selectedUnit={selectedUnit} isAdmin={user.role === "admin"} onChangeUnit={() => { setShowHub(true); navigate("/"); }} onExit={async () => { await logout(); setSelectedUnit(null); localStorage.removeItem("GGL saude-unit"); navigate(clearAuthState(localStorage)); }} />;
}
