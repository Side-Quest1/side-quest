# Personalized discovery

The connected Next and Expo clients use `RecommendationService.page(filters, cursor, signal)`. The service calls `public.recommend_activities(options, after_cursor, page_size)`. Identity comes from the signed-in session. Each page returns activity records with a score, a reason, and a nullable continuation containing a snapshot UUID and offset. The client requests 12 activities per page. The endpoint accepts 1–40.

## Candidate selection and ordering

PostgreSQL selects up to the earliest 240 eligible upcoming activities using schedule and category indexes. Row policies enforce visibility, invitations, verified age groups and blocking. Selection also checks open seats, dismissals, active requests and existing membership. Hard filters support title or area search, category, activity type, join mode, budget in INR, minimum available seats, start range and distance in kilometres. Distance filtering requires both a user-selected approximate origin and a mapped activity. Coordinates are rounded to two decimal places in storage.

| Feature | Weight | Calculation |
| --- | ---: | --- |
| Interest | 0.25 | Explicit profile term matches activity title, category or description |
| Affinity | 0.20 | An explicitly preferred category or type scores 1. Otherwise use 0.5 + 0.5 × tanh(category evidence / 6) |
| Distance | 0.15 | max(0, 1 − great-circle distance / (2 × preferred radius)) |
| Schedule | 0.15 | Start weekday matches selected days in the device's IANA time zone |
| Budget | 0.10 | Within budget scores 1. Otherwise use preferred budget divided by cost |
| Freshness | 0.05 | exp(−activity age in days / 7) |
| Capacity | 0.05 | Open seats divided by capacity |
| Exploration | 0.05 | Unseen category with no history scores 1. Seen activity scores 0. Other activities score 0.5 |

Missing personal preferences contribute 0.5. General discovery neutralizes all personal signals. The weighted sum is the base score. Subtract 0.055 for each preceding item in the same category's base ranking and 0.08 for each preceding item in the same host's base ranking. Sort by the resulting priority, start time, and UUID. Change the checked `discovery_weights` row through an operator migration to tune the initial hypotheses.

Category evidence uses at most 1,000 signals from the previous 180 days. Multiply each contribution by exp(−age in days / 60). Join requests contribute 1, saves 2, successful joins and hosting 3, attendance confirmations and positive feedback 4, and negative feedback −5. Impressions and detail opens contribute zero evidence of affinity. Passive collection and learning require explicit opt-in. Saves and dismissals work as explicit actions. Users can clear their discovery history from Profile.

## Pagination, privacy and measurement

An owner-bound snapshot freezes the ranking for 15 minutes. Reads reapply row visibility and current eligibility. Edited activity versions drop out of an existing snapshot. Preference changes invalidate snapshots. Refresh rebuilds the user's previously loaded page depth. New rankings are limited to 60 per minute per account. Web uses browser intersection observations and native measures visible cards in a windowed list. Repeat impressions cannot increase affinity.

The operator-only `sidequest_private.discovery_quality` view computes counts and rates over consented first exposures in a rolling 30-day window. The output requires ten distinct users. It includes detail, join, confirmation and dismissal rates, category and host coverage, new-host share, and repeat-day exposure. A new host is within 30 days of their first recorded activity. Attendance confirmation is self-reported. The metrics do not establish attendance in person or causal lift.

For bounded candidate count C and bounded history H, scoring is linear in C and H plus text matching. Windowed reranking sorts C records in O(C log C). Candidate retrieval may scan additional ineligible rows. Examine query plans with representative distributions and concurrent traffic before setting a service-level objective. Highly selective distance and text filters merit particular attention.

## Verification

Run `npm run test:database` for private/cohort eligibility, full seats, cold start, signal weights, truthful explanations, isolation, deterministic continuation, consent and dismissal tests. The suite reports five first-page timings for a PostgreSQL WASM fixture with 1,000 additional activities.

For browser checks, run the Next development server on 127.0.0.1 port 3408 with `NEXT_PUBLIC_SIDEQUEST_MODE=connected`, `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54499` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local-browser-fixture`. Run `python apps/web/test/discovery-browser.py` with Playwright and Edge installed. The fixture intercepts browser API traffic and covers widths 320, 375, 390, 430, 768, 1024 and 1440. Real Auth, PostgREST, realtime reconnects and delivery infrastructure need separate integration checks.
