# SideQuest Development Log

## 2026-11-24 · Connected implementation in progress

- Phase A: reproduced same-line JSX whitespace compiling to a string under the My Activities native View. Removed the child, added a compiled-tree regression check, tightened schedule validation, and corrected theme hydration and mobile refresh paths.
- Phases B–D: introduced connected client and application workspaces, explicit development preview mode, email sessions, UTC activity storage, age-cohort policies and row-locked participation. Development test identities require trusted local provisioning.
- Phases E–G: added durable chat, membership alerts, attendance, safety reports, blocks, local database tests, an expiration job and a CI workflow. Hosted services, native runtime, delivery and release verification remain pending.

Record a timestamped entry here after every repository change. Use the local
date and time with the UTC offset, and briefly describe the files or behavior
affected.

## 2026-11-17 09:45:03 +05:30

### Fixed iOS runtime safety, storage fallback, and mobile safe areas

- Replaced the deprecated React Native `SafeAreaView` with
  `react-native-safe-area-context`, added `SafeAreaProvider` at the app root,
  and applied top/bottom insets to the main scroll surface, full-page screens,
  and persistent bottom navigation. This prevents headers and back controls
  from entering the status-bar/notch area while preserving scroll reachability.
- Audited the mobile and shared native JSX tree for raw text under native
  containers. All literal labels are now confirmed to render through `Text` or
  shared controls that provide a `Text` wrapper; no raw JSX text remains under
  `View`, `Pressable`, `ScrollView`, keyboard, or safe-area containers.
- Aligned AsyncStorage with the Expo SDK 58 documented Expo Go version
  (`2.2.0`) in both mobile and shared UI dependencies. Theme storage failures
  now fall back to the System/current-session preference, retain theme
  switching, and emit at most one diagnostic warning instead of logging on
  every render.
- Added the Expo-compatible safe-area dependency and restored `tsx` as an
  explicit root development dependency so the existing shared QA script does
  not depend on an undeclared transitive install.
- Verification: mobile/UI typechecks passed, Android Expo export passed,
  `git diff --check` passed, and the static JSX audit found no native
  container text violations. Full QA passed through all tests, typechecks,
  lint, and web compilation, but the final Next.js build was stopped by the
  existing Next.js security-vulnerability guard; no unrelated web dependency
  upgrade was applied.
- iOS Simulator/device execution was unavailable on the Windows environment.
  The iOS launch command reached Metro startup but could not provide an
  actual iOS runtime session; Expo Go persistence and visual behavior remain
  to be verified on an iOS device/simulator.

## 2026-11-09 13:18:15 +05:30

### Completed mobile full-page navigation and final frontend polish

- Replaced the mobile popup presentation for Activity Details, Create Activity,
  My Activities, Profile/Settings, and Coordination with opaque, full-viewport
  navigation surfaces. Existing state, repository actions, theme updates, and
  Android back handling remain in place.
- Added consistent Back controls for secondary screens and kept the five-item
  bottom navigation limited to the main Discover, My Activities, Create,
  Alerts, and Profile destinations.
- Preserved the prominent Quest Lime Create action with explicit Deep Forest
  icon and label contrast, including pressed-state opacity and weight.
- Corrected selected non-Create navigation foreground colors and applied active
  theme text colors to participant and activity rows.
- Completed the mobile semantic theme audit: dark surfaces use near-black,
  primary, and elevated hierarchy tokens; screen backgrounds, inputs, cards,
  dialogs, status areas, and nested content follow the active Light, Dark, or
  System theme.
- Added responsive web theme handling, persisted/system theme resolution,
  reduced-motion behavior, and slim rounded theme-aware scrollbars without
  disabling native or nested scrolling.
- Updated shared activity validation, repository operations, mock data,
  activity grouping, host management, participant management, and tests for
  creation, capacity, approvals, cancellation, completion, leaving, and
  grouping.
- Updated README and architecture documentation with the Stage 3 scope,
  navigation model, theme architecture, scrollbar behavior, validation
  commands, and known mock-only limitations.
- Verification completed: `npm run qa`, 14/14 shared tests, all TypeScript
  checks, web lint, web production build, Android Expo export, mobile
  typecheck, `git diff --check`, and HTTP 200 checks for the running web
  server at `http://localhost:3000` and Expo Metro at `http://localhost:8083`.
