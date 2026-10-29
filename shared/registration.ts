export const CURRENT_CONSENT_VERSION = "draft-2026-10-28";

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidCpf(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpf[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export function isAdult(birthDate: string, today = new Date()) {
  const parsed = new Date(`${birthDate}T00:00:00`);
  if (!birthDate || !Number.isFinite(parsed.getTime()) || parsed >= today) return false;

  let age = today.getFullYear() - parsed.getFullYear();
  const birthdayHasPassed =
    today.getMonth() > parsed.getMonth() ||
    (today.getMonth() === parsed.getMonth() && today.getDate() >= parsed.getDate());
  if (!birthdayHasPassed) age -= 1;
  return age >= 18;
}

export function passwordStrength(password: string) {
  if (!password) return 0;
  return [
    password.length >= 8,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ].filter(Boolean).length;
}
