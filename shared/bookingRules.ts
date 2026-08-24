export const TEMPORARY_HOLD_MINUTES = 10;
export const MAX_LOGIN_ATTEMPTS = 3;

export function shouldTemporarilyBlock(failedAttempts: number) {
  return failedAttempts >= MAX_LOGIN_ATTEMPTS;
}

export function getHoldExpiration(startedAt: Date) {
  return new Date(startedAt.getTime() + TEMPORARY_HOLD_MINUTES * 60 * 1000);
}

export function canFinalizeAppointment(paymentStatus: "pending" | "confirmed" | "failed") {
  return paymentStatus === "confirmed";
}
