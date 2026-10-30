import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  CURRENT_USER_ID,
  MockQuestRepository,
  QUEST_CATEGORIES,
  mockParticipants,
  mockProfiles,
  mockQuests,
  spotsRemaining,
  type QuestCategory,
  type QuestCreationInput,
  type ChatMessage,
  type QuestParticipant,
  type SideQuest,
  type UserProfile,
  type AccountSettings,
  type BlockedUser,
  type UserReport,
} from "@sidequest/shared";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  LoadingState,
} from "@sidequest/ui/native";
import {
  QuestCard,
  type QuestCardData,
} from "@sidequest/ui/quest-card-native";
import { colors, spacing, themes } from "@sidequest/ui";

const repository = new MockQuestRepository();

function toCardData(quest: SideQuest): QuestCardData {
  return {
    title: quest.title,
    description: quest.description,
    category:
      QUEST_CATEGORIES.find((category) => category.id === quest.category)?.label ??
      quest.category,
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

function getAction(quest: SideQuest, participant?: QuestParticipant) {
  if (quest.status === "full") return { label: "Full", disabled: true };
  if (quest.status !== "open") return { label: "Unavailable", disabled: true };
  if (quest.participantIds.includes(CURRENT_USER_ID)) {
    return { label: "Joined", disabled: true };
  }
  if (participant?.status === "pending") {
    return { label: "Request pending", disabled: true };
  }
  return quest.joinMode === "approval"
    ? { label: "Request to join", disabled: false }
    : { label: "Join quest", disabled: false };
}

export default function App() {
  const [quests, setQuests] = useState<SideQuest[]>(() =>
    mockQuests.map((quest) => structuredClone(quest)),
  );
  const [profiles] = useState<UserProfile[]>(() =>
    mockProfiles.map((profile) => structuredClone(profile)),
  );
  const [participants, setParticipants] = useState<QuestParticipant[]>(() =>
    mockParticipants.map((participant) => structuredClone(participant)),
  );
  const [pendingRequests, setPendingRequests] = useState<QuestParticipant[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<QuestCategory>();
  const [search, setSearch] = useState("");
  const [selectedQuestId, setSelectedQuestId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [feedback, setFeedback] = useState<string>();
  const [showMyQuests, setShowMyQuests] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
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

  const visibleQuests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return quests.filter((quest) => {
      const active = quest.status === "open" || quest.status === "full";
      const categoryMatch =
        !selectedCategory || quest.category === selectedCategory;
      const searchMatch =
        !query ||
        `${quest.title} ${quest.description} ${quest.locationLabel}`
          .toLowerCase()
          .includes(query);
      return active && categoryMatch && searchMatch;
    });
  }, [quests, search, selectedCategory]);

  const featuredQuests = visibleQuests.filter((quest) => quest.featured);
  const nearbyQuests = visibleQuests.filter((quest) => !quest.featured);
  const selectedQuest = quests.find((quest) => quest.id === selectedQuestId);
  const profileName = (userId: string) =>
    profiles.find((profile) => profile.id === userId)?.displayName ??
    "SideQuest member";

  const refresh = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const nextQuests = await repository.getQuests();
      setQuests(nextQuests);
      setPendingRequests(await repository.getPendingRequestsForHost(CURRENT_USER_ID));
      setFeedback("Quest list refreshed.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load quests");
    } finally {
      setLoading(false);
    }
  };

  const runMembershipAction = async (quest: SideQuest) => {
    setFeedback(undefined);
    setError(undefined);
    try {
      const currentParticipant = participants.find(
        (participant) =>
          participant.questId === quest.id &&
          participant.userId === CURRENT_USER_ID,
      );
      const action = getAction(quest, currentParticipant);
      if (action.disabled) return;
      const participant =
        quest.joinMode === "approval"
          ? await repository.requestToJoin(quest.id, CURRENT_USER_ID)
          : await repository.joinQuest(quest.id, CURRENT_USER_ID);
      setParticipants((current) => [...current, participant]);
      setQuests(await repository.getQuests());
      setFeedback(
        participant.status === "pending"
          ? "Request sent to the host."
          : "You joined the quest.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update membership");
    }
  };

  const createQuest = async () => {
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
      setQuests(await repository.getQuests());
      setCreateTitle("");
      setCreateDescription("");
      setShowCreate(false);
      setFeedback("Quest created.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create quest");
    }
  };

  const openCoordination = async (quest: SideQuest) => {
    try {
      setMessages(await repository.getMessages(quest.id, CURRENT_USER_ID));
      setSafetyFeedback(undefined);
      setCoordinationQuestId(quest.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to open coordination");
    }
  };

  const sendCoordinationMessage = async () => {
    if (!coordinationQuestId) return;
    try {
      const message = await repository.sendMessage(coordinationQuestId, CURRENT_USER_ID, messageDraft);
      setMessages((current) => [...current, message]);
      setMessageDraft("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to send message");
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

  const renderQuest = (quest: SideQuest) => {
    const participant = participants.find(
      (item) =>
        item.questId === quest.id && item.userId === CURRENT_USER_ID,
    );
    const action = getAction(quest, participant);
    return (
      <QuestCard
        key={quest.id}
        quest={toCardData(quest)}
        hostName={profileName(quest.hostId)}
        onPress={() => setSelectedQuestId(quest.id)}
        action={() => void runMembershipAction(quest)}
        actionLabel={action.label}
        actionDisabled={action.disabled}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>
              side<Text style={styles.logoAccent}>quest</Text>
            </Text>
            <Text style={styles.eyebrow}>YOUR NEXT SIDE QUEST</Text>
          </View>
          <View style={styles.headerActions}>
            <Button variant="ghost" size="small" onPress={() => void openSettings()}>
              Profile
            </Button>
            <Button variant="ghost" size="small" onPress={() => setShowMyQuests(true)}>
              My quests
            </Button>
            <Button variant="secondary" size="small" onPress={() => setShowCreate(true)}>
              Create
            </Button>
          </View>
        </View>
        <Text style={styles.title}>Make plans worth{"\n"}leaving home for.</Text>
        <Text style={styles.subtitle}>
          Find people nearby who are up for the same things. No endless
          scrolling—just good plans, shared.
        </Text>
        <View style={styles.searchRow}>
          <Input
            accessibilityLabel="Search quests"
            onChangeText={setSearch}
            placeholder="Search activities or places"
            value={search}
            style={styles.searchInput}
          />
          <Button>I'm free</Button>
        </View>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Explore nearby</Text>
          <Pressable onPress={() => void refresh()}>
            <Text style={styles.refresh}>Refresh</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.chips}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <Pressable
            onPress={() => setSelectedCategory(undefined)}
            style={[styles.chip, !selectedCategory && styles.activeChip]}
          >
            <Text style={[styles.chipText, !selectedCategory && styles.activeChipText]}>
              All quests
            </Text>
          </Pressable>
          {QUEST_CATEGORIES.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => setSelectedCategory(category.id)}
              style={[
                styles.chip,
                selectedCategory === category.id && styles.activeChip,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedCategory === category.id && styles.activeChipText,
                ]}
              >
                {category.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        {feedback && <Text style={styles.feedback}>{feedback}</Text>}
        {error && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Button onPress={() => void refresh()}>Try again</Button>
          </Card>
        )}
        {loading ? (
          <LoadingState label="Refreshing quests" />
        ) : visibleQuests.length === 0 ? (
          <EmptyState
            title="No quests match those filters"
            description="Try another category or search term."
          />
        ) : (
          <>
            {featuredQuests.length > 0 && (
              <>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>Featured quests</Text>
                  <Badge variant="category">Worth the trip</Badge>
                </View>
                {featuredQuests.map(renderQuest)}
              </>
            )}
            {nearbyQuests.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Nearby quests</Text>
                {nearbyQuests.map(renderQuest)}
              </>
            )}
          </>
        )}
      </ScrollView>
      <StatusBar style="dark" />
      <Modal
        animationType="slide"
        onRequestClose={() => setSelectedQuestId(undefined)}
        visible={Boolean(selectedQuest)}
        transparent
      >
        {selectedQuest && (
          <View style={styles.modalBackdrop}>
            <Card style={styles.detailsCard}>
              <View style={styles.modalHeader}>
                <Badge variant="category">
                  {QUEST_CATEGORIES.find(
                    (category) => category.id === selectedQuest.category,
                  )?.label}
                </Badge>
                <Pressable
                  accessibilityLabel="Close quest details"
                  onPress={() => setSelectedQuestId(undefined)}
                >
                  <Text style={styles.close}>×</Text>
                </Pressable>
              </View>
              <Text style={styles.detailsTitle}>{selectedQuest.title}</Text>
              <Text style={styles.detailsDescription}>
                {selectedQuest.description}
              </Text>
              <Text style={styles.detailsMeta}>
                {selectedQuest.date} · {selectedQuest.startTime}–
                {selectedQuest.endTime}
              </Text>
              <Text style={styles.detailsMeta}>
                {selectedQuest.locationLabel} · {spotsRemaining(selectedQuest)} spots
                remaining
              </Text>
              <Text style={styles.detailsMeta}>
                Hosted by {profileName(selectedQuest.hostId)} · Minimum age{" "}
                {selectedQuest.minimumAge}+
              </Text>
              <View style={styles.participantBlock}>
                <Text style={styles.participantTitle}>
                  Participants ({selectedQuest.participantIds.length}/
                  {selectedQuest.capacity})
                </Text>
                <Text style={styles.detailsMeta}>
                  {selectedQuest.participantIds.map(profileName).join(", ")}
                </Text>
              </View>
              <Button
                disabled={
                  getAction(
                    selectedQuest,
                    participants.find(
                      (participant) =>
                        participant.questId === selectedQuest.id &&
                        participant.userId === CURRENT_USER_ID,
                    ),
                  ).disabled
                }
                onPress={() => void runMembershipAction(selectedQuest)}
              >
                {
                  getAction(
                    selectedQuest,
                    participants.find(
                      (participant) =>
                        participant.questId === selectedQuest.id &&
                        participant.userId === CURRENT_USER_ID,
                    ),
                  ).label
                }
              </Button>
              {selectedQuest.participantIds.includes(CURRENT_USER_ID) && <Button variant="outline" onPress={() => void openCoordination(selectedQuest)}>Open coordination</Button>}
            </Card>
          </View>
        )}
      </Modal>
      <Modal animationType="slide" onRequestClose={() => setShowSettings(false)} visible={showSettings} transparent>
        <View style={styles.modalBackdrop}>
          <Card style={styles.detailsCard}>
            {profile && settings && <>
              <View style={styles.modalHeader}><View><Badge variant="category">Account</Badge><Text style={styles.detailsTitle}>{profile.displayName}</Text></View><Pressable onPress={() => setShowSettings(false)}><Text style={styles.close}>×</Text></Pressable></View>
              <Input accessibilityLabel="Display name" onChangeText={(displayName) => setProfile({ ...profile, displayName })} value={profile.displayName} />
              <Input accessibilityLabel="City" onChangeText={(city) => setProfile({ ...profile, city })} value={profile.city} />
              <Input accessibilityLabel="Bio" onChangeText={(bio) => setProfile({ ...profile, bio })} value={profile.bio} />
              <Button onPress={() => void repository.updateProfile(CURRENT_USER_ID, profile).then(setProfile)}>Save profile</Button>
              <Text style={styles.participantTitle}>Theme</Text>
              <View style={styles.myQuestActions}>{(["light", "dark", "system"] as const).map((theme) => <Button key={theme} size="small" variant={settings.theme === theme ? "secondary" : "outline"} onPress={() => void repository.updateAccountSettings(CURRENT_USER_ID, { theme }).then(setSettings)}>{theme}</Button>)}</View>
              <Text style={styles.participantTitle}>Notifications</Text>
              {(["questUpdates", "chatMessages", "reminders"] as const).map((key) => <Pressable key={key} style={styles.preferenceRow} onPress={() => void repository.updateAccountSettings(CURRENT_USER_ID, { notifications: { ...settings.notifications, [key]: !settings.notifications[key] } }).then(setSettings)}><Text style={styles.detailsMeta}>{settings.notifications[key] ? "✓" : "○"} {key}</Text></Pressable>)}
              <Text style={styles.detailsMeta}>Hosted {quests.filter((q) => q.hostId === CURRENT_USER_ID).length} · Joined {quests.filter((q) => q.hostId !== CURRENT_USER_ID && q.participantIds.includes(CURRENT_USER_ID)).length} · Completed {quests.filter((q) => q.status === "completed" && (q.hostId === CURRENT_USER_ID || q.participantIds.includes(CURRENT_USER_ID))).length}</Text>
              <Text style={styles.detailsMeta}>Blocked users: {blockedUsers.length} · Reports: {reports.length}</Text>
              <Button variant="outline" onPress={() => setFeedback("Logout is a placeholder in this mock prototype.")}>Log out</Button>
            </>}
          </Card>
        </View>
      </Modal>
      <Modal animationType="slide" onRequestClose={() => setCoordinationQuestId(undefined)} visible={Boolean(coordinationQuestId)} transparent>
        <View style={styles.modalBackdrop}>
          <Card style={styles.detailsCard}>
            {coordinationQuestId && (() => {
              const quest = quests.find((item) => item.id === coordinationQuestId);
              if (!quest) return null;
              return (
                <>
                  <View style={styles.modalHeader}><View><Badge variant="category">Coordination</Badge><Text style={styles.detailsTitle}>{quest.title}</Text></View><Pressable onPress={() => setCoordinationQuestId(undefined)}><Text style={styles.close}>×</Text></Pressable></View>
                  <Text style={styles.detailsMeta}>{quest.date} · {quest.startTime}–{quest.endTime}</Text>
                  <Text style={styles.detailsMeta}>{quest.locationLabel} · {quest.participantIds.length}/{quest.capacity} participants</Text>
                  <Text style={styles.participantTitle}>Participants</Text>
                  {quest.participantIds.map((userId) => { const participant = participants.find((item) => item.questId === quest.id && item.userId === userId); return <View key={userId} style={styles.coordinationParticipant}><Text style={styles.myQuestCopy}>{profileName(userId)}{userId === quest.hostId ? " · Host" : ""} · {participant?.status ?? "accepted"}</Text>{userId !== CURRENT_USER_ID && <View style={styles.myQuestActions}>{quest.hostId === CURRENT_USER_ID && participant && <Button size="small" variant="outline" onPress={() => void repository.updateParticipantStatus(quest.id, participant.id, "left", CURRENT_USER_ID).then(refresh)}>Mark left</Button>}<Button size="small" variant="outline" onPress={() => void repository.reportUser({ reportedUserId: userId, questId: quest.id, reason: "Concern raised from coordination" }, CURRENT_USER_ID).then(() => setSafetyFeedback("Report submitted."))}>Report</Button><Button size="small" variant="danger" onPress={() => void repository.blockUser(CURRENT_USER_ID, userId).then(() => setSafetyFeedback("Participant blocked."))}>Block</Button></View>}</View>; })}
                  <Text style={styles.participantTitle}>Group chat</Text>
                  <View style={styles.chatBox}>{messages.length === 0 ? <Text style={styles.detailsMeta}>No messages yet. Start coordinating the plan.</Text> : messages.map((message) => <Text key={message.id} style={styles.chatMessage}><Text style={styles.participantTitle}>{profileName(message.senderId)}:</Text> {message.body}</Text>)}</View>
                  <View style={styles.messageComposer}><Input accessibilityLabel="Coordination message" onChangeText={setMessageDraft} placeholder="Share a meeting point or update" value={messageDraft} /><Button onPress={() => void sendCoordinationMessage()}>Send</Button></View>
                  {safetyFeedback && <Text style={styles.detailsMeta}>{safetyFeedback}</Text>}
                </>
              );
            })()}
          </Card>
        </View>
      </Modal>
      <Modal
        animationType="slide"
        onRequestClose={() => setShowMyQuests(false)}
        visible={showMyQuests}
        transparent
      >
        <View style={styles.modalBackdrop}>
          <Card style={styles.detailsCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.detailsTitle}>My quests</Text>
              <Pressable onPress={() => setShowMyQuests(false)}>
                <Text style={styles.close}>×</Text>
              </Pressable>
            </View>
            {quests
              .filter(
                (quest) =>
                  quest.hostId === CURRENT_USER_ID ||
                  quest.participantIds.includes(CURRENT_USER_ID),
              )
              .map((quest) => (
                <View key={quest.id} style={styles.myQuestRow}>
                  <View style={styles.myQuestCopy}>
                    <Text style={styles.participantTitle}>{quest.title}</Text>
                    <Text style={styles.detailsMeta}>
                      {quest.status} · {quest.participantIds.length}/{quest.capacity}
                    </Text>
                  </View>
                  {quest.hostId === CURRENT_USER_ID && quest.status === "open" && (
                    <View style={styles.myQuestActions}>
                      <Button size="small" onPress={() => void repository.completeQuest(quest.id, CURRENT_USER_ID).then(async () => setQuests(await repository.getQuests()))}>Complete</Button>
                      <Button size="small" variant="danger" onPress={() => void repository.cancelQuest(quest.id, CURRENT_USER_ID).then(async () => setQuests(await repository.getQuests()))}>Cancel</Button>
                    </View>
                  )}
                  {quest.hostId !== CURRENT_USER_ID && quest.participantIds.includes(CURRENT_USER_ID) && quest.status === "open" && (
                    <Button size="small" variant="outline" onPress={() => void repository.leaveQuest(quest.id, CURRENT_USER_ID).then(async () => setQuests(await repository.getQuests()))}>Leave</Button>
                  )}
                  {quest.status === "completed" && <Button size="small" variant="outline" onPress={() => void repository.getActivityRecap(quest.id).then((value) => setRecap(value ? `Completed ${value.completedAt} with ${value.participantCount} participants.` : "No recap available yet."))}>Recap</Button>}
                </View>
              ))}
            {recap && <Text style={styles.recap}>{recap}</Text>}
            {pendingRequests.length > 0 && (
              <View style={styles.requestSection}>
                <Text style={styles.participantTitle}>Join requests</Text>
                {pendingRequests.map((request) => {
                  const quest = quests.find((item) => item.id === request.questId);
                  return quest ? (
                    <View key={request.id} style={styles.myQuestRow}>
                      <Text style={styles.myQuestCopy}>{profileName(request.userId)} wants to join {quest.title}</Text>
                      <View style={styles.myQuestActions}>
                        <Button size="small" onPress={() => void repository.approveRequest(quest.id, request.userId, CURRENT_USER_ID).then(refresh)}>Approve</Button>
                        <Button size="small" variant="danger" onPress={() => void repository.rejectRequest(quest.id, request.userId, CURRENT_USER_ID).then(refresh)}>Reject</Button>
                      </View>
                    </View>
                  ) : null;
                })}
              </View>
            )}
          </Card>
        </View>
      </Modal>
      <Modal
        animationType="slide"
        onRequestClose={() => setShowCreate(false)}
        visible={showCreate}
        transparent
      >
        <View style={styles.modalBackdrop}>
          <Card style={styles.detailsCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.detailsTitle}>Create a quest</Text>
              <Pressable onPress={() => setShowCreate(false)}>
                <Text style={styles.close}>×</Text>
              </Pressable>
            </View>
            <Input
              accessibilityLabel="Quest title"
              onChangeText={setCreateTitle}
              placeholder="Quest title"
              value={createTitle}
            />
            <Input
              accessibilityLabel="Quest description"
              multiline
              onChangeText={setCreateDescription}
              placeholder="What are you planning?"
              style={styles.descriptionInput}
              value={createDescription}
            />
            <Button onPress={() => void createQuest()}>Create quest</Button>
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: themes.light.background, flex: 1 },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing["6xl"] },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  headerActions: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  logo: { color: colors.forest, fontSize: 25, fontWeight: "800" },
  logoAccent: { color: colors.slate },
  eyebrow: { color: colors.slate, fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginTop: spacing.sm },
  title: { color: colors.forest, fontSize: 34, fontWeight: "700", lineHeight: 39, marginTop: spacing.lg },
  subtitle: { color: colors.slate, fontSize: 15, lineHeight: 22 },
  searchRow: { alignItems: "center", backgroundColor: colors.sage, borderRadius: 20, flexDirection: "row", gap: spacing.sm, padding: spacing.sm },
  searchInput: { borderWidth: 0, flex: 1, minHeight: 44 },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  sectionTitleRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  sectionTitle: { color: colors.forest, fontSize: 21, fontWeight: "700" },
  refresh: { color: colors.slate, fontSize: 13, fontWeight: "700" },
  chips: { gap: spacing.sm },
  chip: { backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  activeChip: { backgroundColor: colors.forest },
  chipText: { color: colors.slate, fontSize: 13, fontWeight: "600" },
  activeChipText: { color: colors.white },
  feedback: { color: themes.light.success, fontSize: 13, fontWeight: "700" },
  errorCard: { gap: spacing.md },
  errorText: { color: themes.light.danger, fontSize: 13 },
  modalBackdrop: { backgroundColor: "rgba(23,43,37,0.45)", flex: 1, justifyContent: "flex-end", padding: spacing.lg },
  detailsCard: { gap: spacing.md },
  modalHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  close: { color: colors.slate, fontSize: 30, lineHeight: 30 },
  detailsTitle: { color: colors.forest, fontSize: 24, fontWeight: "700" },
  detailsDescription: { color: colors.slate, fontSize: 15, lineHeight: 22 },
  descriptionInput: { minHeight: 100, paddingTop: spacing.md, textAlignVertical: "top" },
  detailsMeta: { color: colors.slate, fontSize: 13, lineHeight: 20 },
  participantBlock: { borderTopColor: themes.light.border, borderTopWidth: 1, gap: spacing.sm, paddingTop: spacing.md },
  participantTitle: { color: colors.forest, fontSize: 15, fontWeight: "700" },
  myQuestRow: { alignItems: "center", borderTopColor: themes.light.border, borderTopWidth: 1, flexDirection: "row", gap: spacing.sm, paddingTop: spacing.md },
  myQuestCopy: { flex: 1, gap: spacing.xs },
  myQuestActions: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  recap: { backgroundColor: themes.light.surfaceSecondary, borderRadius: 12, color: colors.forest, marginTop: spacing.md, padding: spacing.md },
  requestSection: { gap: spacing.sm, marginTop: spacing.lg },
  preferenceRow: { paddingVertical: spacing.xs },
  coordinationParticipant: { alignItems: "center", borderTopColor: themes.light.border, borderTopWidth: 1, flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.sm },
  chatBox: { backgroundColor: themes.light.surfaceSecondary, borderRadius: 12, marginVertical: spacing.sm, maxHeight: 160, padding: spacing.md },
  chatMessage: { color: colors.forest, marginBottom: spacing.xs },
  messageComposer: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
});
