# SideQuest Phase 1 Plan

## Stage 1 audit result

### Verified repository state

- npm workspaces are configured for `apps/*` and `packages/*`.
- The web application is a minimal Next.js App Router starter.
- The mobile application is a minimal Expo starter with a single `App.tsx`.
- `packages/shared` has a package manifest and one source entry point.
- Supabase directories contain no tracked migrations or functions.
- `.gitignore` excludes local environment files and generated app output.
- Two untracked Supabase client files exist under the applications. They are
  not used by the current starter screens and are intentionally not changed by
  this stage.

### Declared versions

- Next.js `16.4.2`.
- React and React DOM `19.3.0`.
- Expo `~58.0.17`.
- React Native `0.88.0`.
- TypeScript `^5` for web and `~6.0.3` for mobile.

### Current scripts

- Root: `dev:web`, `dev:mobile`, `test:shared`, `typecheck:*`, `lint:web`,
  `build:web`, and `qa`.
- Web: `dev`, `build`, `start`, `lint`.
- Mobile: `start`, `android`, `ios`, `web`.

The automated Phase 1 acceptance commands are now available through the root
`qa` script. Native device validation remains a manual follow-up.

## Proposed implementation order

1. **Shared UI package:** create `packages/ui`, centralize semantic tokens,
   define theme contracts, and implement a small cross-platform foundation.
2. **Shared product package:** expand `packages/shared` with domain types,
   validation, mock data, repository interfaces, and a mock repository.
3. **Web foundation:** integrate `@sidequest/ui`, add responsive navigation,
   and build Discover from the repository contract.
4. **Mobile foundation:** add native navigation and consume the same UI package,
   tokens, and repository contract.
5. **Quest workflows:** add details, create, join/leave, approvals, host
   management, capacity rules, and local persistence.
6. **Coordination and history:** add My Quests, completion, recap, and
   explicitly local mock chat.
7. **Profile, settings, themes, and safety:** add theme selection, privacy
   controls, reporting, and blocking prototype interfaces.
8. **Quality assurance:** run package and app checks, verify responsive/native
   behavior, and document remaining mock-only behavior. **Complete for
   automated checks; native device review remains required.**

## Stage 2 implementation boundary

The Stage 1 architecture and plan are now being used to implement
`packages/ui`. Supabase integration, authentication, remote APIs, and real-time
behavior remain excluded from this Phase 1 prototype.

## Acceptance criteria for the next stage

- `@sidequest/ui` has a public package entry point.
- Both app manifests consume `@sidequest/ui`.
- Theme tokens are defined once and include light, dark, and system modes.
- At least the shared Button, Input, Badge, Card, EmptyState, and LoadingState
  primitives typecheck in both consumers.
- A small showcase can render the shared primitives on web and mobile.

## Phase 1 implementation status

The shared product package provides domain models, constants, mock profiles and
quests, dependency-free validation, lifecycle/capacity rules, coordination,
safety, profile/settings APIs, and `QuestRepository`/`MockQuestRepository`.
Web and mobile consume the same mock repository and UI contracts. Supabase,
authentication, persistence, notifications, realtime messaging, and production
navigation remain postponed until Phase 1 review.
