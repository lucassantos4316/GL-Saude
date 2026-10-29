import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import {
  CURRENT_CONSENT_VERSION,
  isAdult,
  isValidCpf,
  onlyDigits,
  passwordStrength,
} from "@shared/registration";
import {
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  HeartPulse,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import * as React from "react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { BrandLogo } from "./BrandLogo";

type AuthMode = "sign_in" | "sign_up" | "update_password";
type AccountPurpose = "self" | "minor" | "adult";
type Address = {
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};

const emptyAddress: Address = {
  postalCode: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
};

function formatCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function formatPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  const split = digits.length === 11 ? 7 : 6;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, split)}-${digits.slice(split)}`;
}

function formatPostalCode(value: string) {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/invalid login credentials/i.test(message)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(message)) return "Confirme seu e-mail antes de entrar.";
  if (/already registered|user already exists/i.test(message)) {
    return "Este e-mail já possui uma conta. Entre ou recupere sua senha.";
  }
  if (/fetch|network/i.test(message)) {
    return "Não foi possível conectar ao Supabase. Verifique sua conexão e tente novamente.";
  }
  return message || "Não foi possível concluir a solicitação. Tente novamente.";
}

export default function SupabaseLogin() {
  const [mode, setMode] = useState<AuthMode>(() =>
    typeof window !== "undefined" && window.location.hash.includes("type=recovery")
      ? "update_password"
      : "sign_in"
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [purpose, setPurpose] = useState<AccountPurpose>("self");
  const [step, setStep] = useState<1 | 2>(1);
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState<Address>(emptyAddress);
  const [dependentName, setDependentName] = useState("");
  const [dependentCpf, setDependentCpf] = useState("");
  const [dependentBirthDate, setDependentBirthDate] = useState("");
  const [relationship, setRelationship] = useState("filho(a)");
  const [consentEmail, setConsentEmail] = useState("");
  const [legalGuardianConfirmed, setLegalGuardianConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lookingUpCep, setLookingUpCep] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const strength = passwordStrength(password);
  const termsUrl = import.meta.env.VITE_TERMS_URL?.trim();
  const privacyUrl = import.meta.env.VITE_PRIVACY_URL?.trim();

  const updateAddress = (field: keyof Address, value: string) => {
    setAddress((current) => ({ ...current, [field]: value }));
  };

  const validateAccountDetails = () => {
    if (name.trim().length < 3) return "Informe seu nome completo.";
    if (!isValidCpf(cpf)) return "Informe um CPF válido.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Informe um e-mail válido.";
    if (!isAdult(birthDate)) {
      return "O titular da conta deve ser maior de 18 anos. Um responsável adulto pode cadastrar o paciente.";
    }
    if (onlyDigits(phone).length < 10) return "Informe um telefone com DDD.";
    if (purpose !== "self") {
      if (dependentName.trim().length < 3) return "Informe o nome completo do paciente dependente.";
      if (!dependentBirthDate) return "Informe a data de nascimento do dependente.";
      if (dependentCpf && !isValidCpf(dependentCpf)) return "O CPF do dependente é inválido.";
      if (!relationship.trim()) return "Informe o vínculo com o dependente.";
      if (purpose === "minor" && !legalGuardianConfirmed) {
        return "Confirme que você é responsável legal pelo menor.";
      }
      if (purpose === "adult") {
        if (!consentEmail.trim() || consentEmail.trim().toLowerCase() === email.trim().toLowerCase()) {
          return "Informe o e-mail próprio do dependente adulto para autorização.";
        }
        if (isAdult(dependentBirthDate) === false && purpose === "adult") {
          return "A data de nascimento indica um menor; escolha a opção de dependente menor.";
        }
      }
      if (purpose === "minor" && isAdult(dependentBirthDate)) {
        return "A data de nascimento indica um adulto; escolha a opção de dependente adulto.";
      }
    }
    return "";
  };

  const validateRegistration = () => {
    const accountError = validateAccountDetails();
    if (accountError) return accountError;
    if (!email.trim()) return "Informe seu e-mail.";
    if (password.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
    if (password !== passwordConfirmation) return "As senhas não coincidem.";
    if (onlyDigits(address.postalCode).length !== 8) return "Informe um CEP válido.";
    if (!address.street.trim() || !address.number.trim() || !address.district.trim() ||
      !address.city.trim() || address.state.trim().length !== 2) {
      return "Preencha logradouro, número, bairro, cidade e estado.";
    }
    if (!termsAccepted || !privacyAccepted) {
      return "Aceite os Termos de Uso e a Política de Privacidade para continuar.";
    }
    return "";
  };

  const lookupPostalCode = async () => {
    const postalCode = onlyDigits(address.postalCode);
    if (postalCode.length !== 8) return;
    setLookingUpCep(true);
    setErrorMessage("");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${postalCode}/json/`);
      if (!response.ok) throw new Error("CEP_SERVICE_UNAVAILABLE");
      const result = await response.json() as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (result.erro) {
        setErrorMessage("CEP não encontrado. Confira o número e preencha o endereço manualmente.");
        return;
      }
      setAddress((current) => ({
        ...current,
        street: result.logradouro || current.street,
        district: result.bairro || current.district,
        city: result.localidade || current.city,
        state: result.uf || current.state,
      }));
    } catch (error) {
      console.error("[Registration] CEP lookup failed:", error);
      setErrorMessage("Não foi possível consultar o CEP. Você pode preencher o endereço manualmente.");
    } finally {
      setLookingUpCep(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (mode === "sign_up") {
      const validationError = validateRegistration();
      if (validationError) {
        setErrorMessage(validationError);
        if (step === 1 && !validateAccountDetails()) setStep(2);
        return;
      }
    } else {
      if (!email.trim() && mode !== "update_password") {
        setErrorMessage("Informe seu e-mail.");
        return;
      }
      if (password.length < 8 || password !== passwordConfirmation && mode === "update_password") {
        setErrorMessage(
          mode === "update_password" && password !== passwordConfirmation
            ? "As senhas não coincidem."
            : "A senha deve ter pelo menos 8 caracteres."
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      if (mode === "update_password") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        window.history.replaceState(null, "", window.location.pathname);
        window.location.assign("/dashboard/patient");
        return;
      }

      if (mode === "sign_in") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        window.location.assign("/dashboard/patient");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim(),
            cpf: onlyDigits(cpf),
            birth_date: birthDate,
            phone: onlyDigits(phone),
            address: {
              postal_code: onlyDigits(address.postalCode),
              street: address.street.trim(),
              number: address.number.trim(),
              complement: address.complement.trim(),
              district: address.district.trim(),
              city: address.city.trim(),
              state: address.state.trim().toUpperCase(),
            },
            account_purpose: purpose,
            terms_accepted: termsAccepted,
            privacy_accepted: privacyAccepted,
            terms_version: CURRENT_CONSENT_VERSION,
            privacy_version: CURRENT_CONSENT_VERSION,
            initial_dependent: purpose === "self" ? null : {
              name: dependentName.trim(),
              cpf: onlyDigits(dependentCpf) || null,
              birth_date: dependentBirthDate,
              relationship,
              consent_email: consentEmail.trim().toLowerCase() || null,
              legal_guardian_confirmed: purpose === "minor" && legalGuardianConfirmed,
            },
          },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      if (!data.session) {
        toast.success("Conta criada. Confirme seu e-mail para entrar.");
        setMode("sign_in");
        setStep(1);
        setPassword("");
        setPasswordConfirmation("");
        return;
      }
      window.location.assign("/dashboard/patient");
    } catch (error) {
      setErrorMessage(authErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const signInWithGoogle = async () => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (error) {
      setErrorMessage(authErrorMessage(error));
      setSubmitting(false);
    }
  };

  const sendPasswordReset = async () => {
    if (!email.trim()) {
      setErrorMessage("Informe seu e-mail para receber o link de recuperação.");
      return;
    }
    setSubmitting(true);
    setErrorMessage("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      toast.success("Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.");
    } catch (error) {
      setErrorMessage(authErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const setPurposeAndReset = (value: AccountPurpose) => {
    setPurpose(value);
    setErrorMessage("");
    setLegalGuardianConfirmed(false);
  };

  const passwordInput = (
    id: string,
    value: string,
    onChange: (value: string) => void,
    visible: boolean,
    setVisible: (visible: boolean) => void,
    autoComplete: string
  ) => (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={8}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pr-11"
      />
      <button
        type="button"
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        onClick={() => setVisible(!visible)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );

  const strengthLabel = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"][strength];

  return (
    <div className="min-h-screen bg-[#f7fbfb] text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-[#087A92] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#18AFA0]/40 blur-3xl" />
          <div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-[#4CCB73]/30 blur-3xl" />
          <BrandLogo className="relative brightness-0 invert" />
          <div className="relative max-w-xl pb-16">
            <Badge className="mb-7 border-white/20 bg-white/10 text-white hover:bg-white/10">
              Cuidado conectado, de um jeito mais simples
            </Badge>
            <h1 className="max-w-lg text-5xl font-bold leading-[1.06] tracking-[-0.04em]">
              A saúde que acompanha o seu ritmo.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-white/75">
              Agende consultas e exames, acompanhe seu cuidado e tenha tudo organizado em um só lugar.
            </p>
            <div className="mt-10 flex items-center gap-6 text-sm text-white/80">
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Dados protegidos</span>
              <span className="flex items-center gap-2"><HeartPulse className="h-4 w-4" /> Cuidado humano</span>
            </div>
          </div>
          <p className="relative text-xs text-white/50">
            GGL saude · Gestão inteligente para clínicas e pacientes
          </p>
        </section>

        <section className="flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-2xl">
            <div className="mb-7 lg:hidden"><BrandLogo /></div>
            <div className="mb-6">
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-[#18AFA0]">
                Bem-vindo à GGL saude
              </p>
              <h2 className="text-3xl font-bold tracking-tight">
                {mode === "sign_in"
                  ? "Acesse sua conta"
                  : mode === "sign_up"
                    ? "Crie sua conta"
                    : "Redefina sua senha"}
              </h2>
              <p className="mt-2 text-slate-500">
                {mode === "sign_up"
                  ? "Seus dados e os de cada paciente ficam organizados separadamente."
                  : "Entre para cuidar do que realmente importa."}
              </p>
            </div>

            <Card className="border-0 bg-white shadow-[0_20px_60px_rgba(8,122,146,0.10)]">
              <CardContent className="space-y-5 p-5 sm:p-7">
                {mode === "sign_up" && (
                  <div className="flex items-center gap-3" aria-label={`Etapa ${step} de 2`}>
                    {[1, 2].map((item) => (
                      <React.Fragment key={item}>
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          step >= item ? "bg-[#087A92] text-white" : "bg-slate-100 text-slate-400"
                        }`}>
                          {step > item ? <Check className="h-4 w-4" /> : item}
                        </div>
                        <span className={step === item ? "text-sm font-semibold text-[#087A92]" : "text-sm text-slate-400"}>
                          {item === 1 ? "Dados pessoais" : "Endereço e segurança"}
                        </span>
                        {item === 1 && <div className="h-px flex-1 bg-slate-200" />}
                      </React.Fragment>
                    ))}
                  </div>
                )}

                <form onSubmit={submit} noValidate className="space-y-5">
                  {mode === "sign_up" && step === 1 && (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="signup-name">Nome completo do titular da conta</Label>
                          <Input id="signup-name" autoComplete="name" maxLength={255} value={name} onChange={(event) => setName(event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-cpf">CPF</Label>
                          <Input id="signup-cpf" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={cpf} onChange={(event) => setCpf(formatCpf(event.target.value))} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-birth-date">Data de nascimento do titular</Label>
                          <Input id="signup-birth-date" type="date" autoComplete="bday" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-email">E-mail</Label>
                          <Input id="signup-email" type="email" autoComplete="email" placeholder="voce@exemplo.com" value={email} onChange={(event) => setEmail(event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-phone">Telefone ou celular</Label>
                          <Input id="signup-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(00) 00000-0000" value={phone} onChange={(event) => setPhone(formatPhone(event.target.value))} />
                        </div>
                      </div>

                      <fieldset className="space-y-2">
                        <legend className="text-sm font-medium">Para quem será utilizada esta conta?</legend>
                        {([
                          ["self", "Para mim"],
                          ["minor", "Para meu filho ou dependente menor de idade"],
                          ["adult", "Para um idoso ou outro dependente adulto"],
                        ] as const).map(([value, label]) => (
                          <label key={value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm hover:border-[#18AFA0]">
                            <input type="radio" name="account-purpose" value={value} checked={purpose === value} onChange={() => setPurposeAndReset(value)} className="mt-0.5 accent-[#087A92]" />
                            <span>{label}</span>
                          </label>
                        ))}
                      </fieldset>

                      {purpose !== "self" && (
                        <div className="space-y-4 rounded-xl bg-slate-50 p-4">
                          <h3 className="font-semibold">Dados do paciente dependente</h3>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2 sm:col-span-2">
                              <Label htmlFor="dependent-name">Nome completo</Label>
                              <Input id="dependent-name" value={dependentName} onChange={(event) => setDependentName(event.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="dependent-cpf">CPF (quando aplicável)</Label>
                              <Input id="dependent-cpf" inputMode="numeric" placeholder="000.000.000-00" value={dependentCpf} onChange={(event) => setDependentCpf(formatCpf(event.target.value))} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="dependent-birth">Data de nascimento</Label>
                              <Input id="dependent-birth" type="date" value={dependentBirthDate} onChange={(event) => setDependentBirthDate(event.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="dependent-relationship">Grau de parentesco ou vínculo</Label>
                              <select id="dependent-relationship" value={relationship} onChange={(event) => setRelationship(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                                <option value="filho(a)">Filho(a)</option>
                                <option value="responsável legal">Responsável legal</option>
                                <option value="cônjuge">Cônjuge</option>
                                <option value="pai/mãe">Pai/Mãe</option>
                                <option value="outro">Outro</option>
                              </select>
                            </div>
                            {purpose === "adult" && (
                              <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="dependent-consent-email">E-mail próprio do dependente adulto</Label>
                                <Input id="dependent-consent-email" type="email" autoComplete="off" value={consentEmail} onChange={(event) => setConsentEmail(event.target.value)} />
                                <p className="text-xs text-slate-500">
                                  O acesso a agendamentos ficará pendente até a autorização do paciente adulto.
                                </p>
                              </div>
                            )}
                          </div>
                          {purpose === "minor" && (
                            <label className="flex items-start gap-2 text-sm text-slate-600">
                              <input type="checkbox" checked={legalGuardianConfirmed} onChange={(event) => setLegalGuardianConfirmed(event.target.checked)} className="mt-1 accent-[#087A92]" />
                              Confirmo que sou responsável legal por este menor e estou autorizado(a) a gerenciar seu cadastro e agendamentos.
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {mode === "sign_up" && step === 2 && (
                    <div className="space-y-5">
                      <fieldset className="space-y-3">
                        <legend className="text-sm font-semibold">Endereço do titular</legend>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="signup-cep">CEP</Label>
                            <Input id="signup-cep" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" value={address.postalCode} onBlur={() => void lookupPostalCode()} onChange={(event) => updateAddress("postalCode", formatPostalCode(event.target.value))} />
                            {lookingUpCep && <p className="text-xs text-slate-500">Consultando CEP…</p>}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="signup-street">Logradouro</Label>
                            <Input id="signup-street" autoComplete="address-line1" value={address.street} onChange={(event) => updateAddress("street", event.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="signup-number">Número</Label>
                            <Input id="signup-number" autoComplete="off" value={address.number} onChange={(event) => updateAddress("number", event.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="signup-complement">Complemento (opcional)</Label>
                            <Input id="signup-complement" autoComplete="address-line2" value={address.complement} onChange={(event) => updateAddress("complement", event.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="signup-district">Bairro</Label>
                            <Input id="signup-district" value={address.district} onChange={(event) => updateAddress("district", event.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="signup-city">Cidade</Label>
                            <Input id="signup-city" autoComplete="address-level2" value={address.city} onChange={(event) => updateAddress("city", event.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="signup-state">Estado</Label>
                            <Input id="signup-state" autoComplete="address-level1" maxLength={2} placeholder="UF" value={address.state} onChange={(event) => updateAddress("state", event.target.value.toUpperCase())} />
                          </div>
                        </div>
                      </fieldset>

                      <fieldset className="space-y-3">
                        <legend className="text-sm font-semibold">Segurança da conta</legend>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="signup-password">Senha</Label>
                            {passwordInput("signup-password", password, setPassword, showPassword, setShowPassword, "new-password")}
                            <div aria-live="polite" className="space-y-1">
                              <div className="flex gap-1" aria-hidden="true">
                                {[1, 2, 3, 4].map((level) => <span key={level} className={`h-1.5 flex-1 rounded-full ${strength >= level ? "bg-[#18AFA0]" : "bg-slate-200"}`} />)}
                              </div>
                              <p className="text-xs text-slate-500">Força da senha: {strengthLabel}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="signup-password-confirm">Confirme a senha</Label>
                            {passwordInput("signup-password-confirm", passwordConfirmation, setPasswordConfirmation, showConfirmation, setShowConfirmation, "new-password")}
                          </div>
                        </div>
                      </fieldset>

                      <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
                        <label className="flex items-start gap-2">
                          <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-1 accent-[#087A92]" />
                          <span>
                            Li e aceito{" "}
                            {termsUrl ? <a href={termsUrl} target="_blank" rel="noreferrer" className="font-semibold text-[#087A92] underline">os Termos de Uso da GGL Saúde</a> : <strong>os Termos de Uso da GGL Saúde</strong>}.
                          </span>
                        </label>
                        <label className="flex items-start gap-2">
                          <input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} className="mt-1 accent-[#087A92]" />
                          <span>
                            Li e aceito{" "}
                            {privacyUrl ? <a href={privacyUrl} target="_blank" rel="noreferrer" className="font-semibold text-[#087A92] underline">a Política de Privacidade</a> : <strong>a Política de Privacidade</strong>} e o tratamento dos meus dados conforme informado pela clínica.
                          </span>
                        </label>
                        <p className="text-xs text-amber-800">
                          {!termsUrl || !privacyUrl
                            ? "Configure os links dos documentos legais aprovados pela clínica antes de publicar o cadastro."
                            : `Consentimento registrado para a versão ${CURRENT_CONSENT_VERSION}.`}
                        </p>
                      </div>
                    </div>
                  )}

                  {(mode === "sign_in" || mode === "update_password") && (
                    <div className="space-y-4">
                      {mode !== "update_password" && (
                        <div className="space-y-2">
                          <Label htmlFor="supabase-email">E-mail</Label>
                          <Input id="supabase-email" type="email" autoComplete="email" placeholder="voce@exemplo.com" value={email} onChange={(event) => setEmail(event.target.value)} />
                        </div>
                      )}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="supabase-password">Senha</Label>
                          {mode === "sign_in" && (
                            <button type="button" disabled={submitting} onClick={() => void sendPasswordReset()} className="text-xs font-semibold text-[#087A92] hover:underline">
                              Esqueci minha senha
                            </button>
                          )}
                        </div>
                        {passwordInput("supabase-password", password, setPassword, showPassword, setShowPassword, mode === "sign_in" ? "current-password" : "new-password")}
                      </div>
                      {mode === "update_password" && (
                        <div className="space-y-2">
                          <Label htmlFor="supabase-password-confirm">Confirme a nova senha</Label>
                          {passwordInput("supabase-password-confirm", passwordConfirmation, setPasswordConfirmation, showConfirmation, setShowConfirmation, "new-password")}
                        </div>
                      )}
                    </div>
                  )}

                  {errorMessage && (
                    <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
                      {errorMessage}
                    </p>
                  )}

                  {mode === "sign_up" && step === 1 ? (
                    <Button
                      type="button"
                      onClick={() => {
                        const message = validateAccountDetails();
                        setErrorMessage(message);
                        if (!message) setStep(2);
                      }}
                      className="h-12 w-full bg-[#087A92] text-base hover:bg-[#076b80]"
                    >
                      Continuar <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <div className="flex flex-col-reverse gap-3 sm:flex-row">
                      {mode === "sign_up" && (
                        <Button type="button" variant="outline" onClick={() => { setErrorMessage(""); setStep(1); }} className="h-12 sm:flex-1">
                          Voltar
                        </Button>
                      )}
                      <Button type="submit" className="h-12 w-full bg-[#087A92] text-base hover:bg-[#076b80]" disabled={submitting || lookingUpCep}>
                        {(submitting || lookingUpCep) && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                        {mode === "sign_in" ? "Entrar" : mode === "sign_up" ? "Criar conta" : "Atualizar senha"}
                        {!submitting && <ChevronRight className="ml-2 h-4 w-4" />}
                      </Button>
                    </div>
                  )}
                </form>

                {mode !== "update_password" && (
                  <>
                    <p className="text-center text-xs text-slate-400">
                      Ambiente seguro com autenticação Supabase.
                    </p>
                    {mode === "sign_in" && (
                      <Button type="button" variant="outline" onClick={() => void signInWithGoogle()} disabled={submitting} className="h-12 w-full border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        Continuar com Google
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <p className="mt-6 text-center text-sm text-slate-500">
              {mode !== "update_password" && (
                <>
                  {mode === "sign_in" ? "Ainda não possui uma conta?" : "Já possui uma conta?"}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage("");
                      setPassword("");
                      setPasswordConfirmation("");
                      setStep(1);
                      setMode(mode === "sign_in" ? "sign_up" : "sign_in");
                    }}
                    className="font-semibold text-[#087A92]"
                  >
                    {mode === "sign_in" ? "Cadastre-se" : "Entrar"}
                  </button>
                </>
              )}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
