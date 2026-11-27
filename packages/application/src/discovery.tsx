import { useEffect, useMemo, useState } from "react";
import {
  imageForCategory,
  QUEST_CATEGORIES,
  QUEST_ACTIVITY_TYPES,
} from "@sidequest/shared";
import {
  RecommendationService,
  type DiscoveryFilters,
  type DiscoveryCursor,
  type RecommendedActivity,
  type SupabaseClient,
} from "@sidequest/adapters";
import type { Controls } from "./live-activities";

export function useDiscovery(
  db: SupabaseClient,
  active: boolean,
  revision: number,
  storage: Controls["storage"],
  user: string,
) {
  const service = useMemo(() => new RecommendationService(db), [db]);
  const [filters, setFilters] = useState<DiscoveryFilters>({});
  const [map, setMap] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [depth, setDepth] = useState(1);
  const [rows, setRows] = useState<RecommendedActivity[]>([]);
  const [next, setNext] = useState<DiscoveryCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [restored, setRestored] = useState(false);
  const storageKey = "sidequest.discovery." + user;
  useEffect(() => {
    let current = true;
    void storage
      .getItem(storageKey)
      .then((raw) => {
        if (!current || !raw) return;
        const state = JSON.parse(raw);
        if (state.filters && typeof state.filters === "object")
          setFilters(
            Object.fromEntries(
              Object.entries(state.filters).filter(
                ([k, v]) =>
                  [
                    "category",
                    "mode",
                    "type",
                    "budget",
                    "spots",
                    "distance",
                    "from",
                    "until",
                    "search",
                  ].includes(k) && typeof v === "string",
              ),
            ),
          );
        setMap(state.map === true);
        if (Number.isInteger(state.depth))
          setDepth(Math.min(20, Math.max(1, state.depth)));
      })
      .catch(() => {})
      .finally(() => {
        if (current) setRestored(true);
      });
    return () => {
      current = false;
    };
  }, [storage, storageKey]);
  useEffect(() => {
    if (restored)
      void storage
        .setItem(storageKey, JSON.stringify({ filters, depth, map }))
        .catch(() => {});
  }, [restored, storageKey, storage, filters, depth, map]);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [cache] = useState(() => ({
    key: "",
    pages: [] as Awaited<ReturnType<typeof service.page>>[],
  }));
  useEffect(() => {
    if (!active || !restored) return;
    const controller = new AbortController();
    const key = JSON.stringify([filters, timezone, refresh, revision]);
    if (cache.key !== key) {
      cache.pages = [];
      cache.key = key;
      setRows([]);
      setNext(null);
    }
    setLoading(true);
    setError("");
    const timer = setTimeout(async () => {
      try {
        while (cache.pages.length < depth) {
          const previous = cache.pages.at(-1);
          if (previous && !previous.next) break;
          const page = await service.page(
            { ...filters, timezone },
            previous?.next,
            controller.signal,
          );
          if (controller.signal.aborted) return;
          cache.pages.push(page);
        }
        setRows(cache.pages.flatMap((p) => p.items));
        setNext(cache.pages.at(-1)?.next ?? null);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e && typeof e === "object" && "message" in e
              ? String(e.message)
              : "Unable to load activities.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [
    active,
    cache,
    depth,
    filters,
    refresh,
    revision,
    service,
    timezone,
    restored,
  ]);
  function filter(key: keyof DiscoveryFilters, value: string) {
    setDepth(1);
    setFilters((current) => {
      const result = { ...current };
      if (value) result[key] = value;
      else delete result[key];
      return result;
    });
  }
  return {
    filters,
    filter,
    map,
    setMap,
    advanced,
    setAdvanced,
    rows,
    next,
    loading,
    error,
    service,
    more: () => setDepth((n) => n + 1),
    reload: () => setRefresh((n) => n + 1),
    reset: () => {
      setFilters({});
      setDepth(1);
    },
  };
}

export function Discovery({
  feed,
  ui,
  open,
  run,
}: {
  feed: ReturnType<typeof useDiscovery>;
  ui: Controls;
  open: (id: string) => void;
  run: (work: () => Promise<void>) => void;
}) {
  const { Cover, Heading, Section, Field, Action, Choices, Label } = ui;
  const { filters, filter } = feed;
  const [collection,setCollection]=useState("For you");
  const options:Record<string,RecommendedActivity[]>={
    "For you":feed.rows,
    "Happening soon":feed.rows.filter(a=>Date.parse(a.starts_at)<Date.now()+86400000),
    "Weekend plans":feed.rows.filter(a=>[0,6].includes(new Date(a.starts_at).getDay())),
    "Based on your interests":feed.rows.filter(a=>a.reason.startsWith("Matches your")),
    "Near you":feed.rows.filter(a=>a.reason==="Within your preferred distance."),
    "Easy to join":feed.rows.filter(a=>a.join_mode==="instant"),
  };
  const current=options[collection]?.length?collection:"For you";
  const rows=options[current];
  const [pin, setPin] = useState("");
  const [range, setRange] = useState({ from: "", until: "" }),
    [rangeError, setRangeError] = useState("");
  const mapped = rows.filter(
    (a) => a.latitude !== null && a.longitude !== null,
  );
  const selected = mapped.find((a) => a.id === pin) ?? mapped[0];
  const hour = new Date().getHours();
  function card(a: RecommendedActivity, feature: boolean) {
    return (
      <ui.Exposure
        key={a.id}
        visible={() =>
          void feed.service.record(a.id, "impression").catch(() => {})
        }
      >
        <Section>
          <Cover
            title={a.title}
            kicker={a.category}
            subtitle={a.area + " · " + a.available_spots + " spots · " + (a.cost_inr === 0 ? "Free" : "₹" + a.cost_inr)}
            image={imageForCategory(a.category)}
          />
          <Label>
            {new Date(a.starts_at).toLocaleString()} · {a.area} ·{" "}
            {a.available_spots} spots ·{" "}
            {a.cost_inr === 0 ? "Free" : "₹" + a.cost_inr}
          </Label>
          <Label>{a.reason}</Label>
          <Action
            label="View activity"
            press={() => {
              open(a.id);
              void feed.service.record(a.id, "detail").catch(() => {});
            }}
          />
          <Choices
            label="Discovery actions"
            current=""
            values={["Save", "Dismiss"]}
            choose={(v) =>
              run(async () => {
                await feed.service.record(
                  a.id,
                  v === "Save" ? "save" : "dismiss",
                );
              })
            }
          />
        </Section>
      </ui.Exposure>
    );
  }
  const header = (
    <Section>
      <Heading>
        {hour < 12
          ? "What will you do today?"
          : hour < 18
            ? "Your next story starts here."
            : "Make plans for your next day out."}
      </Heading>
      <Label>Local ideas tuned to {Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " ")}.</Label>
      {feed.rows.length>0 && <Choices label="Explore this selection" current={current} values={Object.keys(options).filter(k=>options[k].length>0)} choose={setCollection}/>}
      {!feed.map && rows.length>0 && <Section><Heading>{current}</Heading>{card(rows[0],true)}</Section>}
      <Field
        label="Search activities or areas"
        value={filters.search ?? ""}
        change={(s) => filter("search", s)}
      />
      <Choices
        label="Category"
        current={filters.category ?? "All"}
        values={["All", ...QUEST_CATEGORIES.map((c) => c.id)]}
        choose={(s) => filter("category", s === "All" ? "" : s)}
      />
      <Choices
        label="Discovery view"
        current={feed.map ? "Map" : "Feed"}
        values={["Feed", "Map"]}
        choose={(s) => feed.setMap(s === "Map")}
      />
      <Action
        label={feed.advanced ? "Hide filters" : "More filters"}
        press={() => feed.setAdvanced(!feed.advanced)}
      />
      {feed.advanced && (
        <Section>
          {(
            [
              ["budget", "Maximum budget (INR)"],
              ["distance", "Distance from preferred coordinates (km)"],
              ["spots", "Minimum open spots"],
            ] as const
          ).map(([k, label]) => (
            <Field
              key={k}
              label={label}
              value={filters[k] ?? ""}
              change={(s) => {
                if (/^\d{0,7}$/.test(s)) filter(k, s);
              }}
            />
          ))}
          <Choices
            label="Join mode"
            current={filters.mode ?? "Any mode"}
            values={["Any mode", "instant", "approval"]}
            choose={(s) => filter("mode", s === "Any mode" ? "" : s)}
          />
          <Choices
            label="Activity type"
            current={filters.type ?? "All types"}
            values={["All types", ...QUEST_ACTIVITY_TYPES.map((t) => t.id)]}
            choose={(s) => filter("type", s === "All types" ? "" : s)}
          />
          <Choices
            label="Schedule"
            current={filters.until ? "Next 7 days" : "Any date"}
            values={["Any date", "Next 7 days"]}
            choose={(s) => {
              const end = new Date();
              end.setDate(end.getDate() + 7);
              filter("until", s === "Any date" ? "" : end.toISOString());
            }}
          />
          <Field
            label="Starting after (local YYYY-MM-DDTHH:MM)"
            value={range.from}
            change={(from) => setRange({ ...range, from })}
          />
          <Field
            label="Starting before (local YYYY-MM-DDTHH:MM)"
            value={range.until}
            change={(until) => setRange({ ...range, until })}
          />
          <Action
            label="Apply time range"
            press={() => {
              if (
                Object.values(range).some(
                  (v) =>
                    v &&
                    (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(v) ||
                      !Number.isFinite(Date.parse(v))),
                ) ||
                (range.from && range.until && range.from >= range.until)
              ) {
                setRangeError("Enter a valid local time range.");
                return;
              }
              setRangeError("");
              for (const k of ["from", "until"] as const)
                filter(k, range[k] ? new Date(range[k]).toISOString() : "");
            }}
          />
          {!!rangeError && <Label>{rangeError}</Label>}
          <Action label="Reset filters" press={feed.reset} />
        </Section>
      )}
      <Action label="Refresh activities" press={feed.reload} />
      {feed.error ? (
        <Label>{feed.error}</Label>
      ) : feed.loading ? (
        <Label>Finding activities…</Label>
      ) : rows.length === 0 ? (
        <Section>
          <Heading>Your next plan is waiting.</Heading>
          <Label>Try widening your filters, or refresh for newly posted activities nearby.</Label>
          <Action label="Reset discovery filters" press={feed.reset} />
        </Section>
      ) : null}
      {feed.map ? (
        selected ? (
          <Section>
            <ui.AreaMap item={selected} />
            <Choices
              label="Map locations"
              current={selected.id}
              values={mapped.map((a) => a.id)}
              labels={mapped.map((a) => a.title)}
              choose={setPin}
            />
            {card(selected, false)}
          </Section>
        ) : (
          <Label>No mapped locations on this page.</Label>
        )
      ) : rows.length>1 ? <Heading>More to explore</Heading> : null}
    </Section>
  );
  const remaining=new Map((feed.map?[]:rows.slice(1)).map(a=>[a.id,a]));
  return <ui.FeedList header={header} ids={Array.from(remaining.keys())} render={id=>card(remaining.get(id)!,false)} footer={
      feed.next && (
        <Action
          label="Load more activities"
          disabled={feed.loading}
          press={feed.more}
        />
      )} />;
}
