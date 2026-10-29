import { describe, expect, it } from "vitest";
import { isAdult, isValidCpf, passwordStrength } from "../shared/registration";

describe("registration validation", () => {
  it("validates CPF check digits and rejects repeated digits", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });

  it("checks adult age against the birthday in the current year", () => {
    const today = new Date("2026-10-28T12:00:00");
    expect(isAdult("2008-10-28", today)).toBe(true);
    expect(isAdult("2008-10-29", today)).toBe(false);
    expect(isAdult("not-a-date", today)).toBe(false);
  });

  it("scores password length and character variety", () => {
    expect(passwordStrength("abc")).toBe(0);
    expect(passwordStrength("abcdefgH")).toBe(2);
    expect(passwordStrength("Abcdefg1!")).toBe(4);
  });
});
