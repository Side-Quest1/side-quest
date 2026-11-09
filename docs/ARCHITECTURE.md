# SideQuest Architecture

## Current baseline

The repository is an npm workspace monorepo with two applications and one
shared product package:

```text
apps/web       Next.js App Router application
apps/mobile    Expo React Native application
packages/shared  TypeScript product types and constants
packages/ui     Centralized cross-platform UI tokens and primitives
```

The web and mobile applications are mock-backed frontend implementations. The
shared package exports domain models, validation, lifecycle rules, mock data,
and the `QuestRepository`/`MockQuestRepository` implementation. The UI package
owns shared tokens and web/native primitives. Supabase migrations and
integration remain out of scope.

The frontend redesign continues to keep brand tokens in `@sidequest/ui`; web
composition adds responsive layout and motion classes without introducing a
second business or data layer. Activity imagery remains a presentation mapping
in the web app, while quest data and lifecycle behavior continue to come from
`@sidequest/shared`.

## Target package boundaries

### `@sidequest/ui`

Owns design tokens, light/dark/system themes, theme persistence adapters,
cross-platform visual primitives, and SideQuest-specific visual components.
It must not import repositories, Supabase, navigation, or quest lifecycle
rules.

### `@sidequest/shared`

Owns domain models, enums, validation schemas, mock data, repository contracts,
mock repository behavior, and platform-independent business rules. It must not
depend on browser or native UI APIs.

### `apps/web`

Owns Next.js routes, responsive web composition, web storage adapters, and
browser-only integrations. Screens consume `@sidequest/ui` and
`@sidequest/shared` through public package exports.

### `apps/mobile`

Owns native navigation, mobile screen composition, safe-area and keyboard
behavior, and native storage adapters. Screens consume the same
`@sidequest/ui` and `@sidequest/shared` packages; they must not duplicate
design tokens or shared component contracts.

## Data flow for the prototype

Screens depend on a repository interface from `@sidequest/shared`. A local
mock repository provides quest lifecycle, coordination, profile, settings,
report, and block behavior in memory. A future backend repository can
implement the same contract without changing screen workflows.

Stage 3 creation uses the shared `QUEST_ACTIVITY_TYPES` configuration and
`validateQuestCreation` rules on both platforms. `getMyActivities` returns
separate active hosting, active joined, pending-request, and past groups.
Approval, rejection, cancellation, completion, and leave operations remain
repository operations with host and capacity checks in the shared adapter.
Mobile navigation is a single local tab state in `apps/mobile/App.tsx`, with a
safe-area-aware floating bar around the existing screen composition. It does
not introduce a second navigation library; create, activities, alerts, and
profile destinations reuse the existing repository-backed flows and modal
surfaces.

Theme tokens are centralized in `packages/ui/src/index.ts`. Web maps the
semantic tokens to root CSS variables and persists the preference in browser
storage; native UI primitives use a shared theme provider that resolves light,
dark, or system appearance. Screens retain their existing local state while
the theme changes.

Supabase is explicitly out of scope for Phase 1. The unused application
Supabase client files were removed during Stage 2 cleanup; database migrations
remain untouched.

### Application workflow boundary

Screens orchestrate user intent and render repository results; they do not
contain lifecycle rules or persistence assumptions. `QuestRepository` supports
complete quest reads and typed cursor-based `getQuestPage` queries, so a future
data adapter can add server pagination without changing screen contracts.
`MockQuestRepository` is a development-only adapter with process-local state.

Discover composes `getQuestPage` with shared category, search, budget, and
cursor inputs. Screens retain only presentation state; filtering and page
boundaries remain repository concerns. Activity details render lifecycle,
capacity, visibility, join mode, and participant data from the shared models.

The future Supabase adapter should implement the same contract, translate
transport/database failures into application-level errors, and provide
realtime delivery through an application service or subscription adapter.
Authentication, uploads, notifications, and account deletion remain backend
boundaries rather than fake local controls.

## Known compatibility risks

- The repository declares Next.js `16.4.2`, React `19.3.0`, Expo `~58.0.17`,
  React Native `0.88.0`, and TypeScript versions that should be verified as a
  compatible set before adding UI dependencies.
- A React Native-based shared UI package requires a compatible React Native Web
  setup for the Next.js application. This must be validated before choosing
  implementation details.
- The current web app has Tailwind/Turbopack configuration, while the target
  shared UI package should own semantic tokens. Mixing two token systems would
  create drift.
- The current mobile app has no navigation dependency or route structure.
- The mock repository is process-local; refreshes and restarts reset state.
- Stage 3 forms and management actions are mock-backed and do not provide
  durable persistence or server-side concurrency guarantees.
- Web and mobile currently use single-screen prototype composition rather than
  production navigation.
- Chat, notifications, reports, blocks, and logout are mock-only actions.
- The mobile app requires Expo tooling/device validation for native runtime
  behavior beyond TypeScript checks.
