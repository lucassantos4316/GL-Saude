import { describe, expect, it } from "vitest";
import {
  canFinalizeAppointment,
  getHoldExpiration,
  shouldTemporarilyBlock,
  TEMPORARY_HOLD_MINUTES,
} from "../shared/bookingRules";

describe("CLINIMED booking rules", () => {
  it("blocks exactly at the third failed login attempt", () => {
    expect(shouldTemporarilyBlock(2)).toBe(false);
    expect(shouldTemporarilyBlock(3)).toBe(true);
    expect(shouldTemporarilyBlock(4)).toBe(true);
  });

  it("expires a temporary slot hold after exactly ten minutes", () => {
    const startedAt = new Date("2026-06-17T12:00:00.000Z");
    const expiresAt = getHoldExpiration(startedAt);
    expect(expiresAt.toISOString()).toBe("2026-06-17T12:10:00.000Z");
    expect(TEMPORARY_HOLD_MINUTES).toBe(10);
  });

  it("only finalizes an appointment after payment confirmation", () => {
    expect(canFinalizeAppointment("pending")).toBe(false);
    expect(canFinalizeAppointment("failed")).toBe(false);
    expect(canFinalizeAppointment("confirmed")).toBe(true);
  });
});
