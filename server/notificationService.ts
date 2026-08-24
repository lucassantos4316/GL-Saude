import { notifications } from "../drizzle/schema";

export function buildAppointmentNotificationQueue(input: { userId: number; appointmentId: number; startsAt: Date }) {
  const events = [
    { event: "confirmation" as const, scheduledFor: new Date() },
    { event: "access_link" as const, scheduledFor: new Date() },
    { event: "reminder_24h" as const, scheduledFor: new Date(input.startsAt.getTime() - 24 * 60 * 60 * 1000) },
    { event: "reminder_1h" as const, scheduledFor: new Date(input.startsAt.getTime() - 60 * 60 * 1000) },
  ];
  return events.map((event) => ({
    userId: input.userId,
    appointmentId: input.appointmentId,
    channel: "email" as const,
    status: "queued" as const,
    ...event,
  }));
}

export type NotificationInsert = typeof notifications.$inferInsert;