- Physical-device or simulator visual testing remains unavailable. The mobile
  implementation was validated through source inspection, TypeScript checks,
  and Android bundle export; no Supabase, authentication, or backend
  persistence was added.

## 2026-11-09 10:41:03 +05:30

### Completed Stage 3 activity creation and My Activities pass

- Added shared activity-type definitions, team-sport details, schedule and
  capacity validation, duplicate pending-request protection, and the typed
  `getMyActivities` repository operation.
- Expanded web and mobile creation forms with field validation, loading and
  retry/error states, optional cost, join mode, visibility, schedule,
  location, capacity, and type-specific team size.
- Added active hosting, joined, pending, and past activity groupings with
  details navigation, host approval/rejection, full-capacity safeguards,
  cancellation, completion, and participant leave actions.
- Added shared tests for creation validation, grouping, duplicate requests,
  capacity-safe approval, and host permissions.
- The implementation remains process-local mock behavior; no authentication,
  persistence, Supabase integration, or backend concurrency guarantees were
  added.
- Added the persistent mobile five-item bottom navigation with Discover, My
  Activities, Create, Alerts, and Profile destinations. The bar uses Forest,
  Ivory, and Lime styling, enlarged center Create affordance, labeled
  touch targets, content bottom padding, and modal-aware visibility.
- Reworked shared semantic color tokens for light and dark themes, added web
  CSS-variable theme application with persisted/system preference handling, and
  added a native theme provider for themed inputs, buttons, cards, badges,
  activity cards, and status-bar styling. Dark-mode selectors also cover the
  existing web composition classes so text remains visible during transitions.

## 2026-11-04 13:28:17 +05:30

### Completed Stage 2 Discover and details pass

- Wired web Discover to the typed cursor-based repository page contract with
  initial loading, load-more state, retry behavior, and combined category,
  search, and budget filters.
- Added filter reset and a meaningful budget-aware “I’m free” reset flow.
- Wired mobile Discover to the same paged repository contract with refresh,
  load-more, combined filters, and native touch-friendly filter controls.
- Expanded web and mobile activity details with lifecycle status, join mode,
  visibility, capacity, schedule, location, host, and participant information.
- Added shared coverage for combined page filters and cancelled/expired
  membership restrictions.
- Preserved the existing mock adapter, user changes, app configuration, and
  Supabase boundary; no backend work or credentials were added.

## 2026-11-04 12:33:30 +05:30

### Completed workflow readiness pass

- Added typed cursor-based quest pagination and filtering to the shared
  `QuestRepository` contract and mock adapter.
- Added coverage for paged search results and continuation cursors.
- Made pending requests cancellable and joined quests leavable from web and
  mobile membership actions, including full-quest cases.
- Added duplicate-submit guards for membership actions.
- Made the web and mobile “I’m free” controls clear active discovery filters
  instead of acting as decorative controls.
- Added selected-state accessibility metadata to category controls and dialog
  semantics to the web quest details surface.
- Updated the root shared test script so `npm run qa` uses the repository’s
  installed `tsx` runner without changing the existing shared package work.
- Documented the development adapter limits and future Supabase adapter
  boundary. No credentials, migrations, or backend implementation added.
- Verified the Expo Android bundle with `expo export --platform android`.
- Expo web export remains unavailable because the mobile workspace does not
  install React Native Web dependencies; this does not affect native Android
  bundling or the existing mobile typecheck.

## 2026-11-04 12:08:48 +05:30

### Started frontend redesign foundation

- Created the `feature/frontend-redesign` branch without changing the existing
  mock-backed workflows.
- Refined web typography to use Manrope for headings and Inter for body text.
- Aligned web global tokens and selection styling with the Forest & Lime brand.
- Added reduced-motion-safe entrance and quest-card interaction transitions.
- Added loading semantics to the shared web Button primitive.
- Replaced invalid travel, music, and movie Unsplash mappings with valid image
  URLs.
- Removed emoji metadata from the shared web QuestCard in favor of accessible
  text labels.
- Updated README and architecture notes to document the redesign foundation.

## 2026-10-30 14:22:32 +05:30

### Logged remaining Phase 1 review status

- Recorded the remaining manual-review limitation: native Expo device or
  simulator validation still requires an environment with the Expo CLI and a
  device or simulator.
