"use client";

import { useMemo, useState } from "react";
import {
  CURRENT_USER_ID,
  MockQuestRepository,
  QUEST_CATEGORIES,
  mockParticipants,
  mockProfiles,
  mockQuests,
  spotsRemaining,
  type QuestCategory,
  type QuestParticipant,
  type QuestCreationInput,
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
import { QuestCard, type QuestCardData } from "@sidequest/ui/quest-card";

const repository = new MockQuestRepository();

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
  if (quest.status === "full") return { label: "Full", disabled: true };
  if (quest.status !== "open") return { label: "Unavailable", disabled: true };
  if (quest.participantIds.includes(CURRENT_USER_ID)) return { label: "Joined", disabled: true };
  if (pending?.status === "pending") return { label: "Request pending", disabled: true };
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [feedback, setFeedback] = useState<string>();
  const [showMyQuests, setShowMyQuests] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createError, setCreateError] = useState<string>();
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

  const refresh = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [nextQuests, nextProfiles, nextPending] = await Promise.all([
        repository.getQuests(),
        repository.getProfiles(),
        repository.getPendingRequestsForHost(CURRENT_USER_ID),
      ]);
      setQuests(nextQuests);
      setProfiles(nextProfiles);
      setPendingRequests(nextPending);
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
    setFeedback(undefined);
    try {
      const action = actionForQuest(
        quest,
        participants.find(
          (participant) =>
            participant.questId === quest.id && participant.userId === CURRENT_USER_ID,
        ),
      );
      if (action.disabled) return;
      const participant =
        quest.joinMode === "approval"
          ? await repository.requestToJoin(quest.id, CURRENT_USER_ID)
          : await repository.joinQuest(quest.id, CURRENT_USER_ID);
      setParticipants((current) => [...current, participant]);
      setFeedback(
        participant.status === "pending"
          ? "Your request was sent to the host."
          : "You joined the quest.",
      );
      await refresh();
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "Unable to update membership");
    }
  };

  const createQuest = async () => {
    setCreateError(undefined);
    try {
      const input: QuestCreationInput = {
        title: createTitle,
        description: createDescription,
        category: "social",
        hostId: CURRENT_USER_ID,
        date: "2026-11-21",
        startTime: "10:00",
        endTime: "12:00",
        locationLabel: "Bengaluru",
        capacity: 6,
        estimatedCost: { amount: 0, currency: "INR" },
        visibility: "public",
        joinMode: "instant",
        minimumAge: 16,
        featured: false,
      };

      await repository.createQuest(input);
      setCreateTitle("");
      setCreateDescription("");
      setShowCreate(false);
      await refresh();
      setFeedback("Quest created.");
    } catch (reason) {
      setCreateError(reason instanceof Error ? reason.message : "Unable to create quest");
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
      <header className="border-b border-[#e1e6dc] bg-[#172b25] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <a href="#" className="text-2xl font-bold tracking-tight">
            side<span className="text-[#c8f169]">quest</span>
          </a>
          <nav className="hidden items-center gap-8 text-sm text-[#d9e3d8] md:flex">
            <a href="#discover" className="text-white">Discover</a>
            <a href="#how-it-works" className="hover:text-white">How it works</a>
          </nav>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => void openSettings()}>Profile & settings</Button>
            <Button variant="ghost" onClick={() => setShowMyQuests(true)}>My quests</Button>
            <Button variant="secondary" onClick={() => setShowCreate(true)}>Create a quest</Button>
          </div>
        </div>
      </header>
      <main id="discover" className="mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-16">
        <section className="max-w-3xl">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-[#68756d]">Your next side quest</p>
          <h1 className="text-4xl font-semibold tracking-tight text-[#172b25] sm:text-6xl">
            Make plans worth <span className="block text-[#68756d]">leaving home for.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#68756d]">
            Find people nearby who are up for the same things. No endless scrolling—just good plans, shared.
          </p>
        </section>
        <section className="mt-10 flex flex-col gap-4 rounded-[28px] bg-[#e8ebdd] p-4 sm:flex-row sm:items-center">
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
          <Button variant="primary">I&apos;m free</Button>
        </section>
        <section className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold text-[#172b25]">Explore nearby</h2>
            {feedback && <p className="text-sm font-semibold text-[#397b53]">{feedback}</p>}
          </div>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory(undefined)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${!selectedCategory ? "bg-[#172b25] text-white" : "bg-white text-[#68756d]"}`}
            >
              All quests
            </button>
            {QUEST_CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
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
                    <QuestCard quest={toCardData(quest)} hostName={profileName(quest.hostId)} action={() => void runMembershipAction(quest)} actionLabel={action.label} actionDisabled={action.disabled} />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
      {selectedQuest && (
        <div className="fixed inset-0 z-10 flex items-end justify-center bg-[#172b25]/40 p-4 sm:items-center">
          <Card style={{ maxHeight: "90vh", maxWidth: 560, overflowY: "auto", width: "100%" }}>
            <div className="flex items-start justify-between gap-4">
              <div><Badge variant="category">{QUEST_CATEGORIES.find((item) => item.id === selectedQuest.category)?.label}</Badge><h2 className="mt-3 text-2xl font-semibold text-[#172b25]">{selectedQuest.title}</h2></div>
              <button aria-label="Close quest details" className="text-2xl text-[#68756d]" onClick={() => setSelectedQuestId(undefined)}>×</button>
            </div>
            <p className="mt-4 leading-7 text-[#68756d]">{selectedQuest.description}</p>
            <div className="mt-4 grid gap-2 text-sm text-[#68756d]">
              <span>{selectedQuest.date} · {selectedQuest.startTime}–{selectedQuest.endTime}</span>
              <span>{selectedQuest.locationLabel} · {spotsRemaining(selectedQuest)} spots remaining</span>
              <span>Hosted by {profileName(selectedQuest.hostId)} · Minimum age {selectedQuest.minimumAge}+</span>
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
              <h2 className="text-2xl font-semibold text-[#172b25]">My quests</h2>
              <button aria-label="Close my quests" className="text-2xl text-[#68756d]" onClick={() => setShowMyQuests(false)}>×</button>
            </div>
            <div className="mt-5 grid gap-3">
              {quests.filter((quest) => quest.hostId === CURRENT_USER_ID || quest.participantIds.includes(CURRENT_USER_ID)).map((quest) => (
                <div key={quest.id} className="flex items-center justify-between rounded-xl bg-[#f6f5ef] p-3">
                  <div><p className="font-semibold text-[#172b25]">{quest.title}</p><p className="text-xs text-[#68756d]">{quest.status} · {quest.participantIds.length}/{quest.capacity} participants</p></div>
                  <div className="flex gap-2">
                    {quest.hostId === CURRENT_USER_ID && quest.status === "open" && <Button size="small" onClick={() => void repository.completeQuest(quest.id, CURRENT_USER_ID).then(refresh)}>Complete</Button>}
                    {quest.hostId === CURRENT_USER_ID && quest.status === "open" && <Button size="small" variant="danger" onClick={() => void repository.cancelQuest(quest.id, CURRENT_USER_ID).then(refresh)}>Cancel</Button>}
                    {quest.hostId !== CURRENT_USER_ID && quest.participantIds.includes(CURRENT_USER_ID) && quest.status === "open" && <Button size="small" variant="outline" onClick={() => void repository.leaveQuest(quest.id, CURRENT_USER_ID).then(refresh)}>Leave</Button>}
                    {quest.status === "completed" && <Button size="small" variant="outline" onClick={() => void repository.getActivityRecap(quest.id).then((value) => setRecap(value ? `Completed ${value.completedAt} with ${value.participantCount} participants.` : "No recap available yet."))}>Recap</Button>}
                  </div>
                </div>
              ))}
            </div>
            {pendingRequests.length > 0 && <div className="mt-5"><h3 className="font-semibold text-[#172b25]">Join requests</h3>{pendingRequests.map((request) => {
              const quest = quests.find((item) => item.id === request.questId);
              return quest ? <div key={request.id} className="mt-2 flex items-center justify-between rounded-xl bg-[#f6f5ef] p-3"><span className="text-sm text-[#172b25]">{profileName(request.userId)} wants to join {quest.title}</span><div className="flex gap-2"><Button size="small" onClick={() => void repository.approveRequest(quest.id, request.userId, CURRENT_USER_ID).then(refresh)}>Approve</Button><Button size="small" variant="danger" onClick={() => void repository.rejectRequest(quest.id, request.userId, CURRENT_USER_ID).then(refresh)}>Reject</Button></div></div> : null;
            })}</div>}
            {recap && <p className="mt-4 rounded-xl bg-[#e8f0df] p-3 text-sm text-[#172b25]">{recap}</p>}
          </Card>
        </div>
      )}
      {showCreate && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-[#172b25]/40 p-4 sm:items-center">
          <Card style={{ maxHeight: "90vh", maxWidth: 560, overflowY: "auto", width: "100%" }}>
            <div className="flex items-center justify-between"><h2 className="text-2xl font-semibold text-[#172b25]">Create a quest</h2><button aria-label="Close create quest" className="text-2xl text-[#68756d]" onClick={() => setShowCreate(false)}>×</button></div>
            <div className="mt-5 grid gap-3">
              <Input aria-label="Quest title" placeholder="Quest title" value={createTitle} onChange={(event) => setCreateTitle(event.target.value)} />
              <textarea aria-label="Quest description" placeholder="What are you planning?" value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} className="min-h-28 rounded-[10px] border border-[#dce1d6] p-3 text-[#172b25]" />
              {createError && <p className="text-sm text-[#c94f45]">{createError}</p>}
              <Button onClick={() => void createQuest()}>Create quest</Button>
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
            <div className="mt-2 flex gap-2">{(["light", "dark", "system"] as const).map((theme) => <Button key={theme} variant={settings.theme === theme ? "secondary" : "outline"} onClick={() => void repository.updateAccountSettings(CURRENT_USER_ID, { theme }).then(setSettings)}>{theme}</Button>)}</div>
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
