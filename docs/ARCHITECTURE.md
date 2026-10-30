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

The web and mobile applications are mock-backed Phase 1 prototypes. The
shared package exports domain models, validation, lifecycle rules, mock data,
and the `QuestRepository`/`MockQuestRepository` implementation. The UI package
owns shared tokens and web/native primitives. Supabase migrations and
integration remain out of scope.

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

Supabase is explicitly out of scope for Phase 1. The unused application
Supabase client files were removed during Stage 2 cleanup; database migrations
remain untouched.

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
- Web and mobile currently use single-screen prototype composition rather than
  production navigation.
- Chat, notifications, reports, blocks, and logout are mock-only actions.
- The mobile app requires Expo tooling/device validation for native runtime
  behavior beyond TypeScript checks.
