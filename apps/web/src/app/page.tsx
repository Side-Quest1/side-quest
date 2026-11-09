"use client";
import { useEffect, useMemo, useState } from "react";
import {
  CURRENT_USER_ID,
  MockQuestRepository,
  QUEST_CATEGORIES,
  QUEST_ACTIVITY_TYPES,
  mockParticipants,
  mockProfiles,
  mockQuests,
  spotsRemaining,
  validateQuestCreation,
  type QuestCategory,
  type QuestActivityType,
  type JoinMode,
  type Visibility,
  type QuestParticipant,
  type QuestCreationInput,
  type MyActivityGroups,
  type ChatMessage,
  type SideQuest,
  type UserProfile,
  type AccountSettings,
  type UserReport,
  type BlockedUser,
} from "@sidequest/shared";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  LoadingState,
} from "@sidequest/ui/web";
import type { ThemeMode } from "@sidequest/ui";
import { QuestCard, type QuestCardData } from "@sidequest/ui/quest-card";

const repository = new MockQuestRepository();
function imageForCategory(category: string): string {
  const images: Record<string, string> = {
    sports: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=900&q=80",
    food: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=900&q=80",
    adventure: "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=900&q=80",
    fitness: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=80",
    travel: "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=900&q=80",
    gaming: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=900&q=80",
    study: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=900&q=80",
    music: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=80",
    photography: "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?auto=format&fit=crop&w=900&q=80",
    movies: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80",
    social: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80",
  };

  return images[category.toLowerCase()] ?? images.social;
}
function toCardData(quest: SideQuest): QuestCardData {
  return {
    title: quest.title,
    description: quest.description,
    category: QUEST_CATEGORIES.find((item) => item.id === quest.category)?.label ?? quest.category,
    date: quest.date,
    startTime: quest.startTime,
    locationLabel: quest.locationLabel,
    approximateDistance: quest.approximateDistance,
    capacity: quest.capacity,
    participantCount: quest.participantIds.length,
    estimatedCost: quest.estimatedCost,
    status: quest.status,
    joinMode: quest.joinMode,
  };
}

function actionForQuest(quest: SideQuest, pending: QuestParticipant | undefined) {
  if (quest.participantIds.includes(CURRENT_USER_ID)) return { label: "Leave quest", disabled: false };
  if (pending?.status === "pending") return { label: "Cancel request", disabled: false };
  if (quest.status === "full") return { label: "Full", disabled: true };
  if (quest.status !== "open") return { label: "Unavailable", disabled: true };
  return quest.joinMode === "approval"
    ? { label: "Request to join", disabled: false }
    : { label: "Join quest", disabled: false };
}

