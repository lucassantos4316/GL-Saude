# Supabase setup for GL Saúde

The app now uses Supabase Auth and Postgres as its application identity and data store. The old MySQL/Drizzle migrations remain in `drizzle/` as historical material; they are not applied by the app. This change does not copy existing MySQL records into Supabase.

## 1. Create the Supabase project and schema

1. Create a Supabase project and open **SQL Editor**.
2. Run [`migrations/0001_gl_saude.sql`](./migrations/0001_gl_saude.sql).
3. Confirm that the tables exist under `public`: `profiles`, `clinics`, `professionals`, `appointments`, `payments`, `clinical_documents`, and `notifications`.

The migration enables RLS on every application table. New Auth users receive a `profiles` row with the `patient` role. Role and clinic assignments are intentionally not user-editable.

## 2. Configure Auth

In **Authentication → URL Configuration**, set the local site URL to `http://localhost:3000` and add it to the allowed redirect URLs. The local server may choose another port if 3000 is already occupied; add the port printed by the server as an allowed redirect URL too. Add the production origin before deploying.

Email/password registration and password recovery use Supabase Auth. For Google sign-in, enable the Google provider under **Authentication → Providers** and configure its provider credentials and callback URL as shown in the Supabase dashboard.

Assign staff roles only from the Supabase SQL Editor or another trusted administrative path. For example, after creating the clinic and user, an administrator can assign a doctor:

```sql
update public.profiles
set role = 'doctor', clinic_id = 'CLINIC_UUID'
where id = 'AUTH_USER_UUID';

insert into public.professionals (
  user_id, clinic_id, display_name, specialty, crm, consultation_price
)
values (
  'AUTH_USER_UUID', 'CLINIC_UUID', 'Dra. Nome Sobrenome',
  'Cardiologia', 'CRM-MS 00000', 280.00
);
```

Replace both UUID placeholders with real IDs. `operator` profiles also need a `clinic_id`. Never add a user-controlled role selector to signup.

## 3. Set local environment variables

Copy `.env.example` to `.env` in the repository root and fill in the project URL and publishable/anon key from **Project Settings → API**:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY

SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

The `VITE_` pair is used by the browser. The server pair is used to validate access tokens and make requests using the caller's token, so Postgres RLS remains active. **Do not put a `service_role` key in `.env`, browser code, or any `VITE_` variable.** `.env` is ignored by Git.

For production, provide the `VITE_` values when building the client and the server values in the server's runtime environment.

Install dependencies and run the app:

```powershell
corepack pnpm install
corepack pnpm dev
```

## 4. Auth and application CRUD

- The browser client is initialized in [`client/src/lib/supabase.ts`](../client/src/lib/supabase.ts).
- The server validates the Supabase access token and loads the user's trusted profile in [`server/supabase.ts`](../server/supabase.ts) and [`server/_core/context.ts`](../server/_core/context.ts).
- Appointment create/list/update/delete examples are in [`client/src/lib/appointments.ts`](../client/src/lib/appointments.ts). Creating and rescheduling go through database functions that check the caller and prevent overlapping reservations; reads and deletes are protected by RLS.
- The patient booking and appointment history screens use the Supabase-backed tRPC procedures. New appointments remain `held` for ten minutes.

Payment confirmation is deliberately not exposed by the app: a browser must never be allowed to mark its own payment as paid. Connect a payment provider and verify its signed webhook on the server before changing payment or appointment status. The `payments` table has no client write policy.

## 5. Existing data and production rollout

The code/schema migration is in place, but the existing MySQL data is **not** transferred automatically. Before switching real users, export and back up the old database, map each MySQL user to a Supabase Auth UUID, migrate related records with those new UUIDs, and verify counts and access rules in a non-production project. Do not put patient/clinical data in Git, fixtures, or this chat.

No Supabase project credentials were available in this workspace, so the SQL has not been applied to a live project and live sign-in/CRUD could not be exercised here.
