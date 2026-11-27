import { useEffect, useRef, useState } from "react";
import {
  defaultQuestDate,
  imageForCategory,
  localDateString,
  QUEST_ACTIVITY_TYPES,
  QUEST_CATEGORIES,
  validateQuestCreation,
  type QuestActivityType,
  type QuestCategory,
} from "@sidequest/shared";
import type {
  LiveActivity,
  SupabaseQuestRepository,
} from "@sidequest/adapters";
import type { Controls } from "./live-activities";

function initial(a?: LiveActivity) {
  return {
    title: a?.title ?? "",
    description: a?.description ?? "",
    area: a?.area ?? "",
    category: a?.category ?? "social",
    type: a?.activity_type ?? "social",
    date: a ? localDateString(new Date(a.starts_at)) : defaultQuestDate(),
    start: a ? new Date(a.starts_at).toTimeString().slice(0, 5) : "10:00",
    end: a ? new Date(a.ends_at).toTimeString().slice(0, 5) : "12:00",
    capacity: String(a?.capacity ?? 6),
    cost: String(a?.cost_inr ?? 0),
    mode: a?.join_mode ?? "instant",
    visibility: a?.visibility ?? "public",
    latitude: String(a?.latitude ?? ""),
    longitude: String(a?.longitude ?? ""),
    requirements: a?.requirements ?? "",
    notes: a?.type_notes ?? "",
    team: String(a?.team_size ?? 2),
  };
}
const steps = [
  "Activity type",
  "Details",
  "Time and place",
  "Participants and privacy",
  "Review",
];
export function ActivityEditor({
  ui,
  repo,
  user,
  activity,
  done,
  close,
}: {
  ui: Controls;
  repo: SupabaseQuestRepository;
  user: string;
  activity?: LiveActivity;
  done: (id: string) => void;
  close: () => void;
}) {
  const { Section, Heading, Choices, Field, Label, Action } = ui;
  const [d, set] = useState(() => initial(activity));
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const writes = useRef(Promise.resolve());
  const key = "sidequest.draft." + user;
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const raw = activity ? null : await ui.storage.getItem(key);
        if (raw && active) {
          const parsed = JSON.parse(raw);
          const fresh = initial();
          for (const k of Object.keys(fresh) as (keyof typeof fresh)[]) {
            if (typeof parsed[k] === "string")
              Object.assign(fresh, { [k]: parsed[k] });
          }
          set(fresh);
        }
      } catch {
        if (active) setError("Unable to load the local draft.");
      } finally {
        if (active) setReady(true);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [activity, key, ui]);
  useEffect(() => {
    if (!ready || activity) return;
    writes.current = writes.current
      .then(() => ui.storage.setItem(key, JSON.stringify(d)))
      .catch(() => setError("This device could not save the draft."));
  }, [activity, d, key, ready, ui]);
  const fields = (pairs: ReadonlyArray<[keyof typeof d, string]>) =>
    pairs.map(([k, label]) => (
      <Field
        key={k}
        label={label}
        value={d[k]}
        change={(s) => set((p) => ({ ...p, [k]: s }))}
      />
    ));
  async function next() {
    if (lock.current) return;
    setError("");
    const result = validateQuestCreation({
      hostId: user,
      title: d.title,
      description: d.description,
      locationLabel: d.area,
      date: d.date,
      startTime: d.start,
      endTime: d.end,
      capacity: Number(d.capacity),
      category: d.category as QuestCategory,
      activityType: d.type as QuestActivityType,
      activityDetails: { teamSize: Number(d.team) },
      estimatedCost: { amount: Number(d.cost), currency: "INR" },
      minimumAge: 16,
      featured: false,
      visibility: d.visibility === "invite-only" ? "invite-only" : "public",
      joinMode: d.mode,
    });
    const groups = [
      ["activityType"],
      ["title", "description", "estimatedCost"],
      ["locationLabel", "date", "startTime", "endTime"],
      ["capacity", "teamSize"],
    ];
    const errors = result.success
      ? []
      : Object.entries(result.errors)
          .filter(([k]) => step === 4 || groups[step]?.includes(k))
          .map(([, v]) => v);
    if (
      step >= 2 &&
      (!!d.latitude.trim() !== !!d.longitude.trim() ||
        !Number.isFinite(Number(d.latitude)) ||
        Math.abs(Number(d.latitude)) > 90 ||
        !Number.isFinite(Number(d.longitude)) ||
        Math.abs(Number(d.longitude)) > 180)
    )
      errors.push("Enter a valid latitude and longitude together.");
    if (errors.length) {
      setError(errors.join(". "));
      return;
    }
    if (step < 4) {
      setStep(step + 1);
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      const id = await repo.save(
        {
          title: d.title.trim(),
          description: d.description.trim(),
          category: d.category,
          activity_type: d.type,
          area: d.area.trim(),
          latitude: d.latitude.trim() ? Number(d.latitude) : null,
          longitude: d.longitude.trim() ? Number(d.longitude) : null,
          starts_at: new Date(d.date + "T" + d.start).toISOString(),
          ends_at: new Date(d.date + "T" + d.end).toISOString(),
          capacity: Number(d.capacity),
          cost_inr: Number(d.cost),
          join_mode: d.mode,
          visibility: d.visibility,
          requirements: d.requirements,
          type_notes: d.notes,
          team_size: d.type === "team-sport" ? Number(d.team) : null,
        },
        activity?.id,
      );
      if (!activity) {
        await writes.current;
        try {
          await ui.storage.removeItem(key);
        } catch {
          /* Publication already succeeded. */
        }
      }
      done(id);
    } catch (e) {
      setError(
        e && typeof e === "object" && "message" in e
          ? String(e.message)
          : "Unable to publish.",
      );
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Section>
      <Label>
        {activity ? "Edit activity" : "Create activity"} · {step + 1} of 5
      </Label>
      <Heading>{steps[step]}</Heading>
      {step === 0 && (
        <Section>
          <Choices
            label="Activity type"
            current={d.type}
            values={QUEST_ACTIVITY_TYPES.map((t) => t.id)}
            labels={QUEST_ACTIVITY_TYPES.map((t) => t.label)}
            choose={(type) => set({ ...d, type })}
          />
          <Choices
            label="Category"
            current={d.category}
            values={QUEST_CATEGORIES.map((c) => c.id)}
            labels={QUEST_CATEGORIES.map((c) => c.label)}
            choose={(category) => set({ ...d, category })}
          />
        </Section>
      )}
      {step === 1 &&
        fields([
          ["title", "Title"],
          ["description", "What will you do?"],
          [
            "notes",
            d.type === "study"
              ? "Subject and study format"
              : d.type === "team-sport"
                ? "Skill level and venue"
                : d.type === "food"
                  ? "Venue or cuisine"
                  : "Activity details",
          ],
          ["cost", "Cost per person (INR)"],
        ])}
      {step === 2 &&
        fields([
          ["date", "Date (YYYY-MM-DD)"],
          ["start", "Local start (HH:MM)"],
          ["end", "Local end (HH:MM)"],
          ["area", "Approximate area"],
          ["latitude", "Map latitude (optional)"],
          ["longitude", "Map longitude (optional)"],
        ])}
      {step === 3 && (
        <Section>
          {fields([
            ["capacity", "Capacity including host"],
            ["requirements", "Participation requirements"],
          ])}
          {d.type === "team-sport" && fields([["team", "Players per team"]])}
          <Choices
            label="Join mode"
            current={d.mode}
            values={["instant", "approval"]}
            choose={(s) =>
              set({ ...d, mode: s === "approval" ? "approval" : "instant" })
            }
          />
          {!activity && (
            <Choices
              label="Visibility"
              current={d.visibility}
              values={["public", "invite-only"]}
              choose={(visibility) => set({ ...d, visibility })}
            />
          )}
        </Section>
      )}
      {step === 4 && (
        <Section>
          <ui.Cover
            title={d.title || "Your activity"}
            kicker={d.category}
            subtitle={(d.area || "Your local area") + " · " + d.capacity + " people · " + (Number(d.cost) ? "₹" + d.cost : "Free")}
            image={imageForCategory(d.category)}
          />
          <Heading>{d.title}</Heading>
          <Label>Your invitation preview</Label>
          <Label>{d.description}</Label>
          <Label>
            {d.date} · {d.start} – {d.end} · {d.area}
          </Label>
          <Label>
            {d.capacity} participants · ₹{d.cost} · {d.mode} · {d.visibility}
          </Label>
          <Label>
            {d.notes} {d.requirements}
          </Label>
        </Section>
      )}
      {!!error && <Label>{error}</Label>}
      <Action
        label={
          step < 4 ? "Next" : activity ? "Save changes" : "Publish activity"
        }
        press={() => void next()}
        disabled={!ready || busy}
      />
      <Action
        label={step ? "Previous step" : "Close"}
        disabled={busy}
        press={() => (step ? setStep(step - 1) : close())}
      />
    </Section>
  );
}
