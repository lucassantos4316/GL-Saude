import type { Database } from "../client/src/lib/database.types";

type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"];

export function buildAppointmentNotificationQueue(input: {
  userId: string;
  appointmentId: string;
  startsAt: Date;
}): NotificationInsert[] {
  const events = [
    { event: "confirmation" as const, scheduled_for: new Date() },
    { event: "access_link" as const, scheduled_for: new Date() },
    {
      event: "reminder_24h" as const,
      scheduled_for: new Date(input.startsAt.getTime() - 24 * 60 * 60 * 1000),
    },
    {
      event: "reminder_1h" as const,
      scheduled_for: new Date(input.startsAt.getTime() - 60 * 60 * 1000),
    },
  ];
  return events.map((event) => ({
    user_id: input.userId,
    appointment_id: input.appointmentId,
    channel: "email" as const,
    status: "queued" as const,
    event: event.event,
    scheduled_for: event.scheduled_for.toISOString(),
  }));
}