- Confirmed no additional application changes were made after the web smoke
  test and responsive modal fix.
- Browser pages were not shared in the current session, so no additional
  browser review was performed.
- Supabase remains postponed, and all repository changes remain uncommitted
  and unpushed.

## 2026-10-30 14:00:45 +05:30

### Completed Phase 1 review smoke test

- Ran a browser smoke test against the local web application.
- Verified Profile & Settings opens, Create Quest opens, quest details expose
  coordination, and a local group-chat message renders.
- Fixed responsive web modal containers so long Profile/Settings and
  coordination content scrolls within the viewport and keeps controls
  accessible.
- Re-ran `npm run qa`: all 8 shared tests, shared/UI/web/mobile typechecks,
  web lint, and web production build passed.
- Confirmed `git diff --check` remains clean.
- Expo CLI runtime validation could not run because the `expo` executable is
  unavailable in the current environment; mobile TypeScript validation passed.
- No Supabase, authentication, persistence, realtime, or migration changes
  were introduced.
- All changes remain uncommitted and unpushed.

## 2026-10-30 13:54:32 +05:30

### Completed Stage 9 final QA and Phase 1 stabilization

- Added the root `qa` script covering shared tests, shared/UI/web/mobile
  typechecks, web lint, and the web production build.
- Added focused root scripts for web/mobile typechecks, web lint, and web
  build.
- Expanded shared QA coverage for invalid quest creation inputs and invalid
  filters; the complete suite now contains 8 passing tests.
- Updated the README with the implemented Phase 1 scope, setup instructions,
  focused validation commands, and explicit mock-only limitations.
- Updated architecture and phase-plan documentation to reflect the completed
  mock-backed prototype and remaining native-device review boundary.
- Confirmed no Supabase references or Supabase-related installed dependencies
  remain under the application/package implementation.
- Verification completed: `npm run qa`, 8/8 shared tests, and
  `git diff --check`.
- Automated checks pass. Native device/navigation review remains a manual
  follow-up because no simulator/device session was available.
- All changes remain uncommitted and unpushed.

## 2026-10-30 13:47:04 +05:30

### Implemented Stage 8 profile, settings, and safety surfaces

- Added shared mock support for editable profiles, account settings, theme
  preferences, notification preferences, blocked-user management, and report
  history/status.
- Added consistent web and mobile Profile/Settings experiences.
- Added editable display name, city, and bio fields.
- Added hosted, joined, and completed quest history summaries.
- Added Light, Dark, and System theme preference controls.
- Added mock notification preference controls.
- Added blocked-user and report count/status summaries.
- Added a logout placeholder with no authentication or persistence changes.
- Added shared behavior coverage for profile updates, account settings,
  blocking, unblocking, and report history.
- Kept authentication, notifications, persistence, Supabase, and migrations
  out of scope.
- Verification completed: 7/7 shared tests, shared/UI/web/mobile typechecks,
  web lint, web production build, and `git diff --check`.
- All changes remain uncommitted and unpushed.

## 2026-10-30 13:40:05 +05:30

### Implemented Stage 7 coordination experience

- Added mock repository support for activity chat, participant retrieval,
  host-controlled participant status updates, reports, and blocks.
- Added blocked-user filtering to local quest chat without introducing
  realtime infrastructure or Supabase.
- Added coordinated quest detail panels on web and mobile with schedule,
  location, capacity, participant status, group messages, report, and block
  actions.
- Added host controls to mark participants as left and corrected pending
  request loading to use hosted quests.
- Added shared behavior coverage for chat, participant status, reports, and
  blocks.
- Verification completed: 6/6 shared tests, shared/UI/web/mobile typechecks,
  web lint, web production build, and `git diff --check`.
- All changes remain uncommitted and unpushed.

## 2026-10-30 13:33:31 +05:30

### Completed Stage 6 management actions

- Added host approval and rejection controls for pending join requests in the
  web and native My Quests surfaces.
- Added completed quest recap rendering from the shared repository response.
- Corrected recap rendering to use the canonical `ActivityRecap` fields and
  the shared native theme token.
- Verification completed: web and mobile TypeScript checks, web lint, web
  production build, and `git diff --check`.
- Changes remain uncommitted and unpushed.

## 2026-10-30 13:32:04 +05:30

