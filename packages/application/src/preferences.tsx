import { useEffect, useState } from "react";
import type { SupabaseClient } from "@sidequest/adapters";
import { QUEST_ACTIVITY_TYPES, QUEST_CATEGORIES } from "@sidequest/shared";
import type { Controls } from "./live-activities";

const initial = {
  personalized: true,
  learn: false,
  categories: [] as string[],
  types: [] as string[],
  weekdays: [] as number[],
  budget: "",
  radius_km: "",
  latitude: "",
  longitude: "",
};
export function Preferences({
  db,
  user,
  ui,
  saved,
}: {
  db: SupabaseClient;
  user: string;
  ui: Controls;
  saved: () => void;
}) {
  const [values, set] = useState(initial);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void db
      .from("discovery_preferences")
      .select("*")
      .eq("user_id", user)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setStatus(error.message);
          return;
        }
        if (data)
          set({
            ...data,
            budget: String(data.budget ?? ""),
            radius_km: String(data.radius_km ?? ""),
            latitude: String(data.latitude ?? ""),
            longitude: String(data.longitude ?? ""),
          } as typeof initial);
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, [db, user]);
  function toggle(key: "categories" | "types", v: string) {
    set((p) => ({
      ...p,
      [key]: p[key].includes(v)
        ? p[key].filter((x) => x !== v)
        : [...p[key], v],
    }));
  }
  async function write(clear: boolean) {
    setBusy(true);
    setStatus("");
    try {
      const number = (s: string, min: number, max: number) => {
        if (!s.trim()) return null;
        const n = Number(s);
        if (!Number.isFinite(n) || n < min || n > max)
          throw Error("Check the coordinate, distance and budget ranges.");
        return n;
      };
      const { error } = clear
        ? await db.rpc("clear_discovery_history")
        : await db.from("discovery_preferences").upsert({
            ...values,
            user_id: user,
            budget: number(values.budget, 0, 1000000),
            radius_km: number(values.radius_km, 1, 1000),
            latitude: number(values.latitude, -90, 90),
            longitude: number(values.longitude, -180, 180),
          });
      if (error) throw error;
      setStatus(
        clear ? "Discovery history cleared." : "Discovery preferences saved.",
      );
      saved();
    } catch (e) {
      setStatus(
        e && typeof e === "object" && "message" in e
          ? String(e.message)
          : "Unable to save preferences.",
      );
    } finally {
      setBusy(false);
    }
  }
  const { Section, Heading, Label, Action, Choices, Field } = ui;
  return (
    <Section>
      <Heading>Discovery preferences</Heading>
      {ready && (
        <Section>
          <Choices
            label="Recommendations"
            current={values.personalized ? "Personalized" : "General"}
            values={["Personalized", "General"]}
            choose={(v) =>
              set({ ...values, personalized: v === "Personalized" })
            }
          />
          <Choices
            label="Learn from my activity"
            current={values.learn ? "On" : "Off"}
            values={["Off", "On"]}
            choose={(v) => set({ ...values, learn: v === "On" })}
          />
          {(["categories", "types"] as const).map((key) => {
            const options =
              key === "categories" ? QUEST_CATEGORIES : QUEST_ACTIVITY_TYPES;
            return (
              <Choices
                key={key}
                label={"Preferred " + key}
                current=""
                values={options.map((c) => c.id)}
                labels={options.map(
                  (c) => (values[key].includes(c.id) ? "✓ " : "") + c.label,
                )}
                choose={(v) => toggle(key, v)}
              />
            );
          })}
          <Choices
            label="Available days"
            current=""
            values={["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]}
            labels={["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
              (d, i) => (values.weekdays.includes(i) ? "✓ " : "") + d,
            )}
            choose={(v) => {
              const d = [
                "Sun",
                "Mon",
                "Tue",
                "Wed",
                "Thu",
                "Fri",
                "Sat",
              ].indexOf(v);
              set({
                ...values,
                weekdays: values.weekdays.includes(d)
                  ? values.weekdays.filter((x) => x !== d)
                  : [...values.weekdays, d],
              });
            }}
          />
          {(
            [
              ["budget", "Preferred budget (INR)"],
              ["radius_km", "Preferred radius (km)"],
              ["latitude", "Approximate area latitude"],
              ["longitude", "Approximate area longitude"],
            ] as const
          ).map(([key, label]) => (
            <Field
              key={key}
              label={label}
              value={values[key]}
              change={(s) => set({ ...values, [key]: s })}
            />
          ))}
          <Action label="Use my approximate area" disabled={busy} press={async()=>{
            setBusy(true);try{const area=await ui.areaLocation();set(p=>({...p,...area}));setStatus("Area selected. Save to use it for discovery.");}
            catch(e){setStatus(e instanceof Error?e.message:"Enter your area manually.");}finally{setBusy(false);}
          }}/>
          <Action
            label="Save discovery preferences"
            disabled={busy}
            press={() => void write(false)}
          />
          <Action
            label="Clear discovery history, saves and dismissals"
            disabled={busy}
            press={() => void write(true)}
          />
        </Section>
      )}
      {!!status && <Label>{status}</Label>}
    </Section>
  );
}
