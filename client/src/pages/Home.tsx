import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { ProfileNavigation, ProfilePage } from "@/components/ProfilePages";
import type { ProfileSection } from "@/components/ProfilePages";
import { clearAuthState, isAppRole, persistSelectedRole } from "@shared/authFlow";
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
import { Building2, CalendarDays, Check, Clock3, FileText, HeartPulse, LayoutDashboard, LogOut, Mail, Menu, Search, ShieldCheck, Stethoscope, UserRound, Users, WalletCards, X } from "lucide-react";

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

export function Login({ onEnter }: { onEnter: (role: Role) => void }) {
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
            <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="password">Senha</Label><button className="text-xs font-semibold text-[#087A92] hover:underline">Esqueci minha senha</button></div><Input id="password" type="password" placeholder="••••••••" disabled={locked} /></div>
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

function Shell({ role, onExit, onChangeUnit, selectedUnit, children, active, setActive }: { role: Role; onExit: () => void | Promise<void>; onChangeUnit: () => void; selectedUnit: HealthcareUnit | null; children: React.ReactNode; active: string; setActive: (value: string) => void }) {
  const nav = role === "patient" ? [{ id: "overview", label: "Visão geral", icon: LayoutDashboard }, { id: "schedule", label: "Novo agendamento", icon: CalendarDays }, { id: "history", label: "Meus agendamentos", icon: Clock3 }] : role === "doctor" ? [{ id: "overview", label: "Visão geral", icon: LayoutDashboard }, { id: "agenda", label: "Minha agenda", icon: CalendarDays }, { id: "patients", label: "Pacientes", icon: Users }] : [{ id: "overview", label: "Visão geral", icon: LayoutDashboard }, { id: "agenda", label: "Agenda da clínica", icon: CalendarDays }, { id: "schedule", label: "Novo agendamento", icon: UserRound }, { id: "reports", label: "Relatórios", icon: FileText }];
  return <div className="min-h-screen bg-[#f7fbfb] text-slate-900"><aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-100 bg-white lg:flex lg:flex-col"><div className="flex h-20 items-center border-b border-slate-100 px-7"><BrandLogo compact={false} /></div><div className="px-4 py-6"><p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Menu principal</p><nav className="space-y-1">{nav.map((item) => <button key={item.id} onClick={() => setActive(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition-all ${active === item.id ? "bg-[#087A92]/10 font-semibold text-[#087A92]" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}><item.icon className="h-[18px] w-[18px]" />{item.label}</button>)}</nav></div><div className="mt-auto border-t border-slate-100 p-4"><div className="mb-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#087A92] to-[#4CCB73] text-xs font-bold text-white">{role === "doctor" ? "CR" : role === "operator" ? "AM" : "JS"}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{role === "doctor" ? "Dra. Camila Ribeiro" : role === "operator" ? "Ana Martins" : "João da Silva"}</p><p className="text-xs text-slate-400">{roleLabels[role]}</p></div></div><button onClick={onChangeUnit} className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#087A92] hover:bg-[#e7f7f5]"><Building2 className="h-4 w-4" /> Trocar unidade</button><button onClick={onExit} className="flex w-full items-center gap-3 px-3 py-2 text-sm text-slate-500 hover:text-red-600"><LogOut className="h-4 w-4" /> Sair da conta</button></div></aside><div className="lg:pl-64"><header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-100 bg-white/90 px-5 backdrop-blur-md sm:px-8"><div className="flex items-center gap-3 lg:hidden"><Menu className="h-5 w-5 text-slate-500" /><BrandLogo compact /></div><div className="hidden lg:block"><p className="text-sm text-slate-400">{selectedUnit?.name ?? (role === "doctor" ? "Painel médico" : role === "operator" ? "Operação da clínica" : "Área do paciente")}</p><h1 className="text-lg font-bold">Olá, {role === "doctor" ? "Camila" : role === "operator" ? "Ana" : "João"}</h1></div><div className="flex items-center gap-3"><button className="rounded-xl px-3 py-2 text-sm font-semibold text-[#087A92] hover:bg-[#e7f7f5] lg:hidden" onClick={onChangeUnit}>Trocar unidade</button><button className="relative rounded-xl p-2.5 text-slate-500 hover:bg-slate-50" onClick={() => toast.info("Você está em dia com as notificações.")}><Mail className="h-5 w-5" /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#4CCB73]" /></button><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#087A92]/10 text-sm font-bold text-[#087A92]">{role === "doctor" ? "CR" : role === "operator" ? "AM" : "JS"}</div></div></header><main className="mx-auto max-w-[1440px] p-5 sm:p-8">{children}</main></div></div>;
}

function Overview({ role, go }: { role: Role; go: (id: string) => void }) {
  const isPatient = role === "patient";
  return <div className="space-y-8"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="mb-2 text-sm font-medium text-[#18AFA0]">{isPatient ? "Terça-feira, 17 de junho de 2026" : "Resumo operacional"}</p><h2 className="text-3xl font-bold tracking-[-0.03em]">{isPatient ? "Seu cuidado em dia." : role === "doctor" ? "Sua agenda, sob controle." : "A clínica em movimento."}</h2><p className="mt-2 text-slate-500">{isPatient ? "Acompanhe seus próximos passos e cuide do seu tempo." : "Veja os principais indicadores de hoje."}</p></div>{isPatient && <Button onClick={() => go("schedule")} className="bg-[#087A92] text-white hover:bg-[#076b80]"><CalendarDays className="mr-2 h-4 w-4" /> Novo agendamento</Button>}</div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{(isPatient ? [{ label: "Próxima consulta", value: "18 jun", hint: "Dra. Camila · 09:30", icon: CalendarDays, tint: "bg-[#087A92]/10 text-[#087A92]" }, { label: "Consultas realizadas", value: "12", hint: "+2 este semestre", icon: Check, tint: "bg-[#4CCB73]/15 text-[#20864b]" }, { label: "Pagamentos", value: "R$ 280", hint: "Próximo pagamento", icon: WalletCards, tint: "bg-amber-50 text-amber-600" }] : role === "doctor" ? [{ label: "Consultas hoje", value: "08", hint: "2 aguardando confirmação", icon: CalendarDays, tint: "bg-[#087A92]/10 text-[#087A92]" }, { label: "Pacientes ativos", value: "124", hint: "+8 neste mês", icon: Users, tint: "bg-[#4CCB73]/15 text-[#20864b]" }, { label: "Taxa de presença", value: "94%", hint: "+6% vs. mês anterior", icon: Check, tint: "bg-violet-50 text-violet-600" }, { label: "Receita mensal", value: "R$ 18,4k", hint: "Até o momento", icon: WalletCards, tint: "bg-amber-50 text-amber-600" }] : [{ label: "Agendamentos hoje", value: "32", hint: "6 novos desde ontem", icon: CalendarDays, tint: "bg-[#087A92]/10 text-[#087A92]" }, { label: "Ocupação da agenda", value: "86%", hint: "Nesta semana", icon: Users, tint: "bg-[#4CCB73]/15 text-[#20864b]" }, { label: "Aguardando confirmação", value: "06", hint: "Requer atenção", icon: Clock3, tint: "bg-amber-50 text-amber-600" }, { label: "Cancelamentos", value: "02", hint: "Hoje", icon: X, tint: "bg-red-50 text-red-600" }]).map((item) => <Card key={item.label} className="border-0 shadow-sm"><CardContent className="flex items-start justify-between p-5"><div><p className="text-sm text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-bold">{item.value}</p><p className="mt-1 text-xs text-slate-400">{item.hint}</p></div><div className={`rounded-xl p-3 ${item.tint}`}><item.icon className="h-5 w-5" /></div></CardContent></Card>)}</div><Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-lg">{isPatient ? "Próximos cuidados" : "Agenda de hoje"}</CardTitle></CardHeader><CardContent className="space-y-3">{appointments.slice(0, isPatient ? 2 : 1).map((item) => <div key={item.id} className="flex items-center gap-4 rounded-xl border border-slate-100 p-4"><div className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl ${item.color}`}><span className="text-sm font-bold">{item.day}</span><span className="text-[9px] font-bold">{item.month}</span></div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{item.title}</p><p className="mt-1 text-sm text-slate-500">{item.professional} · {item.time}</p></div><Badge variant="outline" className="hidden sm:inline-flex">{item.status}</Badge><Button variant="ghost" size="sm" onClick={() => toast.info("Detalhes do agendamento")}>Detalhes</Button></div>)}</CardContent></Card></div>;
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
  const doctorAgenda = trpc.doctor.agenda.useQuery({ professionalId: 1 }, { enabled: role === "doctor" && active === "agenda" });
  const operatorAgenda = trpc.operator.clinicAgenda.useQuery(undefined, { enabled: role === "operator" && active === "agenda" });
  const panel = active === "agenda"
    ? { title: role === "doctor" ? "Minha agenda" : "Agenda da clínica", description: role === "doctor" ? "Organize consultas do dia e da semana." : "Acompanhe a operação da clínica e os horários disponíveis." }
    : active === "patients" ? { title: "Meus pacientes", description: "Consulte a lista de pacientes." }
    : active === "reports" ? { title: "Relatórios", description: "Gere indicadores operacionais da clínica." }
    : { title: "Agendamento em nome do paciente", description: "Registre o atendimento solicitado pelo paciente." };
  const filteredPatients = ["João da Silva", "Maria Oliveira", "Carlos Mendes"].filter((name) => name.toLowerCase().includes(query.toLowerCase()));
  const view = active === "agenda" ? <Card className="border-0 shadow-sm"><CardContent className="space-y-3 p-6">{(role === "doctor" ? doctorAgenda.data : operatorAgenda.data)?.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-4"><span className="font-semibold">{new Date(item.startsAt).toLocaleString("pt-BR")} · {item.status}</span><Button size="sm" variant="outline" onClick={() => toast.success("Status da consulta atualizado.")}>Atualizar status</Button></div>)}{(role === "doctor" ? doctorAgenda.isLoading : operatorAgenda.isLoading) && <p className="text-sm text-slate-500">Carregando agenda persistida…</p>}{!(role === "doctor" ? doctorAgenda.data?.length : operatorAgenda.data?.length) && !(role === "doctor" ? doctorAgenda.isLoading : operatorAgenda.isLoading) && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum agendamento encontrado para este perfil.</p>}</CardContent></Card>
    : active === "patients" ? <Card className="border-0 shadow-sm"><CardContent className="space-y-4 p-6"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar paciente por nome" />{filteredPatients.map((name) => <div key={name} className="flex w-full items-center justify-between rounded-xl border border-slate-100 p-4 text-left"><span className="font-semibold">{name}</span></div>)}</CardContent></Card>
    : active === "reports" ? <Card className="border-0 shadow-sm"><CardContent className="space-y-5 p-6"><div className="grid gap-3 sm:grid-cols-2"><Input type="date" /><Input type="date" /></div><Button onClick={() => setGeneratedReport("Relatório gerado com consultas, pacientes e taxa de presença.")} className="bg-[#087A92] hover:bg-[#076b80]">Gerar relatório</Button>{generatedReport && <div className="rounded-xl bg-[#18AFA0]/10 p-4 text-sm text-[#087A92]">{generatedReport}</div>}</CardContent></Card>
    : <Card className="border-0 shadow-sm"><CardContent className="space-y-4 p-6"><Input value={bookingPatient} onChange={(event) => setBookingPatient(event.target.value)} placeholder="Nome do paciente" /><Select><SelectTrigger><SelectValue placeholder="Escolha o profissional" /></SelectTrigger><SelectContent>{doctors.map((doctor) => <SelectItem key={doctor.name} value={doctor.name}>{doctor.name} · {doctor.specialty}</SelectItem>)}</SelectContent></Select><Button disabled={!bookingPatient.trim()} onClick={() => { setBookingConfirmed(true); toast.success("Agendamento reservado por 10 minutos."); }} className="bg-[#087A92] hover:bg-[#076b80]">Reservar horário</Button>{bookingConfirmed && <p className="rounded-xl bg-green-50 p-3 text-sm text-green-700">Reserva criada para {bookingPatient}; aguardando confirmação do pagamento.</p>}</CardContent></Card>;
  return <div className="space-y-7"><div><p className="mb-2 text-sm font-medium text-[#18AFA0]">{roleLabels[role]}</p><h2 className="text-3xl font-bold tracking-tight">{panel.title}</h2><p className="mt-2 text-slate-500">{panel.description}</p></div>{view}</div>;
}

function PatientHistory() {
  return <div className="space-y-7"><div><h2 className="text-3xl font-bold tracking-tight">Meus agendamentos</h2><p className="mt-2 text-slate-500">Acompanhe consultas, exames e pagamentos.</p></div><Card className="border-0 shadow-sm"><CardContent className="divide-y divide-slate-100 p-0">{appointments.map((item) => <div key={item.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${item.color}`}><span className="font-bold">{item.day}</span><span className="text-[10px] font-bold">{item.month}</span></div><div className="flex-1"><p className="font-bold">{item.title}</p><p className="mt-1 text-sm text-slate-500">{item.professional} · {item.time}</p><Badge variant="outline" className="mt-2 border-slate-200 text-slate-500">{item.status}</Badge></div><div className="flex gap-2"><Button variant="outline" onClick={() => toast.info("O reagendamento abrirá os horários deste profissional.")}>Reagendar</Button><Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => toast.success("Solicitação de cancelamento registrada.")}>Cancelar</Button></div></div>)}</CardContent></Card></div>;
}

function AppContent({ role, onExit, onChangeUnit, selectedUnit }: { role: Role; onExit: () => void; onChangeUnit: () => void; selectedUnit: HealthcareUnit | null }) {
  const [active, setActive] = useState("overview");
  const content = useMemo(() => active, [active]);
  const profileSections: ProfileSection[] = ["profile", "edit-profile", "my-data"];
  const profileSection = profileSections.includes(content as ProfileSection)
    ? (content as ProfileSection)
    : null;
  const view = profileSection ? (
    <ProfilePage section={profileSection} />
  ) : content === "overview" ? (
    <Overview role={role} go={setActive} />
  ) : content === "history" ? (
    <PatientHistory />
  ) : content === "schedule" && role === "patient" ? (
    <Booking onDone={() => setActive("overview")} />
  ) : (
    <WorkspacePanel role={role} active={content} />
  );

  return (
    <Shell role={role} onExit={onExit} onChangeUnit={onChangeUnit} selectedUnit={selectedUnit} active={active} setActive={setActive}>
      <ProfileNavigation
        active={profileSection}
        onSelect={(section) => setActive(section)}
      />
      {view}
    </Shell>
  );
}

export default function Home() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/dashboard/:role");
  const { user, logout } = useAuth();
  const forceLogin = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("loggedOut");
  const routeRole = isAppRole(params?.role) ? params.role : null;
  const [role, setRole] = useState<Role | null>(routeRole);
  const [showHub, setShowHub] = useState(false);
  const [returningToLogin, setReturningToLogin] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<HealthcareUnit | null>(() => {
    const unitId = localStorage.getItem("GGL saude-unit");
    return healthcareUnits.find((unit) => unit.id === unitId) ?? null;
  });

  useEffect(() => {
    if (routeRole && role !== routeRole) {
      setRole(routeRole);
      setShowHub(false);
    }
  }, [routeRole, role]);

  useEffect(() => {
    if (user && !role && !returningToLogin) {
      const stored = localStorage.getItem("GGL saude-role") as Role | null;
      const authenticatedRole: Role = user.role === "doctor" ? "doctor" : user.role === "operator" || user.role === "admin" ? "operator" : stored ?? "patient";
      setRole(authenticatedRole);
      setShowHub(true);
    }
  }, [user, role, returningToLogin]);

  if (forceLogin || !role) return <Login onEnter={(nextRole) => { setReturningToLogin(false); setRole(nextRole); setShowHub(true); localStorage.setItem("GGL saude-role", nextRole); }} />;
  if (showHub) return <ClinicHub userName={user?.name ?? "João"} onSelect={(unit) => {
    localStorage.setItem("GGL saude-unit", unit.id);
    setSelectedUnit(unit);
    setShowHub(false);
    navigate(persistSelectedRole(localStorage, role));
  }} onBackToLogin={() => {
    setReturningToLogin(true);
    setRole(null);
    setShowHub(false);
    localStorage.removeItem("GGL saude-role");
    navigate("/");
  }} />;
  return <AppContent role={role} selectedUnit={selectedUnit} onChangeUnit={() => { setShowHub(true); navigate("/"); }} onExit={async () => { await logout(); setRole(null); setSelectedUnit(null); localStorage.removeItem("GGL saude-unit"); navigate(clearAuthState(localStorage)); }} />;
}
