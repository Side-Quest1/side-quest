import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { QUEST_CATEGORIES } from "@sidequest/shared";
import {
  SupabaseQuestRepository,
  type SupabaseClient,
  type LiveActivity,
} from "@sidequest/adapters";
import { useAccount } from "@sidequest/adapters/use-account";
import { Discovery, useDiscovery } from "./discovery";
import { ActivityEditor } from "./activity-editor";
import { AccountHistory } from "./account-history";
import { Preferences } from "./preferences";
import { finishOnboarding, onboardingKey } from "./onboarding-recovery";
import { imageForCategory } from "@sidequest/shared";

export type Controls = {
  storage: {
    getItem: (k: string) => Promise<string | null>;
    setItem: (k: string, v: string) => Promise<void>;
    removeItem: (k: string) => Promise<void>;
  };
  Heading: ComponentType<{ children: ReactNode }>;
  areaLocation:()=>Promise<{latitude:string;longitude:string}>;
  FeedList: ComponentType<{header:ReactNode;ids:string[];render:(id:string)=>ReactNode;footer:ReactNode}>;
  Cover: ComponentType<{
    title: string;
    kicker: string;
    subtitle: string;
    image?: string;
  }>;
  Choices: ComponentType<{
    label: string;
    values: string[];
    labels?: string[];
    current: string;
    choose: (v: string) => void;
  }>;
  AreaMap: ComponentType<{ item: LiveActivity }>;
  Exposure: ComponentType<{ children: ReactNode; visible: () => void }>;
  Screen: ComponentType<{
    children: ReactNode;
    footer?: ReactNode;
    virtualized?:boolean;
    back?: () => void;
    contentKey?: string;
  }>;
  Theme: ComponentType;
  DeviceAlerts?: ComponentType<{ db: SupabaseClient; user: string }>;
  disconnectDevice?: (db: SupabaseClient, user: string) => Promise<void>;
  Links: ComponentType<{ item: LiveActivity }>;
  Nav: ComponentType<{ current: string; choose: (tab: string) => void }>;
  Section: ComponentType<{ children: ReactNode }>;
  Label: ComponentType<{ children: ReactNode }>;
  Field: ComponentType<{
    label: string;
    value: string;
    change: (value: string) => void;
    secret?: boolean;
  }>;
  Action: ComponentType<{
    label: string;
    press: () => void;
    disabled?: boolean;
  }>;
};

