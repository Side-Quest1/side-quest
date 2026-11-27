import { useEffect, useState } from "react";
import type { SupabaseClient } from "@sidequest/adapters";
import type { Controls } from "./live-activities";

export function AccountHistory({
  ui,
  db,
  user,
  open,
}: {
  ui: Controls;
  db: SupabaseClient;
  user: string;
  open: (id: string) => void;
}) {
  const { Section, Label, Heading, Action, Field } = ui;
  const [blocks, setBlocks] = useState<string[]>([]),
    [reports, setReports] = useState<
      { id: string; state: string; reason: string }[]
    >([]);
  const [saved, setSaved] = useState<{ id: string; title: string }[]>([]);
  const [age, setAge] = useState<number | null>(),
    [verification, setVerification] = useState("not_requested"),
    [birthDate, setBirthDate] = useState(""),
    [moderator, setModerator] = useState(false),
    [requests, setRequests] = useState<
      { user_id: string; birth_date: string; submitted_at: string }[]
    >([]),
    [notice, setNotice] = useState(""),
    [rev, refresh] = useState(0);
  useEffect(() => {
    let active = true;
    void Promise.all([
      db.from("user_blocks").select("blocked").eq("blocker", user).limit(100),
      db
        .from("safety_reports")
        .select("id,state,reason")
        .eq("reporter", user)
        .order("created_at", { ascending: false })
        .limit(30),
      db
        .from("discovery_interactions")
        .select("activity:activities(id,title)")
        .eq("user_id", user)
        .eq("kind", "save")
        .order("happened_at", { ascending: false })
        .limit(60),
      db.rpc("my_age_status"),
      db.rpc("my_age_verification_status"),
      db.rpc("my_moderator_status"),
      db.rpc("pending_age_verifications"),
    ]).then(([b, r, s, a, v, m, q]) => {
      if (!active) return;
      const error = b.error ?? r.error ?? s.error ?? a.error ?? v.error ?? m.error ?? q.error;
      if (error) {
        setNotice(error.message);
        return;
      }
      setBlocks((b.data ?? []).map((row) => row.blocked));
      setReports(r.data ?? []);
      setSaved((s.data ?? []).flatMap((row) => row.activity ?? []));
      setAge(a.data);
      setVerification(v.data ?? "not_requested");
      setModerator(Boolean(m.data));
      setRequests(q.data ?? []);
    });
    return () => {
      active = false;
    };
  }, [db, user, rev]);
  return (
    <Section>
      <Heading>Account and safety</Heading>
      <Label>SideQuest ID · {user}</Label>
      {age !== undefined && (
        <Label>
          {age
            ? "Age group verified · " + (age === 18 ? "18+" : "16–17")
            : "Age verification is required before hosting or joining activities."}
        </Label>
      )}
      {!age && (
        <Section>
          <Field
            label="Date of birth (YYYY-MM-DD)"
            value={birthDate}
            change={setBirthDate}
          />
          <Action
            label={verification === "pending" ? "Update verification request" : "Request age verification"}
            press={async () => {
              const { error } = await db.rpc("submit_age_verification", {
                birth_date: birthDate,
              });
              if (error) setNotice(error.message);
              else {
                setNotice("Your age-verification request was sent to the moderation team.");
                refresh((n) => n + 1);
              }
            }}
          />
          <Label>
            {verification === "pending"
              ? "Verification request pending moderator approval."
              : verification === "rejected"
                ? "Your request was not approved. Confirm the date and submit again."
                : "A moderator must approve your request before you can host or join."}
          </Label>
        </Section>
      )}
      {moderator && (
        <Section>
          <Heading>Age-verification requests</Heading>
          {requests.length === 0 && <Label>No pending requests.</Label>}
          {requests.map((request) => (
            <Section key={request.user_id}>
              <Label>
                {request.user_id} Â· {request.birth_date} Â· {new Date(request.submitted_at).toLocaleDateString()}
              </Label>
              <Action
                label="Approve age verification"
                press={async () => {
                  const { error } = await db.rpc("review_age_verification", {
                    requester: request.user_id,
                    decision: "approve",
                  });
                  if (error) setNotice(error.message);
                  else refresh((n) => n + 1);
                }}
              />
              <Action
                label="Reject age verification"
                press={async () => {
                  const { error } = await db.rpc("review_age_verification", {
                    requester: request.user_id,
                    decision: "reject",
                  });
                  if (error) setNotice(error.message);
                  else refresh((n) => n + 1);
                }}
              />
            </Section>
          ))}
        </Section>
      )}
      {saved.length > 0 && (
        <Section>
          <Heading>Saved activities</Heading>
          {saved.map((a) => (
            <Action key={a.id} label={a.title} press={() => open(a.id)} />
          ))}
        </Section>
      )}
      {blocks.length > 0 && (
        <Section>
          <Heading>Blocked users</Heading>
          {blocks.map((id) => (
            <Action
              key={id}
              label={"Unblock " + id}
              press={async () => {
                const { error } = await db
                  .from("user_blocks")
                  .delete()
                  .eq("blocked", id);
                if (error) setNotice(error.message);
                else refresh((n) => n + 1);
              }}
            />
          ))}
        </Section>
      )}
      {reports.length > 0 && (
        <Section>
          <Heading>My reports</Heading>
          {reports.map((r) => (
            <Label key={r.id}>
              {r.state} · {r.reason}
            </Label>
          ))}
        </Section>
      )}
      {!!notice && <Label>{notice}</Label>}
    </Section>
  );
}
