import { decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "patient", "doctor", "operator"]).default("user").notNull(),
  failedLoginAttempts: int("failedLoginAttempts").default(0).notNull(),
  lockedUntil: timestamp("lockedUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const clinics = mysqlTable("clinics", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  city: varchar("city", { length: 120 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const professionals = mysqlTable("professionals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clinicId: int("clinicId").notNull(),
  specialty: varchar("specialty", { length: 120 }).notNull(),
  crm: varchar("crm", { length: 40 }).notNull(),
  rating: decimal("rating", { precision: 2, scale: 1 }).default("5.0").notNull(),
  consultationPrice: decimal("consultationPrice", { precision: 10, scale: 2 }).notNull(),
  active: int("active").default(1).notNull(),
}, (table) => ({ clinicIdx: index("professionals_clinic_idx").on(table.clinicId), specialtyIdx: index("professionals_specialty_idx").on(table.specialty) }));

export const appointments = mysqlTable("appointments", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  professionalId: int("professionalId").notNull(),
  clinicId: int("clinicId").notNull(),
  kind: mysqlEnum("kind", ["consultation", "exam"]).notNull(),
  status: mysqlEnum("status", ["held", "pending_payment", "confirmed", "cancelled", "completed"]).default("held").notNull(),
  startsAt: timestamp("startsAt").notNull(),
  endsAt: timestamp("endsAt").notNull(),
  holdExpiresAt: timestamp("holdExpiresAt"),
  cancellationPolicy: text("cancellationPolicy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ patientIdx: index("appointments_patient_idx").on(table.patientId), scheduleIdx: index("appointments_schedule_idx").on(table.professionalId, table.startsAt) }));

export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  appointmentId: int("appointmentId").notNull(),
  method: mysqlEnum("method", ["pix", "credit_card"]).notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "failed", "refunded"]).default("pending").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  gatewayReference: varchar("gatewayReference", { length: 160 }),
  confirmedAt: timestamp("confirmedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const clinicalDocuments = mysqlTable("clinical_documents", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  professionalId: int("professionalId").notNull(),
  appointmentId: int("appointmentId"),
  type: mysqlEnum("type", ["record", "report", "prescription", "exam_request"]).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  appointmentId: int("appointmentId"),
  channel: mysqlEnum("channel", ["email", "whatsapp"]).notNull(),
  event: mysqlEnum("event", ["confirmation", "cancellation", "reminder_24h", "reminder_1h", "access_link"]).notNull(),
  status: mysqlEnum("status", ["queued", "sent", "failed"]).default("queued").notNull(),
  scheduledFor: timestamp("scheduledFor").notNull(),
  sentAt: timestamp("sentAt"),
  providerReference: varchar("providerReference", { length: 160 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Appointment = typeof appointments.$inferSelect;
export type Payment = typeof payments.$inferSelect;