### Implemented Stage 6 quest lifecycle surfaces

- Extended the web and native Discover experiences with Create Quest and My
  Quests workflows.
- Wired quest creation through shared `QuestCreationInput` validation and the
  existing `QuestRepository` contract.
- Added hosted quest completion and cancellation actions, participant leave
  actions, and completed-quest recap display on both platforms.
- Preserved Supabase and database migration boundaries; no backend integration
  was added.
- Verification completed: shared repository tests (5/5), shared and UI
  typechecks, web and mobile TypeScript checks, web lint, web production build,
  and `git diff --check`.
- All changes remain uncommitted and unpushed.

## 2026-10-26 13:03:16 +05:30

### Added development logger

- Created this file at `docs/DEVELOPMENT-LOG.md`.
- Established the convention of recording the date, time, and changes after
  each repository update.

### Previously completed changes

- Added shared SideQuest design tokens, quest types, categories, and mock quest
  data in `packages/shared/src/index.ts`.
- Added shared package dependencies and TypeScript verification scripts to the
  workspace manifests.
- Replaced the default web starter screen with a responsive mock Discover
  experience in `apps/web/src/app/page.tsx`.
- Replaced the default mobile starter screen with a matching Discover
  experience in `apps/mobile/App.tsx`.
- Updated web metadata and brand styles in `apps/web/src/app/layout.tsx` and
  `apps/web/src/app/globals.css`.
- Verified shared and mobile typechecks, targeted web linting, the web
  production build, and diff formatting.
- Confirmed that Supabase integration and database migrations are not yet
  configured.

## 2026-10-26 13:39
- Installed @supabase/supabase-js in apps/web and apps/mobile.
- Installed @react-native-async-storage/async-storage and react-native-url-polyfill for  mobile Supabase integration.
- Updated Expo from 58.0.17 to 58.0.19.
- Verified installed dependency versions using npm ls.
- Verified Expo dependency compatibility using npx expo install --check.
- Dependency audit reports 5 high-severity vulnerabilities; investigation is pending.
- Created a Supabase project.
- Supabase client configuration, environment variables, database migrations, authentication, and Row Level Security are still pending verification or implementation.

## 2026-10-30 12:35:30 +05:30

### Completed Stage 1 audit documentation

- Added `docs/ARCHITECTURE.md` with the current repository baseline, target
  package boundaries, prototype data flow, and compatibility risks.
- Added `docs/PHASE-1-PLAN.md` with verified versions and scripts, staged
  implementation order, approval boundary, and Stage 2 acceptance criteria.
- Confirmed the tracked repository is still a minimal Next.js, Expo, and shared
  TypeScript skeleton.
- Confirmed that Supabase migrations and functions are absent.
- Left the existing untracked Supabase client files unchanged because Supabase
  is out of scope for Phase 1 and those files require separate review.
- No application behavior or dependencies were changed in this stage.
- Verification performed: inspected workspace manifests, TypeScript configs,
  Next.js and Expo configs, README, git ignore rules, lockfile version entries,
  tracked status, and Supabase directories.
- Remaining issue: Stage 2 requires approval before creating `packages/ui`.

## 2026-10-30 12:42:23 +05:30

### Cleaned up unused Supabase clients and implemented Stage 2 UI foundation

- Removed unused `apps/web/src/lib/supabase.ts` and
  `apps/mobile/lib/supabase.ts`.
- Left all Supabase migrations and backend directories unchanged.
- Created the centralized `@sidequest/ui` package under `packages/ui`.
- Added shared spacing, radii, colors, semantic light/dark themes, and
  component contracts.
- Added web and native implementations for Button, Input, Badge, Card,
  EmptyState, LoadingState, and ThemePreview.
- Added a web component showcase module.
- Added `@sidequest/ui` to the web and mobile workspace manifests.
- Added the `typecheck:ui` root script.
- Updated architecture and phase-plan documentation to reflect the completed
  cleanup and Stage 2 implementation boundary.
- Verification pending: install workspace links, then run UI/shared/mobile
  typechecks and web validation.

### Validation follow-up

- Workspace links were installed successfully.
- The initial typecheck commands exposed a pre-existing tooling gap: the root
  manifest did not declare TypeScript even though root scripts invoke `tsc`.
- Added root TypeScript `^5.8.3` so shared package checks can run from the
  workspace root.
