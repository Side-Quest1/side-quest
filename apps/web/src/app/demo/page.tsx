"use client";

import { useEffect, useState } from "react";

const plans = [
  { id: "cricket", title: "Evening cricket", area: "Gachibowli, Hyderabad", lat: 17.44, lon: 78.35, price: 200 },
  { id: "coffee", title: "Coffee and conversations", area: "Jubilee Hills, Hyderabad", lat: 17.43, lon: 78.41, price: 300 },
  { id: "walk", title: "Lakeside morning walk", area: "Hussain Sagar, Hyderabad", lat: 17.42, lon: 78.47, price: 0 },
  { id: "games", title: "Board games for beginners", area: "Kondapur, Hyderabad", lat: 17.46, lon: 78.36, price: 150 },
  { id: "study", title: "A focused study afternoon", area: "Himayatnagar, Hyderabad", lat: 17.40, lon: 78.49, price: 0 },
];
type Message = { author: string; body: string };

export default function Demo() {
  const [selected, setSelected] = useState(plans[0]);
  const [date, setDate] = useState("");
  const [joined, setJoined] = useState<string[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [draft, setDraft] = useState("");
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDate(tomorrow.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }));
  }, []);
  const member = joined.includes(selected.id);
  return <main className="sq-shell">
    <header className="sq-mast">SideQuest demo <a className="sq-back" href="/">Back to live app</a></header>
    <div className="sq-content sq-section">
      <h1 className="sq-heading">Try a Hyderabad side quest</h1>
      <p>Demo only. These are fictional plans and approximate area markers, not scheduled meetups. Chat and joins stay in this page and reset on reload.</p>
      <div className="sq-choices"><div>{plans.map(plan => <button key={plan.id} aria-pressed={selected.id === plan.id} onClick={() => { setSelected(plan); setDraft(""); }}>{plan.title}</button>)}</div></div>
      <section className="sq-activity">
        <h2 className="sq-heading">{selected.title}</h2>
        <p>{date || "Tomorrow"} · {selected.area} · {selected.price ? `₹${selected.price}` : "Free"}</p>
        <p>Sample host · Six-person plan · Beginner friendly</p>
        <iframe key={selected.id} className="sq-map" title={`Demo area map: ${selected.area}`} loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${selected.lon-.02},${selected.lat-.02},${selected.lon+.02},${selected.lat+.02}&layer=mapnik&marker=${selected.lat},${selected.lon}`} />
        <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lon}`}>Get directions to this sample area ↗</a>
        <button className="sq-back" onClick={() => setJoined(current => member ? current.filter(id => id !== selected.id) : [...current, selected.id])}>{member ? "Leave demo quest" : "Join demo quest"}</button>
      </section>
      <section className="sq-activity" aria-label="Quest chat room">
        <h2 className="sq-heading">{selected.title} chat</h2>
        {!member ? <p>Join this demo quest to try its chat room.</p> : <>
          <p>Simulated host: Welcome! Use this room to coordinate your plan.</p>
          <div role="log" aria-live="polite">{(messages[selected.id] ?? []).map((message, i) => <p key={i}><strong>{message.author}:</strong> {message.body}</p>)}</div>
          <form className="sq-section" onSubmit={event => { event.preventDefault(); if (!draft.trim()) return; setMessages(current => ({ ...current, [selected.id]: [...(current[selected.id] ?? []), { author: "You (demo)", body: draft.trim() }] })); setDraft(""); }}>
            <label>Message this quest<input className="sq-back" maxLength={1500} value={draft} onChange={event => setDraft(event.target.value)} /></label>
            <button className="sq-back" disabled={!draft.trim()}>Send demo message</button>
          </form>
        </>}
      </section>
    </div>
  </main>;
}
