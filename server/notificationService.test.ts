import { describe, expect, it } from "vitest";
import { buildAppointmentNotificationQueue } from "./notificationService";

describe("appointment notification queue", () => {
  it("creates confirmation, access and two reminder events for email", () => {
    const startsAt = new Date("2026-06-20T15:00:00.000Z");
    const queue = buildAppointmentNotificationQueue({
      userId: "61c39c17-7401-41e7-9e2d-7bed9ade60a0",
      appointmentId: "3e48090f-9854-4a2f-8984-1339d4c0ca52",
      startsAt,
    });
    expect(queue).toHaveLength(4);
    expect(new Set(queue.map((item) => item.channel))).toEqual(new Set(["email"]));
    expect(queue.filter((item) => item.event === "reminder_24h")[0]?.scheduled_for).toBe("2026-06-19T15:00:00.000Z");
    expect(queue.filter((item) => item.event === "reminder_1h")[0]?.scheduled_for).toBe("2026-06-20T14:00:00.000Z");
  });
});