- UI package typechecks initially exposed missing React and React Native
  package declarations; added explicit peers and local development dependencies
  to `packages/ui/package.json` before retrying validation.
- The next UI typecheck exposed that this React Native version does not export
  `TextInputStyle`; changed the shared native Input prop to use the supported
  `StyleProp<TextStyle>` type.

### Stage 2 verification completed

- Shared UI typecheck passed with `npm run typecheck:ui`.
- Shared product typecheck passed with `npm run typecheck:shared`.
- Mobile consumer typecheck passed with `npx tsc --noEmit -p
  apps/mobile/tsconfig.json`.
- Web production build passed with `npm run build --workspace=apps/web`.
- Full web lint passed with `npm run lint --workspace=apps/web`.
- Targeted lint for `apps/web/src/app/page.tsx` passed.
- `git diff --check` passed.
- Confirmed both Supabase client files are removed and no application imports
  reference them.
- Confirmed all three documentation files remain in the working tree.
- Remaining limitation: the shared showcase is a Stage 2 component showcase,
  not yet the full Discover and quest workflow implementation.

## 2026-10-30 13:03:47 +05:30

### Implemented Stage 3 shared product package

- Expanded `@sidequest/shared` with typed user, quest, participant, filter,
  report, block, chat, and recap models.
- Added centralized quest categories, statuses, and current-user constants.
- Added ten realistic mock quests covering active, full, completed, and
  cancelled lifecycle states, plus mock profiles and participants.
- Added dependency-free validation for quest creation, updates, and filters.
- Added pure join, leave, capacity, completion, and lifecycle business rules.
- Added the `QuestRepository` contract and `MockQuestRepository`
  implementation with join requests, approvals, rejection, leaving, updates,
  completion, and capacity enforcement.
- Kept Supabase and database migrations untouched.
- Verification pending: run shared, UI, mobile, and web checks.
- Initial shared typecheck exposed readonly-array inference in the repository
  constructor; normalized constructor inputs with mapped clones before retrying.
- Refined `MockQuestRepository.joinQuest` to reject approval-mode quests and
  direct callers to `requestToJoin`, keeping the two join workflows explicit.

### Stage 3 verification completed

- `npm run typecheck:shared` passed.
- `npm run typecheck:ui` passed.
- Mobile and web TypeScript checks passed.
- Web production build passed.
- Web lint passed.
- `git diff --check` passed.
- Confirmed no Supabase references remain under `apps/` or `packages/`.
- Remaining limitation: application screens have not yet been migrated to the
  new repository contract; that is planned for the next stage.

## 2026-10-30 13:10:20 +05:30

### Started Stage 4 web Discover integration

- Added executable shared repository tests covering capacity limits, duplicate
  joins, approval requests, leaving, host permissions, and completion rules.
- Added the shared web `QuestCard` component contract and export.
- Replaced the web showcase entry point with a repository-backed Discover page.
- Added featured and nearby quest sections, category filtering, search,
  participant details, capacity indicators, and join/request-to-join actions.
- Added loading, empty, error, retry, and membership feedback states.
- Kept mobile on the shared domain/repository packages and did not connect
  Supabase.
- Initial verification exposed Node TypeScript import-resolution and a React
  lint rule around synchronous effect state updates; these were corrected by
  using explicit shared `.ts` imports and initializing the prototype from the
  shared mock snapshot.
- The behavior test fixture exposed that custom quest seeds were using the
  default participant seed; the mock repository now derives participants from
  supplied quests when no participant seed is provided.
- Restored extensionless shared imports for TypeScript bundler compatibility
  and configured the Node test command to resolve them at runtime.
- Native Node specifier resolution remained incompatible with the shared
  extensionless TypeScript imports, so added the minimal `tsx` development test
  runner and changed the shared test script to use it.

### Stage 4 verification completed

- Shared repository tests passed: 4 tests covering instant joins, capacity,
  duplicate joins, approval requests, approvals, leaving, host permissions,
  and completion transitions.
- `npm run typecheck:shared` passed.
- `npm run typecheck:ui` passed.
- Web TypeScript check passed.
- Mobile TypeScript check passed.
- Web production build passed.
- Web lint passed.
- `git diff --check` passed.
- Remaining limitation: mobile still uses its existing showcase entry point;
  it retains the same shared repository/domain package and will be expanded
  after the web Discover workflow is reviewed.

