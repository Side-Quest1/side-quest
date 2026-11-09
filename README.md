# SideQuest

**Less scrolling. More doing.**

SideQuest is a platform for people who want to do something but don't have enough people to go with. Users can post or discover plans—like a trek, football game, food crawl, gig, road trip, or casual hangout—and join others who are interested.

Unlike platforms focused mainly on long-term groups, followers, or dating, SideQuest is built around **activity-first connections**: find a plan, meet for the activity, and let connections grow naturally.

## The Problem

People often want to try something or make plans but don't have enough friends available, don't know who else is interested, or struggle to discover spontaneous local activities.

## How It Works

1. **Discover** activities nearby or by interest.
2. **Create or join** a quest with a time, place, budget, and available spots.
3. **Coordinate** with the group.
4. **Complete** the activity in real life.
5. **Look back** on experiences and discover what to try next.

Quests are activity-based and time-bound, keeping the focus on doing things in real life—not endlessly scrolling through a social feed.

## Phase 1 prototype

The current prototype is a mock-backed cross-platform experience. Web and
mobile share the `@sidequest/shared` domain/repository package and the
`@sidequest/ui` design system.

The current frontend redesign keeps the same mock-backed workflows while
using the Forest & Lime visual system, Manrope headings, Inter body text,
responsive Discover composition, motion-safe card transitions, and valid
activity photography.

Implemented flows include:

- Discover, search, category filters, quest details, and capacity visibility.
- Full activity creation on web and mobile with shared category/activity-type
  configuration, schedule, location, capacity, optional cost, join mode, and
  visibility validation. Team-sport activities also collect players per team.
- My Activities groupings for hosting, joined, pending requests, and past
  activities, with activity details navigation and mock-backed host approval,
  rejection, completion, cancellation, and participant leave actions.
- Mobile uses a persistent five-item bottom navigation for Discover, My
  Activities, Create, Alerts, and Profile. The centered Create action opens the
  real activity form; modal flows temporarily hide the bar to avoid overlap.
- Light, dark, and system themes now use semantic shared UI tokens. Web theme
  preference is persisted in local storage and follows browser appearance in
  system mode; native primitives resolve the selected/system appearance without
  resetting screen state.
- Create, join, request-to-join, leave, complete, cancel, and recap workflows.
- Host approval/rejection of join requests.
- Local activity coordination with participant status and mock group chat.
- Report and block actions.
- Editable profile details, quest history, theme preferences, notification
  preferences, blocked-user management, and mock report history.
- Loading, empty, error, retry, and feedback states.
- Discover pagination, combined category/search/budget filtering, filter reset,
  and activity details status/capacity information on web and mobile.

The repository contract now also exposes typed, cursor-based quest pages for
future backend pagination. The current `MockQuestRepository` is explicitly a
development adapter: data is process-local, resets on restart, and does not
represent persistence or delivery guarantees.
The Stage 3 activity groups and management operations use that same process-local
adapter; they do not imply authentication, durable storage, or server-side
concurrency guarantees.

Authentication, persistence, real notifications, realtime messaging, and
Supabase integration are intentionally postponed. The next backend step is to
implement `QuestRepository` with Supabase queries, map database errors to
typed application errors, and add realtime subscriptions at the application
adapter boundary without changing screen contracts.

## Setup

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run qa
```

Run the applications locally:

```bash
npm run dev:web
npm run dev:mobile
```

Useful focused checks:

```bash
npm run test:shared
npm run typecheck:web
npm run typecheck:mobile
npm run lint:web
npm run build:web
```

The mobile app can also be opened with Expo using its `android`, `ios`, or
`web` workspace scripts.

## Features to Explore

These are proposed ideas to validate with users; they are not all implemented yet.

### 1. Life Quest Score
A personal recap of quests completed, new activities tried, places explored, and quests hosted. For example: “You completed 5 quests and tried 2 new activities this month.” It should reward participation and exploration—not popularity, money spent, or how exciting someone's life looks. Stats should be private by default.

### 2. “I'm Free” Matching
Users choose when they're available, their interests, approximate area, and budget. SideQuest suggests suitable activities or people with compatible plans, even if they haven't created a quest themselves.

### 3. Comfort Zone Challenges
Optional goals like trying a new activity, visiting an unfamiliar part of the city, or joining a group for the first time. The aim is to encourage exploration without pressuring users to compete.

### 4. Social Circle Growth
A private view of connections made through quests, including people a user has met more than once. It focuses on real-world connections rather than follower counts.

### 5. Quest Memories
After an activity, participants can add a photo or short memory to a personal timeline. Users can look back on their experiences and share a monthly recap if they choose.

### 6. Quest Streaks and Challenges
Optional weekly or monthly challenges, such as “try two new activities this month” or “explore three new places.” Streaks should encourage healthy participation, not daily app usage for its own sake.

### 7. Host Reliability and Trust
Show useful trust signals such as verified attendance, completed quests hosted, and participant feedback. Include reporting and blocking, clear activity details, and safety guidance so people can make informed decisions before joining.

### 8. Quick Group Fill
Hosts can mark a quest as needing more people, such as “2 spots left.” Interested users can discover plans that need participants, helping small groups come together faster.

## What Could Make SideQuest Different?

Our intended focus is the combination of:

- **Activity-first discovery:** start with what someone wants to do, not who they want to follow.
- **Spontaneous plans:** help turn free time into a real activity.
- **Temporary communities:** people come together around a quest without needing to join a permanent group.
- **Real-world progress:** celebrate experiences completed and new things tried, rather than likes and followers.
- **Trust and repeat participation:** make it easier to join safely and reconnect with people from past activities.

These are hypotheses, not proof of a competitive advantage. We need to test them with real users and compare the experience with existing activity and event apps.

## Suggested MVP Priorities

Start small and validate the core behaviour before building everything:

1. Create, discover, join, and leave quests.
2. Show activity time, approximate location, budget, group size, and spots remaining.
3. Provide basic group coordination and quest status.
4. Add reporting, blocking, and clear safety information.
5. Track completed quests and offer a simple personal activity recap.
6. Test “I'm Free” matching with a small local student community.

Advanced recommendations, complex scoring, and large-scale gamification can come later if users find them valuable.

## Initial Audience

SideQuest can start with students and young adults in one city who want to explore activities, meet people through shared interests, and make plans without needing an existing group.

## Guiding Principle

**Turn free time into experiences—and help people see how their world grows.**
