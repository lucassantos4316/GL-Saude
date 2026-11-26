# GL Saude repository instructions

## Build, test, and verification

- Install dependencies: `corepack pnpm install`
- Development server: `corepack pnpm dev`
- TypeScript check: `corepack pnpm check`
- Production build: `corepack pnpm build`
- Run the test suite: `corepack pnpm test`
- Run one test file: `corepack pnpm vitest run server/<test-file>.test.ts`
- Run tests by name: `corepack pnpm vitest run server/<test-file>.test.ts -t "<test name>"`
- Format files: `corepack pnpm format` (Prettier writes the entire repository)
- Production server after a build: `corepack pnpm start`

There is no separate lint script. Vitest discovers `server/**/*.test.ts` and `server/**/*.spec.ts` through `vitest.config.ts`; browser/React tests are not currently configured.

## Setup and environment

- Copy `.env.example` to `.env`.
- Supabase requires browser variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, plus server variables `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
- Never put a Supabase `service_role` key in `.env`, browser code, or a `VITE_*` variable.
- Apply `supabase/migrations/0001_gl_saude.sql`, then `supabase/migrations/0002_patient_profiles_and_dependents.sql`, in a Supabase SQL Editor for an active schema. The files in `drizzle/` are historical MySQL material and are not applied by the running app.
- The current terms/privacy consent version is `draft-2026-10-28`. Update the shared registration code and SQL migration together when clinic-approved documents change.

## Architecture

- `client/src/App.tsx` owns Wouter routes. `client/src/main.tsx` initializes Supabase, TanStack Query, and the tRPC React client.
- `client/src/pages/Home.tsx` is the main role-based application shell. `ClinicHub.tsx`, password recovery, login, dashboards, booking, and profile management are split across pages and `client/src/components/`.
- The browser uses tRPC hooks from `client/src/lib/trpc.ts`; the HTTP link sends the Supabase access token as a Bearer header.
- `server/_core/index.ts` serves Express on port 3000 or the next available port. tRPC is mounted at `/api/trpc`; development mode adds Vite middleware, while production serves `dist/public`.
- `server/routers.ts` defines the application API and Zod input validation. `server/_core/trpc.ts` provides `publicProcedure`, `protectedProcedure`, `roleProcedure`, and `adminProcedure`.
- `server/_core/context.ts` resolves the authenticated user by validating the Supabase access token and loading the trusted `public.profiles` row.
- `server/db.ts` is the Supabase data-access layer. It is responsible for profile, patient, professional, and appointment queries; pass the request-bound Supabase client through so RLS remains effective.
- `client/src/lib/database.types.ts` contains generated-style Supabase table types. Keep it aligned with schema changes, rather than casting Supabase results to ad-hoc shapes.
- `shared/` contains code and types used by both browser and server, notably registration validation and role types.
- Supabase migrations define RLS policies and database functions used for consent, dependent authorization, and held appointments. Server code must not bypass these protections.

## Role and authorization conventions

- Supported roles are `patient`, `doctor`, `operator`, and `admin`, defined by `shared/types.ts`.
- Apply role checks with `roleProcedure(...)` for role-specific tRPC operations. Authentication-only operations use `protectedProcedure`; public catalog operations use `publicProcedure`.
- UI visibility is not authorization: protected mutations and reads must also have server-role checks and rely on Supabase RLS.
- Assign roles and `clinic_id` values only through a trusted administrative path, not a signup role selector.
- Operators/admins use clinic-scoped schedules. Doctors resolve agenda entries through their `professionals.user_id`; patients resolve their own appointments and patient profiles.
- Adult dependent and account-consent handling is restricted by both tRPC procedures and migration-defined RLS/functions. Do not weaken the rule that adult dependents require consent verification before booking.

## Supabase and data conventions

- Client-side Supabase access is initialized in `client/src/lib/supabase.ts`. Server-side request clients are created in `server/supabase.ts` using the caller's Bearer token.
- Database operations use snake_case column names from Postgres; tRPC and TypeScript-facing objects commonly use camelCase fields. Preserve the conversion in `server/db.ts`.
- Patient profiles distinguish `is_self` from dependents. Dependent records are archived with `active = false` rather than deleted when relationship data may be needed historically.
- Appointment creation/rescheduling uses Supabase RPC functions and ISO timestamps. Held appointments expire after ten minutes; payment status must not be set by a browser mutation.
- RLS and RPC behavior are security boundaries. When changing clinical, patient, booking, or role behavior, update migration SQL and relevant server authorization tests together.

## UI conventions

- The app uses React 19, TypeScript, Tailwind CSS 4, Radix primitives, and components under `client/src/components/ui/`.
- Import application modules with `@/` and shared modules with `@shared/`; the aliases are configured in Vite and TypeScript.
- tRPC mutations and queries should keep loading, success, and error feedback accessible. Existing screens use TanStack Query through tRPC and Sonner for notifications.
- `.github/agents/gestao-perfis-saude.agent.md` is an existing repository-specific agent for patient/doctor/operator/admin navigation and profile actions. Keep profile behavior, role scope, and navigation subcategories consistent with that agent's rules.