## 2026-10-30 13:21:00 +05:30

### Implemented Stage 5 mobile Discover integration

- Added the native `QuestCard` renderer under `@sidequest/ui`.
- Replaced the mobile component showcase with a repository-backed Discover
  screen in `apps/mobile/App.tsx`.
- Added featured and nearby quest sections, search, category filters, quest
  details modal, participant information, capacity indicators, instant joins,
  approval requests, joined/pending states, refresh/loading, empty, error, and
  retry states.
- Reused `MockQuestRepository`, shared domain models, shared categories, and
  shared UI tokens/components; no web components or duplicated design tokens
  were used in the mobile screen.
- Kept all changes uncommitted and did not connect Supabase.
- Verification pending: run shared tests, UI/shared/mobile/web typechecks,
  web lint, web build, and diff checks together.
- Validation exposed that the native QuestCard subpath did not export the
  shared QuestCardData contract; moved that type into a platform-neutral module
  and re-exported it from both web and native QuestCard modules.

### Stage 5 verification completed

- Shared repository behavior tests passed: 4 tests.
- Shared package typecheck passed.
- Shared UI package typecheck passed.
- Mobile TypeScript check passed.
- Web TypeScript check passed.
- Web lint passed.
- Web production build passed.
- `git diff --check` passed.
- Confirmed no Supabase references were added under `apps/` or `packages/`.
- All changes remain uncommitted and unpushed.

## Connected discovery and verification · November 24, 2026

Both clients now consume the authenticated recommendation RPC. The connected experience includes an image-led feed, approximate-area map, five-step drafts, profile preferences, interaction controls, native routing, invitation sharing and QR codes. Local Auth/PostgREST tests exercised three sessions and the last-seat race. Edge checked seven screen widths. The exact worktree inventory and remaining release dependencies are in [Verification](VERIFICATION.md). Ranking weights, measurement definitions and QA setup are in [Personalized discovery](PERSONALIZED-DISCOVERY.md).

## November 27, 2026 — Recovery and navigation stabilization

- Added an account-specific checkpoint before onboarding submission. Retry restores display name, city, interests, and the selected approximate area; date of birth is not persisted locally.
- Save discovery preferences and optional age verification before the profile completion signal. Preserve the checkpoint until all steps succeed, and expose Retry when setup loading fails.
- Grouped quest participation, directions, and chat controls with pending/joined guidance in the shared web/mobile workflow.
- Reserved scrollbar space in the web root to prevent horizontal navigation shifts when switching between short Alerts content and longer Profile/Discover pages. The navigation remains fixed outside the content entrance animation.
- Suggested shorter navigation labels: Quests (recommended), My Plans, Joined, or Activity. The current My Activities label is unchanged pending selection; Joined does not describe hosted quests fully.
- Existing pending work included in this repository checkpoint covers connected Supabase workflows and migrations, Expo routing, discovery preferences, maps/directions, quest chat, age verification, demo activities, imagery, and shared schedule validation. This entry does not certify those entire workflows as runtime-tested.
- Excluded local Supabase CLI linkage/cache files from version control; environment files and build output remain ignored.
- Staged-file review found trailing spaces in the two bundled font licenses; removed those spaces without changing license text.

### Confirmed verification

- Onboarding recovery tests: 7 passed, exit 0.
- Shared repository tests: 16 passed, exit 0.
- Native JSX tree check: 1 passed, exit 0 (static validation only).
- Web, mobile, and UI typechecks: exit 0.
- Android export: exit 0; bundle generated successfully.
- Web production build after the scrollbar fix: exit 0.
- `git diff --check`: exit 0, with existing LF/CRLF conversion warnings.
- Web lint: exit 1. Existing `apps/web/src/app/demo/page.tsx` errors: line 23 synchronously updates state inside an effect; line 27 uses an internal anchor instead of Next Link.

### Remaining verification limits

- Browser automation host was unavailable; navigation stability and signed-in onboarding recovery have not been visually verified in this pass.
- No physical-device runtime verification was performed. Android export and the JSX check do not establish runtime correctness.
- New checkpoints cannot identify historical partial onboarding saves created before this recovery implementation.
- User requested committing and pushing all current project changes on the existing branch; no database deployment is part of this push.
