"use client";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { connect } from "@sidequest/adapters";
import { LiveActivities } from "@sidequest/application/activities";
import { Button, Input } from "@sidequest/ui/web";
import trail from "../../../../packages/ui/assets/trail.jpg";
import { activityCode } from "@sidequest/application/share";

const ui: ComponentProps<typeof LiveActivities>["ui"] = {
  areaLocation:()=>new Promise((resolve,reject)=>{
    if(!navigator.geolocation){reject(Error("Enter your approximate area manually."));return;}
    navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude.toFixed(2),longitude:p.coords.longitude.toFixed(2)}),
      ()=>reject(Error("Location is unavailable. You can enter your area manually.")),{enableHighAccuracy:false,maximumAge:300000,timeout:12000});
  }),
  FeedList:({header,ids,render,footer})=><div className="sq-section">{header}<div className="sq-stories">{ids.map(id=><article key={id}>{render(id)}</article>)}</div>{footer}</div>,
  storage: {
    getItem: async (k) => localStorage.getItem(k),
    setItem: async (k, v) => localStorage.setItem(k, v),
    removeItem: async (k) => localStorage.removeItem(k),
  },
  Exposure: function Exposure({ children, visible }) {
    const ref = useRef<HTMLDivElement>(null),
      seen = useRef(false);
    useEffect(() => {
      if (!ref.current || seen.current) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (
            !document.hidden &&
            entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.25)
          ) {
            seen.current = true;
            observer.disconnect();
            visible();
          }
        },
        { threshold: 0.25 },
      );
      observer.observe(ref.current);
      return () => observer.disconnect();
    }, [visible]);
    return (
      <div ref={ref} className="sq-activity">
        {children}
      </div>
    );
  },
  Heading: ({ children }) => <h2 className="sq-heading">{children}</h2>,
  Cover: ({ title, kicker, subtitle, image }) => (
    <header
      className="sq-cover motion-enter"
      style={{
        backgroundImage:
          "linear-gradient(0deg,rgba(12,29,23,.85),rgba(12,29,23,.08) 95%),url(" +
          JSON.stringify(image ?? trail.src) +
          ")",
      }}
    >
      <span>{kicker}</span>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  ),
  Choices: ({ label, current, values, labels, choose }) => (
    <fieldset className="sq-choices">
      <legend>{label}</legend>
      <div>
        {values.map((v, i) => (
          <button
            type="button"
            key={v}
            aria-pressed={v === current || labels?.[i]?.startsWith("✓")}
            onClick={() => choose(v)}
          >
            {labels?.[i] ?? v}
          </button>
        ))}
      </div>
    </fieldset>
  ),
  AreaMap: ({ item }) => {
    const lat = Number(item.latitude),
      lon = Number(item.longitude);
    return (
      <iframe
        loading="lazy"
        title={"Approximate area for " + item.title}
        className="sq-map"
        src={
          "https://www.openstreetmap.org/export/embed.html?bbox=" +
          [lon - 0.035, lat - 0.02, lon + 0.035, lat + 0.02].join(",") +
          "&layer=mapnik&marker=" +
          lat +
          "," +
          lon
        }
      />
    );
  },
  Links: function Links({ item }) {
    const [code, setCode] = useState<boolean[][]>();
    const link = "/activity/" + item.id;
    return (
      <div className="sq-share">
        <a target="_blank" rel="noreferrer" href={"https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(item.latitude != null && item.longitude != null ? `${item.latitude},${item.longitude}` : item.area)}>Get directions to area</a>
        <a href={link}>Activity link</a>
        <a
          target="_blank"
          rel="noreferrer"
          href={
            "https://www.openstreetmap.org/search?query=" +
            encodeURIComponent(item.area)
          }
        >
          Map of area
        </a>
        <button
          onClick={() =>
            setCode(
              code
                ? undefined
                : activityCode(new URL(link, location.origin).href),
            )
          }
        >
          {code ? "Hide QR code" : "Show QR code"}
        </button>
        {code && (
          <svg
            aria-label="Scannable activity link"
            role="img"
            width="190"
            height="190"
            viewBox={[-4, -4, code.length + 8, code.length + 8].join(" ")}
            style={{ background: "white" }}
            shapeRendering="crispEdges"
          >
            <path
              fill="black"
              d={code
                .flatMap((row, y) =>
                  row.map((dark, x) =>
                    dark ? "M" + x + " " + y + "h1v1h-1z" : "",
                  ),
                )
                .join("")}
            />
          </svg>
        )}
      </div>
    );
  },
  Screen: ({ children, footer, contentKey, back }) => (
    <div className="sq-shell">
      <header className="sq-mast">
        <span aria-hidden="true">↗</span>
        <strong>SideQuest</strong>
        {back && <button className="sq-back" type="button" onClick={back}>← Back</button>}
      </header>
      <div key={contentKey} className="sq-content motion-enter">{children}</div>
      {footer}
    </div>
  ),
  Theme: function Theme() {
    const [mode, setMode] = useState(
      () => localStorage.getItem("sidequest-theme") ?? "system",
    );
    return (
      <Button
        onClick={() => {
          const next =
            mode === "system" ? "light" : mode === "light" ? "dark" : "system";
          localStorage.setItem("sidequest-theme", next);
          setMode(next);
          document.documentElement.dataset.theme =
            next === "system"
              ? matchMedia("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light"
              : next;
        }}
      >
        Theme · {mode}
      </Button>
    );
  },
  Nav: ({ current, choose }) => (
    <nav aria-label="Main" className="sq-nav">
      {["Discover", "My Activities", "Create", "Alerts", "Profile"].map(
        (tab) => (
          <button
            key={tab}
            data-create={tab === "Create"}
            aria-current={tab === current ? "page" : undefined}
            onClick={() => choose(tab)}
          >
            {tab === "Create" ? "+ Create" : tab}
          </button>
        ),
      )}
    </nav>
  ),
  Section: ({ children }) => (
    <section className="sq-section">{children}</section>
  ),
  Label: ({ children }) => <p>{children}</p>,
  Field: ({ label, value, change, secret }) => (
    <label>
      {label}
      <Input
        type={secret ? "password" : "text"}
        value={value}
        onChange={(e) => change(e.target.value)}
      />
    </label>
  ),
  Action: ({ label, press, disabled }) => (
    <Button onClick={press} disabled={disabled}>
      {label}
    </Button>
  ),
};
export default function Connected({
  activityId,
}: { activityId?: string } = {}) {
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const mode = localStorage.getItem("sidequest-theme");
      document.documentElement.dataset.theme =
        mode === "dark" || (mode !== "light" && media.matches)
          ? "dark"
          : "light";
    };
    sync();
    media.addEventListener("change", sync);
    window.addEventListener("storage", sync);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const [db] = useState(() =>
    typeof window === "undefined"
      ? undefined
      : connect(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        ),
  );
  return (
    <main>
      <LiveActivities db={db} ui={ui} activityId={activityId} />
    </main>
  );
}
