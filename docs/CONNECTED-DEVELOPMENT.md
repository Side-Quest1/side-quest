# Running the connected SideQuest clients

Use Node 22, npm workspaces and a disposable development Supabase project. The mobile and web clients use the signed-in user's publishable-key session. Both expose the original prototype through explicit development mode.

## Local setup

1. Run `npm ci` in the repository root.
2. With Docker running and the Supabase CLI installed, run `supabase start` from the root. Apply outstanding versioned migrations to an existing local stack with `supabase migration up --local`. Use a fresh development database for first-time setup.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `apps/web/.env.local`. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `apps/mobile/.env`. Use the development project's public API URL and publishable key. For an Android emulator, use its host gateway for the local API. A physical phone needs a reachable development endpoint.
4. Run `npm run dev:web` or `npm run dev:mobile`. For the mobile email callback use a development build registered for `sidequest://auth/callback`. Allowlist that exact callback and the development web origin in Auth settings. Open PKCE verification and recovery emails on the device where the request began. After recovery, change the password in Profile.
5. Sign up two test accounts, verify email, and set up age assurance. In an isolated local database a trusted operator can populate `sidequest_private.age_checks(user_id,birth_date)` for synthetic test users. Use known test UUIDs matching local Auth accounts. Production needs a trusted age-assurance provider and a retention policy before admission. Users under 16 and unchecked accounts cannot host or discover activities. The database separates the 16–17 cohort from adults.
6. Publish from account A, request from B, approve from A, open chat on both devices and test sign-out/restart. Profile, search, participation, reporting and chat use database-backed paths.

To run the design prototype locally, set `NEXT_PUBLIC_SIDEQUEST_MODE=mock` or `EXPO_PUBLIC_SIDEQUEST_MODE=mock` and restart the development process.

## Verification

Run `npm run qa`, `npm run test:database`, `npm run test:native-tree`, and `npm exec --workspace=apps/mobile -- expo export --platform android`. Database tests run migrations in embedded PostgreSQL with test-only Auth roles and identities. Also run multi-session tests against an isolated Supabase stack before rollout. Expo export verifies bundling. Use a development build for secure storage, OS appearance, keyboard, deep links and notification permission checks.

## Backend and release

The connected Discover screen and tuning parameters are documented in [Personalized discovery](PERSONALIZED-DISCOVERY.md). Web and mobile share a five-step activity form with per-account local drafts. Set `EXPO_PUBLIC_WEB_ORIGIN` to a public HTTPS web origin for portable mobile sharing links and QR codes. Expo Router handles entry, activity and recovery links. Test the OS scheme with a signed development build.

Enable pg_cron before applying the migrations to schedule expiration, reminders and retention. Schedule the `deliver-alerts` Edge Function separately from a trusted scheduler. Use a dedicated random `PUSH_WORKER_SECRET` bearer credential from a secret store. Deliveries require `PUSH_DELIVERY_ENABLED=true`, configured APNs/FCM credentials and registered Expo tokens. The default worker performs no sends. Enable Expo access-token security and set `EXPO_ACCESS_TOKEN` on the server where applicable. Tickets are polled for receipts, invalid devices are removed and temporary failures back off. Gateway acceptance followed by a network failure can result in duplicate delivery. Review retries, failure counts and terminal deliveries in staging before production.

Only trusted database operators can assign moderators in `sidequest_private.moderators`. A moderator session can inspect submitted reports and use `review_report(report, decision)` with `reviewing`, `resolve`, or `cancel_activity`. Moderation decisions are logged server-side. The user-facing Profile screen exposes personal report status and unblock actions.

- `packages/shared` owns validation, rules and the preview repository. `packages/adapters` owns Supabase client setup, activity reads, RPC calls and session observation. `packages/application` renders the connected workflows with controls supplied by each platform.
- `supabase/migrations` defines the database and row policies. Client roles have column-scoped writes. Joining and host decisions use the authenticated actor and lock one activity row. All scheduled timestamps use `timestamptz`. The realtime publication receives chat and in-app alert inserts on a Supabase stack.
- Enable pg_cron in the target development database before the expiration migration. If enabled later, register `select cron.schedule('sidequest-minute','* * * * *','select sidequest_private.tick()');` once as an operator. Monitor job failures. Push queue entries represent pending work and have no delivery receipt until a worker processes them.
- Serve the account-deletion Edge Function locally via `supabase functions serve delete-account`. The server validates the caller token and derives the deletion target. Keep service-role credentials in the server environment.
- Use distinct Supabase projects, redirect origins, SMTP, and client environment variables for staging and production. Review migration diffs and RLS results in staging. Take and restore a backup into an isolated project to rehearse recovery. After release approval, apply reviewed migrations and deploy the function to the explicitly selected project. Build web with `npm run build:web` and serve with the Next workspace start script. Configure EAS application identifiers, signing credentials and environments before creating signed preview or store builds.

## Isolated integration suite

Use a fresh local CLI work directory with its own project ID `sidequest-verify-XXXXXXXX` (eight lowercase hexadecimal digits), API port 55821, a free database port and the repository migrations. Enable Auth, PostgREST, Kong and Realtime. Use local email auto-confirmation with external SMTP disabled. Set `SIDEQUEST_QA_URL=http://127.0.0.1:55821`, `SIDEQUEST_QA_DB` to the disposable database container name and `SIDEQUEST_QA_ANON_KEY` to its local publishable or anonymous key. Run `npm run test:integration`. The suite creates three synthetic local accounts and writes age-check fixtures only in that named disposable container. Stop that project after the run.
