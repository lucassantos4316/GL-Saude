import { describe, expect, it } from "vitest";
import { buildAppointmentNotificationQueue } from "./notificationService";

describe("appointment notification queue", () => {
  it("creates confirmation, access and two reminder events for email", () => {
    const startsAt = new Date("2026-06-20T15:00:00.000Z");
    const queue = buildAppointmentNotificationQueue({ userId: 7, appointmentId: 11, startsAt });
    expect(queue).toHaveLength(4);
    expect(new Set(queue.map((item) => item.channel))).toEqual(new Set(["email"]));
    expect(queue.filter((item) => item.event === "reminder_24h")[0]?.scheduledFor.toISOString()).toBe("2026-06-19T15:00:00.000Z");
    expect(queue.filter((item) => item.event === "reminder_1h")[0]?.scheduledFor.toISOString()).toBe("2026-06-20T14:00:00.000Z");
  });
});
