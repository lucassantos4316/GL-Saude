import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, appointments, notifications, payments, professionals, users } from "../drizzle/schema";
import { buildAppointmentNotificationQueue } from "./notificationService";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserProfile(userId: number, name: string, email: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  await db.update(users).set({ name, email }).where(eq(users.id, userId));
  const result = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return result[0];
}

export async function listProfessionals(filters?: { specialty?: string; clinicId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.specialty) conditions.push(eq(professionals.specialty, filters.specialty));
  if (filters?.clinicId) conditions.push(eq(professionals.clinicId, filters.clinicId));
  return db.select().from(professionals).where(conditions.length ? and(...conditions) : undefined);
}

export async function listAppointmentsForPatient(patientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(appointments).where(eq(appointments.patientId, patientId));
}

export async function createHeldAppointment(input: {
  patientId: number;
  professionalId: number;
  clinicId: number;
  kind: "consultation" | "exam";
  startsAt: Date;
  endsAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const holdExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await db.insert(appointments).values({ ...input, status: "held", holdExpiresAt });
  const created = await db.select().from(appointments).where(and(eq(appointments.patientId, input.patientId), eq(appointments.startsAt, input.startsAt))).orderBy(desc(appointments.id)).limit(1);
  return created[0];
}

export async function confirmAppointmentPayment(appointmentId: number, method: "pix" | "credit_card", amount: string, gatewayReference: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(payments).values({ appointmentId, method, amount, gatewayReference, status: "confirmed", confirmedAt: new Date() });
  await db.update(appointments).set({ status: "confirmed" }).where(eq(appointments.id, appointmentId));
  const confirmed = (await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1))[0];
  if (confirmed) {
    await db.insert(notifications).values(buildAppointmentNotificationQueue({ userId: confirmed.patientId, appointmentId: confirmed.id, startsAt: confirmed.startsAt }));
  }
  return confirmed ? [confirmed] : [];
}

export async function listAppointmentsForProfessional(professionalId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(appointments).where(eq(appointments.professionalId, professionalId));
}

export async function listAllAppointments(clinicId?: number) {
  const db = await getDb();
  if (!db) return [];
  return clinicId ? db.select().from(appointments).where(eq(appointments.clinicId, clinicId)) : db.select().from(appointments);
}