export function LiveActivities({
  db,
  ui,
  redirectTo,
  activityId,
}: {
  db?: SupabaseClient;
  ui: Controls;
  redirectTo?: string;
  activityId?: string;
}) {
  const { session, ready } = useAccount(db);
  const { Section, Label, Field, Action, Heading } = ui;
  const [email, emailChange] = useState("");
  const [password, passwordChange] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const welcome = (
    <ui.Cover
      kicker="SideQuest"
      title="Your next story starts here."
      subtitle="Not Dating. Not Networking. Just Doing Things."
    />
  );
  if (!db)
    return (
      <ui.Screen>
        {welcome}
        <Section>
          <Label>
            Configure the SideQuest Supabase URL and publishable key to connect.
          </Label>
        </Section>
      </ui.Screen>
    );
  if (!ready) return <Label>Loading account…</Label>;
  if (session)
    return (
      <Activities
        key={session.user.id + (activityId ?? "")}
        db={db}
        user={session.user.id}
        ui={ui}
        activityId={activityId}
      />
    );
  async function auth(register: boolean) {
    if (!db || busy) return;
    setBusy(true);
    try {
      const credentials = { email: email.trim(), password };
      const result = register
        ? await db.auth.signUp({
            ...credentials,
            options: { emailRedirectTo: redirectTo },
          })
        : await db.auth.signInWithPassword(credentials);
      if (result.error) throw result.error;
      passwordChange("");
      setNotice(register ? "Check your email to confirm your account." : "");
    } catch (e) {
      setNotice(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <ui.Screen>
      {welcome}
      <Section>
        <ui.Heading>Join the adventure</ui.Heading>
        <Field label="Email" value={email} change={emailChange} />
        <Field
          label="Password"
          value={password}
          change={passwordChange}
          secret
        />
        <Action
          label="Sign in"
          disabled={busy}
          press={() => void auth(false)}
        />
        <Action
          label="Create account"
          disabled={busy}
          press={() => void auth(true)}
        />
        <Action
          label="Email password reset link"
          disabled={busy}
          press={async () => {
            setBusy(true);
            try {
              const { error } = await db.auth.resetPasswordForEmail(
                email.trim(),
                { redirectTo },
              );
              if (error) throw error;
              setNotice("Check your email for a recovery link.");
            } catch (e) {
              setNotice(message(e));
            } finally {
              setBusy(false);
            }
          }}
        />
        <Label>{notice}</Label>
      </Section>
    </ui.Screen>
  );
}

const message = (e: unknown) =>
  e && typeof e === "object" && "message" in e
    ? String(e.message)
    : "Unable to finish this action.";

function Onboarding({
  db,
  user,
  ui,
  complete,
}: {
  db: SupabaseClient;
  user: string;
  ui: Controls;
  complete: () => void;
}) {
  const { Section, Heading, Label, Field, Choices, Action, Cover } = ui;
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [city, setCity] = useState("Hyderabad");
  const [interests, setInterests] = useState<string[]>([]);
  const [birthDate, setBirthDate] = useState("");
  const [area, setArea] = useState({ latitude: "", longitude: "" });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(true);
  useEffect(() => {
    let active = true;
    void ui.storage.getItem(onboardingKey(user)).then((saved) => {
      if (!active || !saved) return;
      const draft = JSON.parse(saved);
      if (typeof draft.name === "string") setName(draft.name);
      if (typeof draft.city === "string") setCity(draft.city);
      if (typeof draft.area?.latitude === "string" && typeof draft.area?.longitude === "string") setArea(draft.area);
      if (Array.isArray(draft.interests)) setInterests(draft.interests.filter((id: string) => QUEST_CATEGORIES.some((c) => c.id === id)));
      setStep(1);
      setStatus("Your unfinished setup was restored. Review it and finish again. Re-enter your date of birth if you want to request verification.");
    }).catch((error) => { if (active) setStatus(message(error)); })
      .finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, [ui.storage, user]);
  const toggle = (id: string) =>
    setInterests((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  async function finish() {
    if (!name.trim() || !city.trim()) {
      setStatus("Add a display name and city to continue.");
      setStep(1);
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      await finishOnboarding({
      checkpoint: () => ui.storage.setItem(onboardingKey(user), JSON.stringify({ name, city, interests, area })),
      profile: async () => {
      const profile = await db.from("account_profiles").upsert({
        user_id: user,
        display_name: name.trim(),
        city: city.trim(),
        interests,
        activity_alerts: true,
      });
      if (profile.error) throw profile.error;
      },
      preferences: async () => {
      const preferences = await db.from("discovery_preferences").upsert({
        user_id: user,
        categories: interests,
        latitude: area.latitude ? Number(area.latitude) : null,
        longitude: area.longitude ? Number(area.longitude) : null,
      });
      if (preferences.error) throw preferences.error;
      },
      verification: async () => {
      if (birthDate.trim()) {
        const verification = await db.rpc("submit_age_verification", {
          birth_date: birthDate.trim(),
        });
        if (verification.error) throw verification.error;
      }
      },
      clear: () => ui.storage.removeItem(onboardingKey(user)),
      });
      complete();
    } catch (error) {
      setStatus(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <ui.Screen contentKey={"onboarding-" + step}>
      <Section>
        <Cover
          kicker="Welcome to SideQuest"
          title={step === 0 ? "Make your free time memorable." : step === 1 ? "Tell us your kind of plan." : "One last step before you explore."}
          subtitle="Small plans, real people, and a reason to leave the group chat."
        />
        {step === 0 ? (
          <Section>
            <Heading>Start with what feels possible.</Heading>
            <Label>Choose a few interests and your local area. You can change everything later.</Label>
            <Action label={restoring ? "Restoring setup…" : "Set up my SideQuest"} disabled={restoring} press={() => setStep(1)} />
          </Section>
        ) : step === 1 ? (
          <Section>
            <Heading>Your local starting point</Heading>
            <Field label="Display name" value={name} change={setName} />
            <Field label="City" value={city} change={setCity} />
            <Choices
              label="What sounds good lately?"
              current=""
              values={QUEST_CATEGORIES.map((category) => category.id)}
              labels={QUEST_CATEGORIES.map((category) =>
                (interests.includes(category.id) ? "✓ " : "") + category.label,
              )}
              choose={toggle}
            />
            <Action
              label="Use my approximate area"
              disabled={busy}
              press={async () => {
                setBusy(true);
                try {
                  setArea(await ui.areaLocation());
                  setStatus("Approximate area added. It is used only for nearby discovery.");
                } catch (error) {
                  setStatus(message(error));
                } finally {
                  setBusy(false);
                }
              }}
            />
            <Action label="Continue" disabled={busy} press={() => setStep(2)} />
          </Section>
        ) : (
          <Section>
            <Heading>Help keep SideQuest safe.</Heading>
            <Label>Age verification is needed before hosting or joining. A moderator reviews this request.</Label>
            <Field label="Date of birth (YYYY-MM-DD)" value={birthDate} change={setBirthDate} />
            <Action label={birthDate ? "Finish and request verification" : "Finish setup for now"} disabled={busy} press={() => void finish()} />
            <Action label="Back" disabled={busy} press={() => setStep(1)} />
          </Section>
        )}
        {!!status && <Label>{status}</Label>}
      </Section>
    </ui.Screen>
  );
}

function Activities({
  db,
  user,
  ui,
  activityId,
}: {
  db: SupabaseClient;
  user: string;
  ui: Controls;
  activityId?: string;
}) {
  const { Section, Label, Field, Action, Heading } = ui;
  const repo = useMemo(() => new SupabaseQuestRepository(db), [db]);
  const [onboarding, setOnboarding] = useState<boolean>();
  const [setupError, setSetupError] = useState("");
  const [setupAttempt, setSetupAttempt] = useState(0);
  const [items, setItems] = useState<LiveActivity[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<LiveActivity>();
  const [tab, setTab] = useState("Discover");
  const [detail, setDetail] = useState(activityId);
  const [alerts, setAlerts] = useState<
    {
      id: number;
      body: string;
      created_at: string;
      activity_id: string;
      read_at: string | null;
    }[]
  >([]);
  const [group, setGroup] = useState("All");
  const [bio, setBio] = useState(""),
    [avatar, setAvatar] = useState("🌿"),
    [invite, setInvite] = useState("");
  const [connection, setConnection] = useState("Connecting");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [interests, setInterests] = useState("");
  const [activityAlerts, setActivityAlerts] = useState(true);
  const [reportId, setReportId] = useState("");
  const [reportedUser, setReportedUser] = useState("");
  const [reason, setReason] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [budget, setBudget] = useState("");
  const [pages, setPages] = useState(1);
  const [chat, setChat] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<
    Awaited<ReturnType<typeof repo.messages>>
  >([]);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setSetupError("");
    void Promise.all([db
      .from("account_profiles")
      .select("user_id")
      .eq("user_id", user)
      .maybeSingle(), ui.storage.getItem(onboardingKey(user))])
      .then(([{ data, error }, pending]) => {
        if (!active) return;
        if (error) setSetupError(error.message);
        else setOnboarding(!data || pending !== null);
      }).catch((error) => { if (active) setSetupError(message(error)); });
    return () => {
      active = false;
    };
  }, [db, user, ui.storage, setupAttempt]);
  const feed = useDiscovery(
    db,
    tab === "Discover" && !detail && !creating,
    revision,
    ui.storage,
    user,
  );
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    if (tab === "Alerts") {
      const load = async () => {
        const { data, error } = await db
          .from("activity_alerts")
          .select("id,body,activity_id,created_at,read_at")
          .eq("recipient", user)
          .order("id", { ascending: false })
          .limit(50);
        if (active) {
          if (error) setNotice(error.message);
          else setAlerts(data ?? []);
        }
      };
      void load();
      const channel = db
        .channel("my-alerts")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "activity_alerts",
            filter: "recipient=eq." + user,
          },
          load,
        )
        .on("system",{},event=>{if(active && event.extension==="postgres_changes" && event.status==="ok")void load();})
        .subscribe((status) => {
          if (status === "SUBSCRIBED") void load();
        });
      return () => {
        active = false;
        void db.removeChannel(channel);
      };
    }
    if (tab === "Profile")
      void db
        .from("account_profiles")
        .select("*")
        .eq("user_id", user)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!active) return;
          if (error) setNotice(error.message);
          else if (data) {
            setName(data.display_name);
            setCity(data.city);
            setInterests(data.interests.join(", "));
            setActivityAlerts(data.activity_alerts);
            setBio(data.bio);
            setAvatar(data.avatar);
          }
        });
    return () => {
      active = false;
    };
  }, [db, user, tab]);
  useEffect(() => {
    let active = true;
    if (!detail && tab !== "My Activities") return;
    setItems([]);
    const query = detail
      ? repo.byId(detail).then((a) => (a ? [a] : []))
      : repo.discover({
          search,
          category,
          budget,
          pages,
          group,
          mine: tab === "My Activities" ? user : undefined,
        });
    query
      .then((rows) => {
        if (active) setItems(rows);
      })
      .catch((e) => {
        if (active) setNotice(message(e));
      });
    return () => {
      active = false;
    };
  }, [
    repo,
    revision,
    search,
    category,
    budget,
    pages,
    tab,
    user,
    detail,
    group,
  ]);
  useEffect(() => {
    if (!chat) return;
    let active = true;
    let generation = 0;
    const reload = async () => {
      const request = ++generation;
      try {
        const rows = await repo.messages(chat);
        if (active && request === generation) setMessages(rows);
      } catch (e) {
        if (active) setNotice(message(e));
      }
    };
    setConnection("Connecting");
    void reload();
    const channel = db
      .channel("activity-" + chat)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_messages",
          filter: "activity_id=eq." + chat,
        },
        reload,
      )
      .on("system",{},event=>{if(active && event.extension==="postgres_changes" && event.status==="ok")void reload();})
      .subscribe((status) => {
        if (!active) return;
        setConnection(status === "SUBSCRIBED" ? "Live" : "Reconnecting");
        if (status === "SUBSCRIBED") void reload();
      });
    return () => {
      active = false;
      void db.removeChannel(channel);
    };
  }, [chat, db, repo, revision]);
  async function act(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    try {
      await work();
      setRevision((n) => n + 1);
    } catch (e) {
      setNotice(message(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const button = (label: string, work: () => Promise<void>) => (
    <Action label={label} press={() => void act(work)} disabled={busy} />
  );
  async function openForm(a?: LiveActivity) {
    if (!a) {
      const { data, error } = await db.rpc("my_age_status");
      if (error) {
        setNotice(error.message);
        return;
      }
      if (!data) {
        setTab("Profile");
        setNotice("Age verification is required before publishing. Submit your date of birth in Profile and wait for moderator approval.");
        return;
      }
    }
    setEditing(a);
    setCreating(true);
  }
  const back = chat
    ? () => setChat("")
    : reportId
      ? () => setReportId("")
      : creating
        ? () => setCreating(false)
        : detail
          ? () => setDetail(undefined)
          : tab !== "Discover"
            ? () => setTab("Discover")
            : undefined;
  const footer =
    !chat && !reportId && !creating ? (
      <ui.Nav
        current={tab}
        choose={(item) => {
          setNotice("");
          setDetail(undefined);
          if (item === "Create") void openForm();
          else setTab(item);
        }}
      />
    ) : undefined;
  const contentKey = [tab, detail ?? "", creating ? "create" : "", editing?.id ?? "", chat, reportId].join(":");
  if (onboarding === undefined)
    return <ui.Screen contentKey="onboarding-loading"><Label>{setupError || "Setting up your SideQuest…"}</Label>{!!setupError && <Action label="Retry setup" press={() => setSetupAttempt((value) => value + 1)} />}</ui.Screen>;
  if (onboarding)
    return <Onboarding db={db} user={user} ui={ui} complete={() => setOnboarding(false)} />;
  if(tab==="Discover" && !detail && !creating && !chat && !reportId) return <ui.Screen contentKey={contentKey} virtualized footer={footer}>
    {!!notice && <Label>{notice}</Label>}<Discovery feed={feed} ui={ui} open={setDetail} run={work=>void act(work)}/>
  </ui.Screen>;
  return (
    <ui.Screen contentKey={contentKey} back={back} footer={footer}>
      <Section key={contentKey}>
        {!!notice && <Label>{notice}</Label>}
        {reportId ? (
          <Section>
            <Field
              label="Reason for report"
              value={reason}
              change={setReason}
            />
            {button("Submit report", async () => {
              const { error } = await db
                .from("safety_reports")
                .insert({
                  activity_id: reportId,
                  reported_user: reportedUser || null,
                  reason,
                });
              if (error) throw error;
              setReason("");
              setReportId("");
              setReportedUser("");
              setNotice("Report submitted.");
            })}
            <Action label="Back" press={() => setReportId("")} />
          </Section>
        ) : !creating && !detail && tab === "Alerts" ? (
          <Section>
            <ui.Heading>Alerts</ui.Heading>
            {alerts.length === 0 && (
              <Section>
                <Heading>Your plans are quiet for now.</Heading>
                <Label>When someone joins, requests access, or sends a message, it will appear here.</Label>
                <Action label="Explore activities" press={() => setTab("Discover")} />
              </Section>
            )}
            {alerts.map((a, i) => (
              <Section key={a.id}>
                {(i === 0 ||
                  new Date(alerts[i - 1].created_at).toDateString() !==
                    new Date(a.created_at).toDateString()) && (
                  <ui.Heading>
                    {new Date(a.created_at).toLocaleDateString()}
                  </ui.Heading>
                )}
                <Label>
                  {a.read_at ? "" : "Unread · "}
                  {a.body} · {new Date(a.created_at).toLocaleTimeString()}
                </Label>
                {button("View activity", async () => {
                  const { error } = await db
                    .from("activity_alerts")
                    .update({ read_at: new Date().toISOString() })
                    .eq("id", a.id);
                  if (error) throw error;
                  setDetail(a.activity_id);
                  setTab("Discover");
                })}
              </Section>
            ))}
          </Section>
        ) : !creating && !detail && tab === "Profile" ? (
          <Section>
            <ui.Heading>Profile</ui.Heading>
            <Field label="Display name" value={name} change={setName} />
            <ui.Theme />
            <ui.Choices
              label="Profile avatar"
              current={avatar}
              values={["🌿", "🏕️", "☕", "🎨", "🎧", "⚽"]}
              choose={setAvatar}
            />
            <Field label="Bio" value={bio} change={setBio} />
            {ui.DeviceAlerts && <ui.DeviceAlerts db={db} user={user} />}
            <Preferences
              db={db}
              user={user}
              ui={ui}
              saved={() => setRevision((n) => n + 1)}
            />
            <AccountHistory
              ui={ui}
              db={db}
              user={user}
              open={(id) => {
                setDetail(id);
                setTab("Discover");
              }}
            />
            <Field label="City" value={city} change={setCity} />
            <Field
              label="Interests (comma separated)"
              value={interests}
              change={setInterests}
            />
            <Action
              label={
                activityAlerts ? "Activity alerts on" : "Activity alerts off"
              }
              press={() => setActivityAlerts(!activityAlerts)}
            />
            {button("Save profile", async () => {
              const { error } = await db.from("account_profiles").upsert({
                user_id: user,
                display_name: name.trim(),
                city,
                bio,
                avatar,
                interests: interests
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                activity_alerts: activityAlerts,
              });
              if (error) throw error;
              setNotice("Profile saved.");
            })}
            <Field
              label="New password"
              value={newPassword}
              change={setNewPassword}
              secret
            />
            {button("Update password", async () => {
              const { error } = await db.auth.updateUser({
                password: newPassword,
              });
              if (error) throw error;
              setNewPassword("");
              setNotice("Password updated.");
            })}
            <Field
              label="Type DELETE to permanently delete your account and hosted activities"
              value={deleteConfirmation}
              change={setDeleteConfirmation}
            />
            {deleteConfirmation === "DELETE" &&
              button("Permanently delete account", async () => {
                const { error } = await db.functions.invoke("delete-account", {
                  body: { confirmation: deleteConfirmation },
                });
                if (error) throw error;
                await db.auth.signOut({ scope: "local" });
              })}
          </Section>
        ) : chat ? (
          <Section>
            <ui.Heading>Activity chat</ui.Heading>
            <Label>{connection}</Label>
            {connection !== "Live" && (
              <Action
                label="Retry chat connection"
                press={() => setRevision((n) => n + 1)}
              />
            )}
            {messages.map((m) => (
              <Section key={m.id}>
                <Label>
                  {m.sender === user ? "You" : "Participant"} ·{" "}
                  {new Date(m.created_at).toLocaleTimeString()}
                </Label>
                <Label>{m.body}</Label>
              </Section>
            ))}
            <Field label="Message" value={draft} change={setDraft} />
            {button("Send", async () => {
              await repo.send(chat, draft);
              setDraft("");
            })}
            <Action label="Back" press={() => setChat("")} />
          </Section>
        ) : creating ? (
          <ActivityEditor
            ui={ui}
            user={user}
            repo={repo}
            activity={editing}
            close={() => setCreating(false)}
            done={(id) => {
              setCreating(false);
              setTab("Discover");
              setDetail(id);
              setNotice(editing ? "Activity updated." : "Activity published.");
              setRevision((n) => n + 1);
            }}
          />
        ) : (
          <Section>
            {detail ? (
              <Action
                label="Back to activities"
                press={() => setDetail(undefined)}
              />
            ) : (
              <Section>
                <ui.Heading>{tab}</ui.Heading>
                <Field
                  label="Search activity titles"
                  value={search}
                  change={(s) => {
                    setSearch(s);
                    setPages(1);
                  }}
                />
                <Action
                  label={"Category · " + (category || "All")}
                  press={() => {
                    setCategory(
                      QUEST_CATEGORIES[
                        QUEST_CATEGORIES.findIndex((c) => c.id === category) + 1
                      ]?.id ?? "",
                    );
                    setPages(1);
                  }}
                />
                <ui.Choices
                  label="My activities"
                  current={group}
                  values={[
                    "All",
                    "Hosting",
                    "Joined",
                    "Pending",
                    "Upcoming",
                    "Past",
                  ]}
                  choose={(g) => {
                    setGroup(g);
                    setPages(1);
                  }}
                />
                <Field
                  label="Maximum budget (INR)"
                  value={budget}
                  change={(s) => {
                    if (/^\d{0,8}$/.test(s)) {
                      setBudget(s);
                      setPages(1);
                    }
                  }}
                />
                <Action
                  label="Refresh"
                  press={() => setRevision((n) => n + 1)}
                />
              </Section>
            )}
            {items.length === 0 && (
              <Label>No activities available for this account.</Label>
            )}
            {items
              .filter(
                (a) =>
                  (tab !== "My Activities" ||
                    a.participations.some(
                      (p) =>
                        p.user_id === user &&
                        ["accepted", "pending"].includes(p.status),
                    )) &&
                  (detail ||
                    (a.title + " " + a.area)
                      .toLowerCase()
                      .includes(search.trim().toLowerCase())),
              )
              .map((a) => {
                const member = a.participations.find(
                  (p) => p.user_id === user,
                )?.status;
                return (
                  <Section key={a.id}>
                    <ui.Cover
                      title={a.title}
                      kicker={a.category}
                      subtitle={a.area}
                      image={imageForCategory(a.category)}
                    />
                    <Label>{a.description}</Label>
                    <Label>
                      {a.visibility} ·{" "}
                      {a.join_mode === "instant"
                        ? "Instant join"
                        : "Host approval"}{" "}
                      ·{" "}
                      {Math.round(
                        (Date.parse(a.ends_at) - Date.parse(a.starts_at)) /
                          60000,
                      )}{" "}
                      minutes · Capacity {a.capacity}
                    </Label>
                    {a.activity_host && (
                      <Label>Hosted by {a.activity_host}</Label>
                    )}
                    {!!a.type_notes && <Label>{a.type_notes}</Label>}
                    {!!a.requirements && (
                      <Label>Requirements · {a.requirements}</Label>
                    )}
                    {detail && a.latitude != null && a.longitude != null && (
                      <ui.AreaMap item={a} />
                    )}
                    {a.host_id === user && a.visibility === "invite-only" && (
                      <Section>
                        <Field
                          label="Invite participant by SideQuest user ID"
                          value={invite}
                          change={setInvite}
                        />
                        {button("Invite participant", async () => {
                          const { error } = await db
                            .from("activity_invites")
                            .insert({
                              activity_id: a.id,
                              recipient: invite.trim(),
                            });
                          if (error) throw error;
                          setInvite("");
                          setNotice("Invitation saved.");
                        })}
                      </Section>
                    )}
                    {tab === "My Activities" && (
                      <Label>
                        {a.host_id === user
                          ? "Hosting"
                          : member === "pending"
                            ? "Pending"
                            : "Joined"}
                      </Label>
                    )}
                    <Label>
                      {new Date(a.starts_at).toLocaleString()} · {a.area} ·{" "}
                      {a.available_spots} spots · ₹{a.cost_inr} · {a.state}
                    </Label>
                    <Section>
                    <Heading>Your next step</Heading>
                    <Label>{a.host_id === user ? "Manage your quest and meet your group." : member === "pending" ? "Your request is waiting for the host. Chat opens once you are accepted." : member === "accepted" ? "You’re in. Plan your route and say hello to your group." : "Join this quest to take part in the group conversation."}</Label>
                    {a.state === "open" &&
                      (a.host_id === user ? (
                        <Section>
                          <Action
                            label="Edit activity"
                            press={() => void openForm(a)}
                          />
                      {Date.now()>=Date.parse(a.starts_at) && button("Complete", () =>
                            repo.participate(a.id, "complete"),
                          )}
                          {button("Cancel activity", () =>
                            repo.participate(a.id, "cancel"),
                          )}
                          {a.participations
                            .filter((p) => p.status === "pending")
                            .map((p) => (
                              <Section key={p.user_id}>
                                <Label>Request from {p.user_id}</Label>
                                {button("Approve", () =>
                                  repo.participate(a.id, "approve", p.user_id),
                                )}
                                {button("Reject", () =>
                                  repo.participate(a.id, "reject", p.user_id),
                                )}
                              </Section>
                            ))}
                        </Section>
                      ) : member === "pending" || member === "accepted" ? (
                        button(
                          member === "pending" ? "Cancel request" : "Leave",
                          () => repo.participate(a.id, "leave"),
                        )
                      ) : (
                        a.available_spots<=0 || Date.now()>=Date.parse(a.starts_at) ? <Label>Joining closed</Label> : button(
                          a.join_mode === "approval"
                            ? "Request to join"
                            : "Join",
                          () => repo.participate(a.id, "join"),
                        )
                      ))}
                    <ui.Links item={a} />
                    {member === "accepted" && (
                      <Action
                        label="Open quest chat"
                        press={() => {
                          setMessages([]);
                          setDraft("");
                          setChat(a.id);
                          void db.from("activity_alerts").update({read_at:new Date().toISOString()}).eq("recipient",user).eq("activity_id",a.id).eq("body","New activity chat message").is("read_at",null).then(({error})=>{if(error)setNotice(error.message);});
                        }}
                      />
                    )}
                    </Section>
                    {a.state === "completed" && member === "accepted" && (
                      <Section>
                        <Label>Rate this activity</Label>
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <Action
                            key={rating}
                            label={String(rating)}
                            disabled={busy}
                            press={() =>
                              void act(async () => {
                                const { error } = await db
                                  .from("activity_feedback")
                                  .insert({ activity_id: a.id, rating });
                                if (error) throw error;
                                setNotice("Feedback saved.");
                              })
                            }
                          />
                        ))}
                      </Section>
                    )}
                    {a.state === "open" &&
                      member === "accepted" &&
                      Date.now()<Date.parse(a.starts_at) && button("Confirm attendance", async () => {
                        const { error } = await db
                          .from("attendance")
                          .insert({ activity_id: a.id });
                        if (error && error.code !== "23505") throw error;
                        setNotice("Attendance confirmed.");
                      })}
                    {member==="accepted" && a.state!=="cancelled" && Date.now()>=Date.parse(a.starts_at) && Date.now()<Date.parse(a.ends_at)+86400000 &&
                      button("Check in",async()=>{const {error}=await db.rpc("check_in_activity",{q:a.id});if(error)throw error;setNotice("Checked in.");})}
                    <Action
                      label="Report activity"
                      press={() => {
                        setReportedUser("");
                        setReportId(a.id);
                      }}
                    />
                    {a.host_id !== user && (
                      <Action
                        label="Report host"
                        press={() => {
                          setReportedUser(a.host_id);
                          setReportId(a.id);
                        }}
                      />
                    )}
                    {a.host_id !== user &&
                      button("Block host", async () => {
                        const { error } = await db
                          .from("user_blocks")
                          .insert({ blocked: a.host_id });
                        if (error) throw error;
                      })}
                  </Section>
                );
              })}
            {items.length === pages * 20 && (
              <Action label="Load more" press={() => setPages((p) => p + 1)} />
            )}
          </Section>
        )}
        {tab === "Profile" &&
          button("Sign out", async () => {
            await ui.disconnectDevice?.(db, user);
            const { error } = await db.auth.signOut();
            if (error) throw error;
          })}
      </Section>
    </ui.Screen>
  );
}
