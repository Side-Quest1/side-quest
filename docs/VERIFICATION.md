# SideQuest verification

## Results on Windows, November 24, 2026

Shared domain tests passed 16/16, embedded PostgreSQL and push gateway suites passed 3/3, and the native JSX tree check passed 1/1. The web, mobile, UI and shared TypeScript commands, web ESLint, Next production build, Expo Android export and Git whitespace check each completed with exit code 0.

The dedicated local Supabase stack applied all 18 migrations. Three separate Auth sessions exercised the actual adapters and PostgREST. Exactly one concurrent approval obtained the final seat. The test also covered discovery, pending membership, capacity, chat persistence, Realtime delivery, in-app alerts and cancellation. The Realtime test waits for Postgres Changes registration before publishing the test message.

An Edge browser ran the production web UI against an intercepted API fixture. The seven requested viewport widths passed overflow checks on sign-in, Discover, activity detail, My Activities, Profile, Alerts and Create. The test exercised full-page filter and draft restoration, pagination, map selection, QR display, a pending request, a local future date, rejection of a past date and system dark mode. A 320px overflow found during testing was corrected by allowing grid tracks to shrink.

Five first-page queries against 1,000 additional fixture activities took 1,897, 1,137, 2,289, 2,395 and 1,516 ms on the final embedded database run under concurrent load. The median was 1,897 ms. These timings are specific to PostgreSQL WASM on this machine. Conversion, production latency, accessibility with assistive technology and native frame rate remain unmeasured.

Production dependency audit at the high threshold returned 0 with three moderate findings in the Expo fingerprint/minimatch chain. Physical Android/iOS behavior, signed builds, hosted deployment, age-provider integration, account recovery email, real push transport, and backup restoration still require verification.

## Worktree inventory

The original preview used fixed create dates and refreshed from an unfiltered quest list. The connected clients use local-calendar defaults, validate the local scheduled instant, restore filter and page state, and read pending participation from the database. The native My Activities header included a literal space-only child of a View. Its removal is covered by the compiled-tree check. Device reproduction remains outstanding.

The original local PostgreSQL database was inspected read-only. It contains legacy profiles, quests, quest_participants and quest_invites tables. Both profiles and quests contained zero rows. For any populated installation, rehearse the cutover on a backup and reconcile identifiers, visibility, pending requests, invitations, budget currencies, and age assurance before switching clients. The connected migrations target a fresh database. They do not import historical records.

Paths below include pre-existing uncommitted edits and this implementation, relative to the repository root.

- `.env.example`
- `.github/workflows/verify.yml`
- `README.md`
- `apps/mobile/App.tsx`
- `apps/mobile/Connected.tsx`
- `apps/mobile/app.json`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/activity/[id].tsx`
- `apps/mobile/app/auth/callback.tsx`
- `apps/mobile/app/index.tsx`
- `apps/mobile/device-alerts.tsx`
- `apps/mobile/eas.json`
- `apps/mobile/index.ts`
- `apps/mobile/package.json`
- `apps/mobile/session.tsx`
- `apps/mobile/test/native-tree.test.cjs`
- `apps/web/package.json`
- `apps/web/src/app/activity/[id]/page.tsx`
- `apps/web/src/app/activity/[id]/view.tsx`
- `apps/web/src/app/connected.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/test/discovery-browser.py`
- `docs/ARCHITECTURE.md`
- `docs/CONNECTED-DEVELOPMENT.md`
- `docs/DEVELOPMENT-LOG.md`
- `docs/PERSONALIZED-DISCOVERY.md`
- `docs/VERIFICATION.md`
- `package-lock.json`
- `package.json`
- `packages/adapters/package.json`
- `packages/adapters/src/index.ts`
- `packages/adapters/src/recommendations.ts`
- `packages/adapters/src/use-account.ts`
- `packages/application/package.json`
- `packages/application/src/account-history.tsx`
- `packages/application/src/activity-editor.tsx`
- `packages/application/src/discovery.tsx`
- `packages/application/src/live-activities.tsx`
- `packages/application/src/preferences.tsx`
- `packages/application/src/share.ts`
- `packages/shared/src/imagery.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/repository.ts`
- `packages/shared/src/validation.ts`
- `packages/shared/test/repository.test.ts`
- `packages/ui/assets/Inter-OFL.txt`
- `packages/ui/assets/Inter-latin.woff`
- `packages/ui/assets/Inter.ttf`
- `packages/ui/assets/Manrope-OFL.txt`
- `packages/ui/assets/Manrope-latin.woff`
- `packages/ui/assets/Manrope.ttf`
- `packages/ui/assets/trail.jpg`
- `packages/ui/package.json`
- `packages/ui/src/native.tsx`
- `supabase/.temp/cli-latest`
- `supabase/config.toml`
- `supabase/functions/delete-account/index.ts`
- `supabase/functions/deliver-alerts/dispatch.mjs`
- `supabase/functions/deliver-alerts/index.ts`
- `supabase/migrations/202611240001_activity_core.sql`
- `supabase/migrations/202611240002_coordination.sql`
- `supabase/migrations/202611240003_discovery.sql`
- `supabase/migrations/202611240004_invites.sql`
- `supabase/migrations/202611240005_delivery.sql`
- `supabase/migrations/202611240006_expiration.sql`
- `supabase/migrations/202611240007_host_edits.sql`
- `supabase/migrations/202611240008_recommendation_signals.sql`
- `supabase/migrations/202611240009_recommendation_feed.sql`
- `supabase/migrations/202611240010_discovery_controls.sql`
- `supabase/migrations/202611240011_activity_details.sql`
- `supabase/migrations/202611240012_feed_privileges.sql`
- `supabase/migrations/202611240013_discovery_measurement.sql`
- `supabase/migrations/202611240014_push_delivery.sql`
- `supabase/migrations/202611240015_coordination_and_safety.sql`
- `supabase/migrations/202611240016_discovery_limits.sql`
- `supabase/migrations/202611240017_group_eligibility.sql`
- `supabase/migrations/202611240018_check_in.sql`
- `supabase/test/core.test.mjs`
- `supabase/test/local-stack.ts`
- `supabase/test/push.test.mjs`
- `supabase/test/recommendations.test.mjs`