export default function Home() {
  const [quests, setQuests] = useState<SideQuest[]>(() => mockQuests.map((quest) => structuredClone(quest)));
  const [profiles, setProfiles] = useState<UserProfile[]>(() => mockProfiles.map((profile) => structuredClone(profile)));
  const [participants, setParticipants] = useState<QuestParticipant[]>(() => mockParticipants.map((participant) => structuredClone(participant)));
  const [pendingRequests, setPendingRequests] = useState<QuestParticipant[]>([]);
  const [selectedQuestId, setSelectedQuestId] = useState<string>();
  const [selectedCategory, setSelectedCategory] = useState<QuestCategory>();
  const [search, setSearch] = useState("");
  const [maxCost, setMaxCost] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string>();
  const [busyQuestIds, setBusyQuestIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>();
  const [feedback, setFeedback] = useState<string>();
  const [showMyQuests, setShowMyQuests] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createCategory, setCreateCategory] = useState<QuestCategory>("social");
  const [createActivityType, setCreateActivityType] = useState<QuestActivityType>("social");
  const [createDate, setCreateDate] = useState("2026-11-21");
  const [createStartTime, setCreateStartTime] = useState("10:00");
  const [createEndTime, setCreateEndTime] = useState("12:00");
  const [createLocation, setCreateLocation] = useState("Bengaluru");
  const [createCapacity, setCreateCapacity] = useState("6");
  const [createTeamSize, setCreateTeamSize] = useState("");
  const [createJoinMode, setCreateJoinMode] = useState<JoinMode>("instant");
  const [createVisibility, setCreateVisibility] = useState<Visibility>("public");
  const [createCost, setCreateCost] = useState("");
  const [createError, setCreateError] = useState<string>();
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>({});
  const [createReview, setCreateReview] = useState(false);
  const [creating, setCreating] = useState(false);
  const [myActivities, setMyActivities] = useState<MyActivityGroups>();
  const [myActivitiesLoading, setMyActivitiesLoading] = useState(false);
  const [myActivitiesError, setMyActivitiesError] = useState<string>();
  const [busyActionKey, setBusyActionKey] = useState<string>();
  const [recap, setRecap] = useState<string>();
  const [coordinationQuestId, setCoordinationQuestId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [safetyFeedback, setSafetyFeedback] = useState<string>();
  const [showSettings, setShowSettings] = useState(false);
  const [profile, setProfile] = useState<UserProfile>();
  const [settings, setSettings] = useState<AccountSettings>();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [reports, setReports] = useState<Array<UserReport & { status: "submitted" | "reviewing" | "resolved" }>>([]);
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [themeReady, setThemeReady] = useState(false);
  useEffect(() => {
    const saved = window.localStorage.getItem("sidequest-theme");
    if (saved === "light" || saved === "dark" || saved === "system") {
      // Preference hydration is intentionally deferred to avoid server/client markup differences.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThemeMode(saved);
    }
    // Keep the server-rendered theme until the saved preference has been applied.
    setThemeReady(true);
  }, []);

  useEffect(() => {
    if (!themeReady) return;
    const dark = themeMode === "dark" ||
      (themeMode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.body.dataset.theme = dark ? "dark" : "light";
    window.localStorage.setItem("sidequest-theme", themeMode);
  }, [themeMode, themeReady]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => {
      if (themeMode === "system") {
        const dark = media.matches;
        document.documentElement.dataset.theme = dark ? "dark" : "light";
        document.body.dataset.theme = dark ? "dark" : "light";
      }
    };
    media.addEventListener("change", updateSystemTheme);
    return () => media.removeEventListener("change", updateSystemTheme);
  }, [themeMode]);

  const loadDiscoverPage = async (cursor?: string) => {
    if (cursor) setLoadingMore(true);
    else setLoading(true);
    setError(undefined);
    try {
      const page = await repository.getQuestPage({
        ...(selectedCategory ? { category: selectedCategory } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(maxCost ? { maxCost: Number(maxCost) } : {}),
        limit: 20,
        ...(cursor ? { cursor } : {}),
      });
      setQuests((current) => cursor ? [...current, ...page.items] : page.items);
      setNextCursor(page.nextCursor);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load quests");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    // Repository-backed discovery state is synchronized after filter changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDiscoverPage();
    // Filter changes intentionally reload the first page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, search, maxCost]);

  const refresh = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [nextQuests, nextProfiles, nextPending, nextActivities] = await Promise.all([
        repository.getQuests(),
        repository.getProfiles(),
        repository.getPendingRequestsForHost(CURRENT_USER_ID),
        repository.getMyActivities(CURRENT_USER_ID),
      ]);
      setQuests(nextQuests);
      setNextCursor(undefined);
      setProfiles(nextProfiles);
      setPendingRequests(nextPending);
      setMyActivities(nextActivities);
      setParticipants(
        nextQuests.flatMap((quest) =>
          quest.participantIds.map((userId, index) => ({
            id: `${quest.id}-visible-${index}`,
            questId: quest.id,
            userId,
            status: "accepted" as const,
            joinedAt: quest.createdAt,
          })),
        ),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load quests");
    } finally {
      setLoading(false);
    }
  };

  const visibleQuests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return quests.filter((quest) => {
      const matchesStatus = quest.status === "open" || quest.status === "full";
      const matchesCategory = !selectedCategory || quest.category === selectedCategory;
      const matchesSearch =
        !query ||
        `${quest.title} ${quest.description} ${quest.locationLabel}`
          .toLowerCase()
          .includes(query);
      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [quests, search, selectedCategory]);

  const featuredQuests = visibleQuests.filter((quest) => quest.featured);
  const nearbyQuests = visibleQuests.filter((quest) => !quest.featured);
  const selectedQuest = quests.find((quest) => quest.id === selectedQuestId);
  const selectedParticipants = selectedQuest
    ? participants.filter((participant) => participant.questId === selectedQuest.id)
    : [];
  const profileName = (userId: string) =>
    profiles.find((profile) => profile.id === userId)?.displayName ?? "SideQuest member";

  const runMembershipAction = async (quest: SideQuest) => {
    if (busyQuestIds.has(quest.id)) return;
    setFeedback(undefined);
    setBusyQuestIds((current) => new Set(current).add(quest.id));
    try {
      const action = actionForQuest(
        quest,
        participants.find(
          (participant) =>
            participant.questId === quest.id && participant.userId === CURRENT_USER_ID,
        ),
      );
      if (action.disabled) return;
      const participant = participants.find(
        (item) => item.questId === quest.id && item.userId === CURRENT_USER_ID,
      );
      if (participant?.status === "pending" || participant?.status === "accepted") {
        await repository.leaveQuest(quest.id, CURRENT_USER_ID);
        setFeedback(participant.status === "pending" ? "Join request cancelled." : "You left the quest.");
      } else {
        const joinedParticipant =
          quest.joinMode === "approval"
            ? await repository.requestToJoin(quest.id, CURRENT_USER_ID)
            : await repository.joinQuest(quest.id, CURRENT_USER_ID);
        setParticipants((current) => [...current, joinedParticipant]);
        setFeedback(
          joinedParticipant.status === "pending"
            ? "Your request was sent to the host."
            : "You joined the quest.",
        );
      }
      await refresh();
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "Unable to update membership");
    } finally {
      setBusyQuestIds((current) => {
        const next = new Set(current);
        next.delete(quest.id);
        return next;
      });
    }
  };

  const createQuest = async () => {
    if (creating) return;
    setCreateError(undefined);
    setCreateFieldErrors({});
    setCreating(true);
    try {
      const input: QuestCreationInput = {
        title: createTitle,
        description: createDescription,
        category: createCategory,
        activityType: createActivityType,
        ...(createActivityType === "team-sport" && createTeamSize ? { activityDetails: { teamSize: Number(createTeamSize) } } : {}),
        hostId: CURRENT_USER_ID,
        date: createDate,
        startTime: createStartTime,
        endTime: createEndTime,
        locationLabel: createLocation,
        capacity: Number(createCapacity),
        ...(createCost ? { estimatedCost: { amount: Number(createCost), currency: "INR" } } : {}),
        visibility: createVisibility,
        joinMode: createJoinMode,
        minimumAge: 16,
        featured: false,
      };
      const validation = validateQuestCreation(input);
      if (!validation.success) {
        setCreateFieldErrors(validation.errors);
        setCreateError("Check the highlighted fields.");
        return;
      }
      if (!createReview) {
        setCreateReview(true);
        return;
      }
      const created = await repository.createQuest(input);
      setCreateTitle("");
      setCreateDescription("");
      setShowCreate(false);
      await refresh();
      setSelectedQuestId(created.id);
      setCreateReview(false);
      setFeedback("Quest created.");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Unable to create quest";
      try {
        const parsed = JSON.parse(message.replace(/^Invalid quest: /, "")) as Record<string, string>;
        setCreateFieldErrors(parsed);
      } catch {
        setCreateError(message);
      }
    } finally {
      setCreating(false);
    }
  };

  const loadMyActivities = async () => {
    setMyActivitiesLoading(true);
    setMyActivitiesError(undefined);
    try {
      setMyActivities(await repository.getMyActivities(CURRENT_USER_ID));
    } catch (reason) {
      setMyActivitiesError(reason instanceof Error ? reason.message : "Unable to load your activities");
    } finally {
      setMyActivitiesLoading(false);
    }
  };

  const manageQuest = async (id: string, operation: "complete" | "cancel" | "leave") => {
    if (busyActionKey) return;
    setBusyActionKey(`${operation}:${id}`);
    try {
      if (operation === "complete") await repository.completeQuest(id, CURRENT_USER_ID);
      if (operation === "cancel") await repository.cancelQuest(id, CURRENT_USER_ID);
      if (operation === "leave") await repository.leaveQuest(id, CURRENT_USER_ID);
      await refresh();
      setFeedback(operation === "complete" ? "Activity marked complete." : operation === "cancel" ? "Activity cancelled." : "You left the activity.");
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "Unable to update activity");
    } finally {
      setBusyActionKey(undefined);
    }
  };

  const manageRequest = async (request: QuestParticipant, approve: boolean) => {
    if (busyActionKey) return;
    const quest = quests.find((item) => item.id === request.questId);
    if (!quest) return;
    setBusyActionKey(`${approve ? "approve" : "reject"}:${request.id}`);
    try {
      if (approve) await repository.approveRequest(quest.id, request.id, CURRENT_USER_ID);
      else await repository.rejectRequest(quest.id, request.id, CURRENT_USER_ID);
      await refresh();
      setFeedback(approve ? "Request approved." : "Request rejected.");
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "Unable to update request");
    } finally {
      setBusyActionKey(undefined);
    }
  };

  const openCoordination = async (quest: SideQuest) => {
    try {
      setMessages(await repository.getMessages(quest.id, CURRENT_USER_ID));
      setSafetyFeedback(undefined);
      setCoordinationQuestId(quest.id);
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "Unable to open coordination");
    }
  };

  const sendCoordinationMessage = async () => {
    if (!coordinationQuestId) return;
    try {
      const message = await repository.sendMessage(coordinationQuestId, CURRENT_USER_ID, messageDraft);
      setMessages((current) => [...current, message]);
      setMessageDraft("");
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "Unable to send message");
    }
  };

  const openSettings = async () => {
    const [nextProfile, nextSettings, nextBlocked, nextReports] = await Promise.all([
      repository.getProfile(CURRENT_USER_ID),
      repository.getAccountSettings(CURRENT_USER_ID),
      repository.getBlockedUsers(CURRENT_USER_ID),
      repository.getReports(CURRENT_USER_ID),
    ]);
    setProfile(nextProfile);
    setSettings(nextSettings);
    setThemeMode(nextSettings.theme);
    setBlockedUsers(nextBlocked);
    setReports(nextReports);
    setShowSettings(true);
  };

  if (loading) {
    return <main className="mx-auto max-w-7xl px-6 py-16"><LoadingState label="Loading nearby quests" /></main>;
  }

  if (error) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-16">
        <EmptyState title="We couldn't load quests" description={error} />
        <div className="mt-4 text-center"><Button onClick={() => void refresh()}>Try again</Button></div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f5ef]">
      <header className="border-b border-[#29463a] bg-[#172b25] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:flex-nowrap lg:px-10">
          <a href="#discover" className="text-2xl font-bold tracking-tight" aria-label="SideQuest home">
            side<span className="text-[#c8f169]">quest</span>
          </a>
          <nav className="hidden items-center gap-8 text-sm text-[#d9e3d8] lg:flex">
            <a href="#discover" className="text-white">Discover</a>
            <a href="#how-it-works" className="hover:text-white">How it works</a>
          </nav>
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <Button variant="ghost" style={{ color: "#FFFFFF" }} aria-label="Open profile and settings" onClick={() => void openSettings()}>Profile</Button>
            <Button variant="ghost" style={{ color: "#FFFFFF" }} onClick={() => { setShowMyQuests(true); void loadMyActivities(); }}>My activities</Button>
            <Button variant="secondary" onClick={() => { setCreateReview(false); setShowCreate(true); }}>Create quest</Button>
          </div>
        </div>
      </header>
      <main id="discover" className="mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-16">
        <section className="motion-enter max-w-3xl">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-[#68756d]">Your next side quest</p>
          <h1 className="font-[var(--font-manrope)] text-4xl font-semibold tracking-tight text-[#172b25] sm:text-6xl">
            Make plans worth <span className="block text-[#68756d]">leaving home for.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#68756d]">
            Find people nearby who are up for the same things. No endless scrolling—just good plans, shared.
          </p>
        </section>
        <section className="motion-enter motion-enter-delay-1 mt-10 flex flex-col gap-4 rounded-[28px] bg-[#e8ebdd] p-4 shadow-[0_12px_30px_rgb(23_43_37/6%)] sm:flex-row sm:items-center">
          <label className="flex flex-1 items-center rounded-2xl bg-white px-4 py-3">
            <span className="sr-only">Search quests</span>
            <Input
              aria-label="Search quests"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search activities or places"
              style={{ border: 0, minHeight: 36, padding: 0 }}
            />
          </label>
          <Button
            variant="primary"
            onClick={() => {
              setSearch("");
              setSelectedCategory(undefined);
              setMaxCost("");
              setFeedback("Showing all open quests near you.");
            }}
          >
            I&apos;m free
          </Button>
        </section>
        <section className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[#68756d]">
          <label className="flex items-center gap-2">
            Budget
            <select
              aria-label="Filter by maximum cost"
              value={maxCost}
              onChange={(event) => setMaxCost(event.target.value)}
              className="rounded-lg border border-[#dce1d6] bg-white px-3 py-2 text-[#172b25]"
            >
              <option value="">Any budget</option>
              <option value="0">Free</option>
              <option value="500">Under ₹500</option>
              <option value="1000">Under ₹1,000</option>
            </select>
          </label>
          {(search || selectedCategory || maxCost) && (
            <button
              type="button"
              className="font-semibold text-[#172b25] underline"
              onClick={() => {
                setSearch("");
                setSelectedCategory(undefined);
                setMaxCost("");
              }}
            >
              Clear filters
            </button>
          )}
        </section>
        <section className="motion-enter motion-enter-delay-2 mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold text-[#172b25]">Explore nearby</h2>
            {feedback && <p className="text-sm font-semibold text-[#397b53]">{feedback}</p>}
          </div>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory(undefined)}
              aria-pressed={!selectedCategory}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${!selectedCategory ? "bg-[#172b25] text-white" : "bg-white text-[#68756d]"}`}
            >
              All quests
            </button>
            {QUEST_CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                aria-pressed={selectedCategory === category.id}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${selectedCategory === category.id ? "bg-[#172b25] text-white" : "bg-white text-[#68756d]"}`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </section>
        {featuredQuests.length > 0 && (
          <section className="mt-8">
            <div className="mb-4 flex items-center gap-3"><h2 className="text-2xl font-semibold text-[#172b25]">Featured quests</h2><Badge variant="category">Worth the trip</Badge></div>
            <div className="grid gap-6 lg:grid-cols-3">
              {featuredQuests.map((quest) => (
                <div key={quest.id} onClick={() => setSelectedQuestId(quest.id)} role="button" tabIndex={0} onKeyDown={(event) => event.key === "Enter" && setSelectedQuestId(quest.id)}>
                  <QuestCard
                    quest={toCardData(quest)}
                    hostName={profileName(quest.hostId)}
                    imageUrl={imageForCategory(quest.category)}
                    action={() => void runMembershipAction(quest)}
                    actionLabel={actionForQuest(quest, participants.find((item) => item.questId === quest.id && item.userId === CURRENT_USER_ID)).label}
                    actionDisabled={actionForQuest(quest, participants.find((item) => item.questId === quest.id && item.userId === CURRENT_USER_ID)).disabled}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
        <section className="mt-8">
          <h2 className="mb-4 text-2xl font-semibold text-[#172b25]">Nearby quests</h2>
          {nearbyQuests.length === 0 ? (
            <EmptyState title="No quests match those filters" description="Try another category or search term." />
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              {nearbyQuests.map((quest) => {
                const action = actionForQuest(quest, participants.find((item) => item.questId === quest.id && item.userId === CURRENT_USER_ID));
                return (
                  <div key={quest.id} onClick={() => setSelectedQuestId(quest.id)} role="button" tabIndex={0} onKeyDown={(event) => event.key === "Enter" && setSelectedQuestId(quest.id)}>
                    <QuestCard quest={toCardData(quest)} hostName={profileName(quest.hostId)}
                    imageUrl={imageForCategory(quest.category)} action={() => void runMembershipAction(quest)} actionLabel={action.label} actionDisabled={action.disabled} />
                  </div>
                );
              })}
            </div>
          )}
        </section>
        {nextCursor && (
          <div className="mt-8 text-center">
            <Button
              variant="outline"
              loading={loadingMore}
              onClick={() => void loadDiscoverPage(nextCursor)}
            >
              Load more
            </Button>
          </div>
        )}
      </main>
      {selectedQuest && (
        <div className="fixed inset-0 z-10 flex items-end justify-center bg-[#172b25]/40 p-4 sm:items-center" role="presentation" onClick={() => setSelectedQuestId(undefined)}>
          <div role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 560, width: "100%" }}>
          <Card className="motion-enter" style={{ maxHeight: "90vh", overflowY: "auto", width: "100%" }}>
            <div className="flex items-start justify-between gap-4">
              <div><Badge variant="category">{QUEST_CATEGORIES.find((item) => item.id === selectedQuest.category)?.label}</Badge><h2 className="mt-3 text-2xl font-semibold text-[#172b25]">{selectedQuest.title}</h2></div>
              <button aria-label="Close quest details" className="text-2xl text-[#68756d]" onClick={() => setSelectedQuestId(undefined)}>×</button>
            </div>
            <p className="mt-4 leading-7 text-[#68756d]">{selectedQuest.description}</p>
            <div className="mt-4 grid gap-2 text-sm text-[#68756d]">
              <span>{selectedQuest.date} · {selectedQuest.startTime}–{selectedQuest.endTime}</span>
              <span>{selectedQuest.locationLabel} · {spotsRemaining(selectedQuest)} spots remaining</span>
              <span>Hosted by {profileName(selectedQuest.hostId)} · Minimum age {selectedQuest.minimumAge}+</span>
              <span>Status: {selectedQuest.status} · {selectedQuest.joinMode === "approval" ? "Request to join" : "Instant join"}</span>
              <span>Visibility: {selectedQuest.visibility}</span>
            </div>
            <div className="mt-6 border-t border-[#dce1d6] pt-4">
              <h3 className="font-semibold text-[#172b25]">Participants ({selectedParticipants.length}/{selectedQuest.capacity})</h3>
              <p className="mt-2 text-sm text-[#68756d]">{selectedParticipants.map((participant) => profileName(participant.userId)).join(", ")}</p>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSelectedQuestId(undefined)}>Close</Button>
              {(() => {
                const action = actionForQuest(selectedQuest, participants.find((item) => item.questId === selectedQuest.id && item.userId === CURRENT_USER_ID));
                return <Button onClick={() => void runMembershipAction(selectedQuest)} disabled={action.disabled}>{action.label}</Button>;
              })()}
              {selectedQuest.participantIds.includes(CURRENT_USER_ID) && <Button variant="outline" onClick={() => void openCoordination(selectedQuest)}>Open coordination</Button>}
            </div>
          </Card>
          </div>
        </div>
      )}
      {coordinationQuestId && (() => {
        const quest = quests.find((item) => item.id === coordinationQuestId);
        if (!quest) return null;
        return (
          <div className="fixed inset-0 z-30 flex items-end justify-center bg-[#172b25]/40 p-4 sm:items-center">
            <Card style={{ maxHeight: "90vh", maxWidth: 680, overflowY: "auto", width: "100%" }}>
              <div className="flex items-start justify-between"><div><Badge variant="category">Coordination</Badge><h2 className="mt-2 text-2xl font-semibold text-[#172b25]">{quest.title}</h2></div><button aria-label="Close coordination" className="text-2xl text-[#68756d]" onClick={() => setCoordinationQuestId(undefined)}>×</button></div>
              <div className="mt-4 grid gap-1 text-sm text-[#68756d]"><span>{quest.date} · {quest.startTime}–{quest.endTime}</span><span>{quest.locationLabel}</span><span>{quest.participantIds.length}/{quest.capacity} participants</span></div>
              <h3 className="mt-5 font-semibold text-[#172b25]">Participants</h3>
              <div className="mt-2 grid gap-2">{quest.participantIds.map((userId) => { const participant = participants.find((item) => item.questId === quest.id && item.userId === userId); return <div key={userId} className="flex items-center justify-between rounded-lg bg-[#f6f5ef] p-2 text-sm"><span>{profileName(userId)}{userId === quest.hostId ? " · Host" : ""} · {participant?.status ?? "accepted"}</span>{userId !== CURRENT_USER_ID && <div className="flex gap-2">{quest.hostId === CURRENT_USER_ID && participant && <Button size="small" variant="outline" onClick={() => void repository.updateParticipantStatus(quest.id, participant.id, "left", CURRENT_USER_ID).then(refresh)}>Mark left</Button>}<Button size="small" variant="outline" onClick={() => void repository.reportUser({ reportedUserId: userId, questId: quest.id, reason: "Concern raised from coordination" }, CURRENT_USER_ID).then(() => setSafetyFeedback("Report submitted."))}>Report</Button><Button size="small" variant="danger" onClick={() => void repository.blockUser(CURRENT_USER_ID, userId).then(() => setSafetyFeedback("Participant blocked."))}>Block</Button></div>}</div>; })}</div>
              <h3 className="mt-5 font-semibold text-[#172b25]">Group chat</h3>
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-[#f6f5ef] p-3">{messages.length === 0 ? <p className="text-sm text-[#68756d]">No messages yet. Start coordinating the plan.</p> : messages.map((message) => <p key={message.id} className="mb-2 text-sm text-[#172b25]"><strong>{profileName(message.senderId)}:</strong> {message.body}</p>)}</div>
              <div className="mt-3 flex gap-2"><Input aria-label="Coordination message" placeholder="Share a meeting point or update" value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} /><Button onClick={() => void sendCoordinationMessage()}>Send</Button></div>
              {safetyFeedback && <p className="mt-3 text-sm text-[#68756d]">{safetyFeedback}</p>}
            </Card>
          </div>
        );
      })()}
      {showMyQuests && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-[#172b25]/40 p-4 sm:items-center">
          <Card style={{ maxHeight: "90vh", maxWidth: 640, overflowY: "auto", width: "100%" }}>
            <div className="flex items-center justify-between">
              <div><h2 className="text-2xl font-semibold text-[#172b25]">My activities</h2><p className="text-sm text-[#68756d]">Manage plans you host, joined, or requested.</p></div>
              <button aria-label="Close my quests" className="text-2xl text-[#68756d]" onClick={() => setShowMyQuests(false)}>×</button>
            </div>
            {myActivitiesLoading && <div className="mt-5"><LoadingState label="Loading your activities" /></div>}
            {myActivitiesError && <div className="mt-5"><EmptyState title="We couldn't load your activities" description={myActivitiesError} /><div className="mt-3 text-center"><Button onClick={() => void loadMyActivities()}>Try again</Button></div></div>}
            {!myActivitiesLoading && !myActivitiesError && myActivities && <div className="mt-5 grid gap-6">
              {([
                ["Hosting", myActivities.hosting],
                ["Joined", myActivities.joined],
                ["Past activities", myActivities.past],
              ] as const).map(([label, items]) => <section key={label}><h3 className="font-semibold text-[#172b25]">{label}</h3>{items.length === 0 ? <p className="mt-2 text-sm text-[#68756d]">No activities here yet.</p> : <div className="mt-2 grid gap-3">{items.map((quest) => (
                <div key={quest.id} className="flex items-center justify-between rounded-xl bg-[#f6f5ef] p-3">
                  <button type="button" className="text-left" onClick={() => { setSelectedQuestId(quest.id); setShowMyQuests(false); }}><p className="font-semibold text-[#172b25]">{quest.title}</p><p className="text-xs text-[#68756d]">{quest.date} · {quest.startTime}–{quest.endTime}</p><p className="text-xs text-[#68756d]">{quest.status} · {quest.participantIds.length}/{quest.capacity} · {quest.activityType}</p></button>
                  <div className="flex gap-2">
                    {quest.hostId === CURRENT_USER_ID && (quest.status === "open" || quest.status === "full") && <><Button size="small" loading={busyActionKey === `complete:${quest.id}`} onClick={() => void manageQuest(quest.id, "complete")}>Complete</Button><Button size="small" variant="danger" loading={busyActionKey === `cancel:${quest.id}`} onClick={() => void manageQuest(quest.id, "cancel")}>Cancel</Button></>}
                    {quest.hostId !== CURRENT_USER_ID && (quest.status === "open" || quest.status === "full") && <Button size="small" variant="outline" loading={busyActionKey === `leave:${quest.id}`} onClick={() => void manageQuest(quest.id, "leave")}>Leave</Button>}
                    {quest.status === "completed" && <Button size="small" variant="outline" onClick={() => void repository.getActivityRecap(quest.id).then((value) => setRecap(value ? `Completed ${value.completedAt} with ${value.participantCount} participants.` : "No recap available yet."))}>Recap</Button>}
                  </div>
                </div>
              ))}</div>}</section>)}
              <section><h3 className="font-semibold text-[#172b25]">Pending requests</h3>{myActivities.pending.length === 0 ? <p className="mt-2 text-sm text-[#68756d]">No pending requests.</p> : <div className="mt-2 grid gap-2">{myActivities.pending.map(({ quest, participant }) => <div key={participant.id} className="rounded-xl bg-[#f6f5ef] p-3"><button type="button" className="text-left font-semibold text-[#172b25]" onClick={() => { setSelectedQuestId(quest.id); setShowMyQuests(false); }}>{quest.title}</button><p className="text-xs text-[#68756d]">{quest.date} · {quest.startTime}–{quest.endTime} · Awaiting host approval</p></div>)}</div>}</section>
            </div>}
            {pendingRequests.length > 0 && <div className="mt-5"><h3 className="font-semibold text-[#172b25]">Requests to manage</h3>{pendingRequests.map((request) => {
              const quest = quests.find((item) => item.id === request.questId);
              return quest ? <div key={request.id} className="mt-2 flex items-center justify-between rounded-xl bg-[#f6f5ef] p-3"><span className="text-sm text-[#172b25]">{profileName(request.userId)} wants to join {quest.title}</span><div className="flex gap-2"><Button size="small" loading={busyActionKey === `approve:${request.id}`} onClick={() => void manageRequest(request, true)}>Approve</Button><Button size="small" variant="danger" loading={busyActionKey === `reject:${request.id}`} onClick={() => void manageRequest(request, false)}>Reject</Button></div></div> : null;
            })}</div>}
            {recap && <p className="mt-4 rounded-xl bg-[#e8f0df] p-3 text-sm text-[#172b25]">{recap}</p>}
          </Card>
        </div>
      )}
      {showCreate && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-[#172b25]/40 p-4 sm:items-center">
          <Card style={{ maxHeight: "90vh", maxWidth: 560, overflowY: "auto", width: "100%" }}>
            <div className="flex items-center justify-between"><div><h2 className="text-2xl font-semibold text-[#172b25]">{createReview ? "Review your activity" : "Create an activity"}</h2><p className="text-sm text-[#68756d]">{createReview ? "Confirm the details before publishing." : "Tell people what, when, and how to join."}</p></div><Button variant="ghost" size="small" aria-label="Back from create activity" onClick={() => { setCreateReview(false); setShowCreate(false); }}>Back</Button></div>
            <div className="mt-5 grid gap-3">
              {createReview && <Card><p className="font-semibold text-[#172b25]">{createTitle}</p><p className="text-sm text-[#68756d]">{createDate} · {createStartTime}–{createEndTime} · {createLocation}</p><p className="text-sm text-[#68756d]">{createCapacity} participants · {createJoinMode === "instant" ? "Instant join" : "Request to join"} · {createVisibility}</p></Card>}
              <label className="grid gap-1 text-sm font-semibold text-[#172b25]">Title<Input aria-label="Activity title" invalid={Boolean(createFieldErrors.title)} placeholder="Activity title" value={createTitle} onChange={(event) => setCreateTitle(event.target.value)} />{createFieldErrors.title && <span className="font-normal text-[#c94f45]">{createFieldErrors.title}</span>}</label>
              <label className="grid gap-1 text-sm font-semibold text-[#172b25]">Description<textarea aria-label="Activity description" placeholder="What are you planning?" value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} className={`min-h-28 rounded-[10px] border p-3 text-[#172b25] ${createFieldErrors.description ? "border-[#c94f45]" : "border-[#dce1d6]"}`} />{createFieldErrors.description && <span className="font-normal text-[#c94f45]">{createFieldErrors.description}</span>}</label>
              <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold text-[#172b25]">Category<select aria-label="Activity category" value={createCategory} onChange={(event) => setCreateCategory(event.target.value as QuestCategory)} className="min-h-11 rounded-[10px] border border-[#dce1d6] bg-white px-3">{QUEST_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold text-[#172b25]">Activity type<select aria-label="Activity type" value={createActivityType} onChange={(event) => setCreateActivityType(event.target.value as QuestActivityType)} className="min-h-11 rounded-[10px] border border-[#dce1d6] bg-white px-3">{QUEST_ACTIVITY_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label></div>
              <p className="text-xs text-[#68756d]">{QUEST_ACTIVITY_TYPES.find((item) => item.id === createActivityType)?.description}</p>
              {createActivityType === "team-sport" && <label className="grid gap-1 text-sm font-semibold text-[#172b25]">Players per team<Input aria-label="Players per team" type="number" min="1" value={createTeamSize} onChange={(event) => setCreateTeamSize(event.target.value)} invalid={Boolean(createFieldErrors.teamSize)} />{createFieldErrors.teamSize && <span className="font-normal text-[#c94f45]">{createFieldErrors.teamSize}</span>}</label>}
              <div className="grid gap-3 sm:grid-cols-3"><label className="grid gap-1 text-sm font-semibold text-[#172b25]">Date<Input aria-label="Activity date" type="date" value={createDate} onChange={(event) => setCreateDate(event.target.value)} invalid={Boolean(createFieldErrors.date)} /></label><label className="grid gap-1 text-sm font-semibold text-[#172b25]">Starts<Input aria-label="Start time" type="time" value={createStartTime} onChange={(event) => setCreateStartTime(event.target.value)} invalid={Boolean(createFieldErrors.startTime)} /></label><label className="grid gap-1 text-sm font-semibold text-[#172b25]">Ends<Input aria-label="End time" type="time" value={createEndTime} onChange={(event) => setCreateEndTime(event.target.value)} invalid={Boolean(createFieldErrors.endTime)} /></label></div>
              {(createFieldErrors.date || createFieldErrors.startTime || createFieldErrors.endTime) && <p className="text-sm text-[#c94f45]">{createFieldErrors.date ?? createFieldErrors.startTime ?? createFieldErrors.endTime}</p>}
              <label className="grid gap-1 text-sm font-semibold text-[#172b25]">Location<Input aria-label="Activity location" value={createLocation} onChange={(event) => setCreateLocation(event.target.value)} invalid={Boolean(createFieldErrors.locationLabel)} placeholder="Venue or meeting point" />{createFieldErrors.locationLabel && <span className="font-normal text-[#c94f45]">{createFieldErrors.locationLabel}</span>}</label>
              <div className="grid gap-3 sm:grid-cols-3"><label className="grid gap-1 text-sm font-semibold text-[#172b25]">Capacity<Input aria-label="Activity capacity" type="number" min="2" max="100" value={createCapacity} onChange={(event) => setCreateCapacity(event.target.value)} invalid={Boolean(createFieldErrors.capacity)} />{createFieldErrors.capacity && <span className="font-normal text-[#c94f45]">{createFieldErrors.capacity}</span>}</label><label className="grid gap-1 text-sm font-semibold text-[#172b25]">Join mode<select aria-label="Join mode" value={createJoinMode} onChange={(event) => setCreateJoinMode(event.target.value as JoinMode)} className="min-h-11 rounded-[10px] border border-[#dce1d6] bg-white px-3"><option value="instant">Instant join</option><option value="approval">Request to join</option></select></label><label className="grid gap-1 text-sm font-semibold text-[#172b25]">Visibility<select aria-label="Visibility" value={createVisibility} onChange={(event) => setCreateVisibility(event.target.value as Visibility)} className="min-h-11 rounded-[10px] border border-[#dce1d6] bg-white px-3"><option value="public">Public</option><option value="unlisted">Unlisted</option><option value="invite-only">Invite-only</option></select></label></div>
              <label className="grid gap-1 text-sm font-semibold text-[#172b25]">Optional cost (INR)<Input aria-label="Optional cost" type="number" min="0" value={createCost} onChange={(event) => setCreateCost(event.target.value)} invalid={Boolean(createFieldErrors.estimatedCost)} /></label>
              <p className="text-xs text-[#68756d]">Visibility controls who can find this activity. Join mode controls whether people enter immediately or wait for your approval.</p>
              {createError && <p role="alert" className="text-sm text-[#c94f45]">{createError}</p>}
              <Button loading={creating} onClick={() => void createQuest()}>{createReview ? "Publish activity" : "Review activity"}</Button>
            </div>
          </Card>
        </div>
      )}
      {showSettings && profile && settings && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-[#172b25]/40 p-4 sm:items-center">
          <Card style={{ maxHeight: "90vh", maxWidth: 680, overflowY: "auto", width: "100%" }}>
            <div className="flex items-center justify-between"><div><Badge variant="category">Account</Badge><h2 className="mt-2 text-2xl font-semibold text-[#172b25]">{profile.displayName}</h2></div><button aria-label="Close settings" className="text-2xl text-[#68756d]" onClick={() => setShowSettings(false)}>×</button></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Input aria-label="Display name" value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} />
              <Input aria-label="City" value={profile.city} onChange={(event) => setProfile({ ...profile, city: event.target.value })} />
              <Input aria-label="Bio" value={profile.bio} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} />
              <Button onClick={() => void repository.updateProfile(CURRENT_USER_ID, profile).then(setProfile)}>Save profile</Button>
            </div>
            <h3 className="mt-6 font-semibold text-[#172b25]">Theme</h3>
            <div className="mt-2 flex gap-2">{(["light", "dark", "system"] as const).map((theme) => <Button key={theme} variant={themeMode === theme ? "secondary" : "outline"} onClick={() => { setThemeMode(theme); void repository.updateAccountSettings(CURRENT_USER_ID, { theme }).then(setSettings); }}>{theme}</Button>)}</div>
            <h3 className="mt-6 font-semibold text-[#172b25]">Notifications</h3>
            <div className="mt-2 grid gap-2 text-sm text-[#68756d]">{(["questUpdates", "chatMessages", "reminders"] as const).map((key) => <label key={key} className="flex gap-2"><input type="checkbox" checked={settings.notifications[key]} onChange={(event) => void repository.updateAccountSettings(CURRENT_USER_ID, { notifications: { ...settings.notifications, [key]: event.target.checked } }).then(setSettings)} />{key}</label>)}</div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2"><div><h3 className="font-semibold text-[#172b25]">Quest history</h3><p className="text-sm text-[#68756d]">Hosted {quests.filter((q) => q.hostId === CURRENT_USER_ID).length} · Joined {quests.filter((q) => q.hostId !== CURRENT_USER_ID && q.participantIds.includes(CURRENT_USER_ID)).length} · Completed {quests.filter((q) => q.status === "completed" && (q.hostId === CURRENT_USER_ID || q.participantIds.includes(CURRENT_USER_ID))).length}</p></div><div><h3 className="font-semibold text-[#172b25]">Safety</h3><p className="text-sm text-[#68756d]">Blocked users: {blockedUsers.length} · Reports: {reports.length}</p></div></div>
            <Button className="mt-6" variant="outline" onClick={() => setFeedback("Logout is a placeholder in this mock prototype.")}>Log out</Button>
          </Card>
        </div>
      )}
    </div>
  );
}
