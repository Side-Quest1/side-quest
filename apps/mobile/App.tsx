import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
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
  type QuestCreationInput,
  type MyActivityGroups,
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
  ThemeProvider,
  useTheme,
} from "@sidequest/ui/native";
import {
  QuestCard,
  type QuestCardData,
} from "@sidequest/ui/quest-card-native";
import { colors, spacing, themes } from "@sidequest/ui";

const repository = new MockQuestRepository();
type MobileTab = "discover" | "activities" | "create" | "alerts" | "profile";

const navigationItems: ReadonlyArray<{
  id: Exclude<MobileTab, "create"> | "create";
  label: string;
  icon: string;
}> = [
  { id: "discover", label: "Discover", icon: "◎" },
  { id: "activities", label: "Activities", icon: "▦" },
  { id: "create", label: "Create", icon: "+" },
  { id: "alerts", label: "Alerts", icon: "♢" },
  { id: "profile", label: "Profile", icon: "◯" },
];

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
  if (quest.participantIds.includes(CURRENT_USER_ID)) {
    return { label: "Leave quest", disabled: false };
  }
  if (participant?.status === "pending") {
    return { label: "Cancel request", disabled: false };
  }
  if (quest.status === "full") return { label: "Full", disabled: true };
  if (quest.status !== "open") return { label: "Unavailable", disabled: true };
  return quest.joinMode === "approval"
    ? { label: "Request to join", disabled: false }
    : { label: "Join quest", disabled: false };
}

export default function App() {
  return <ThemeProvider><AppContent /></ThemeProvider>;
}

function AppContent() {
  const { mode: themeMode, theme: activeTheme, setMode: setThemeMode } = useTheme();
  const themedStyles = {
    logo: { color: activeTheme.textPrimary },
    logoAccent: { color: activeTheme.textSecondary },
    eyebrow: { color: activeTheme.textSecondary },
    title: { color: activeTheme.textPrimary },
    subtitle: { color: activeTheme.textSecondary },
    searchRow: { backgroundColor: activeTheme.surfaceSecondary },
    filterButton: { backgroundColor: activeTheme.surface, borderColor: activeTheme.border },
    filterButtonText: { color: activeTheme.textPrimary },
    clearFilter: { color: activeTheme.textPrimary },
    sectionTitle: { color: activeTheme.textPrimary },
    refresh: { color: activeTheme.textSecondary },
    chip: { backgroundColor: activeTheme.surface },
    chipText: { color: activeTheme.textSecondary },
    activeChip: { backgroundColor: activeTheme.primary },
    activeChipText: { color: activeTheme.primaryForeground },
    feedback: { color: activeTheme.success },
    errorText: { color: activeTheme.error },
    modalBackdrop: { backgroundColor: activeTheme.background },
    close: { color: activeTheme.textSecondary },
    detailsTitle: { color: activeTheme.textPrimary },
    detailsDescription: { color: activeTheme.textSecondary },
    detailsMeta: { color: activeTheme.textSecondary },
    participantBlock: { borderTopColor: activeTheme.border },
    participantTitle: { color: activeTheme.textPrimary },
    myQuestRow: { borderTopColor: activeTheme.border },
    myQuestCopy: { color: activeTheme.textPrimary },
    recap: { backgroundColor: activeTheme.surfaceSecondary, color: activeTheme.textPrimary },
    coordinationParticipant: { borderTopColor: activeTheme.border },
    chatBox: { backgroundColor: activeTheme.surfaceSecondary },
    chatMessage: { color: activeTheme.textPrimary },
    bottomNav: { backgroundColor: activeTheme.surfaceElevated },
    activeNavItem: { backgroundColor: activeTheme.primary },
    navIcon: { color: activeTheme.textPrimary },
    navLabel: { color: activeTheme.textSecondary },
    activeNavIcon: { color: activeTheme.primaryForeground },
    activeNavLabel: { color: activeTheme.primaryForeground },
    createNavItem: { backgroundColor: "#C8F169" },
    createNavIcon: { color: "#172B25", fontWeight: "700" as const, opacity: 1 },
    createNavLabel: { color: "#172B25", fontWeight: "700" as const, opacity: 1 },
  };
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
  const [maxCost, setMaxCost] = useState<number>();
  const [selectedQuestId, setSelectedQuestId] = useState<string>();
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
  const [activeTab, setActiveTab] = useState<MobileTab>("discover");

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

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showCreate) {
        setShowCreate(false);
        setActiveTab("discover");
        return true;
      }
      if (showMyQuests) {
        setShowMyQuests(false);
        return true;
      }
      if (showSettings) {
        setShowSettings(false);
        return true;
      }
      if (coordinationQuestId) {
        setCoordinationQuestId(undefined);
        return true;
      }
      if (selectedQuestId) {
        setSelectedQuestId(undefined);
        return true;
      }
      if (activeTab !== "discover") {
        setActiveTab("discover");
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [activeTab, coordinationQuestId, selectedQuestId, showCreate, showMyQuests, showSettings]);

  const openTab = (tab: MobileTab) => {
    setActiveTab(tab);
    if (tab === "create") {
      setShowCreate(true);
      return;
    }
    if (tab === "activities") {
      setShowMyQuests(true);
      void loadMyActivities();
      return;
    }
    if (tab === "profile") {
      void openSettings();
    }
  };

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

  const loadDiscoverPage = async (cursor?: string) => {
    if (cursor) setLoadingMore(true);
    else setLoading(true);
    setError(undefined);
    try {
      const page = await repository.getQuestPage({
        ...(selectedCategory ? { category: selectedCategory } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(maxCost === undefined ? {} : { maxCost }),
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
    void loadDiscoverPage();
    // Filter changes intentionally reload the first page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, search, maxCost]);

  const refresh = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const page = await repository.getQuestPage({
        ...(selectedCategory ? { category: selectedCategory } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(maxCost === undefined ? {} : { maxCost }),
        limit: 20,
      });
      setQuests(page.items);
      setNextCursor(page.nextCursor);
      setPendingRequests(await repository.getPendingRequestsForHost(CURRENT_USER_ID));
      setMyActivities(await repository.getMyActivities(CURRENT_USER_ID));
      setFeedback("Quest list refreshed.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load quests");
    } finally {
      setLoading(false);
    }
  };

  const runMembershipAction = async (quest: SideQuest) => {
    if (busyQuestIds.has(quest.id)) return;
    setFeedback(undefined);
    setError(undefined);
    setBusyQuestIds((current) => new Set(current).add(quest.id));
    try {
      const currentParticipant = participants.find(
        (participant) =>
          participant.questId === quest.id &&
          participant.userId === CURRENT_USER_ID,
      );
      const action = getAction(quest, currentParticipant);
      if (action.disabled) return;
      if (currentParticipant?.status === "pending" || currentParticipant?.status === "accepted") {
        await repository.leaveQuest(quest.id, CURRENT_USER_ID);
        setParticipants((current) =>
          current.map((item) =>
            item.id === currentParticipant.id ? { ...item, status: "left" } : item,
          ),
        );
        setFeedback(currentParticipant.status === "pending" ? "Request cancelled." : "You left the quest.");
      } else {
        const participant =
          quest.joinMode === "approval"
            ? await repository.requestToJoin(quest.id, CURRENT_USER_ID)
            : await repository.joinQuest(quest.id, CURRENT_USER_ID);
        setParticipants((current) => [...current, participant]);
        setFeedback(
          participant.status === "pending"
            ? "Request sent to the host."
            : "You joined the quest.",
        );
      }
      setQuests(await repository.getQuests());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update membership");
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
      setQuests(await repository.getQuests());
      setCreateTitle("");
      setCreateDescription("");
      setShowCreate(false);
      setCreateReview(false);
      setActiveTab("discover");
      setSelectedQuestId(created.id);
      setFeedback("Quest created.");
    } catch (reason) {
      setCreateError(reason instanceof Error ? reason.message : "Unable to create quest");
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
    setThemeMode(nextSettings.theme);
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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: activeTheme.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.logo, themedStyles.logo]}>
              side<Text style={[styles.logoAccent, themedStyles.logoAccent]}>quest</Text>
            </Text>
            <Text style={[styles.eyebrow, themedStyles.eyebrow]}>YOUR NEXT SIDE QUEST</Text>
          </View>
        </View>
        {activeTab === "activities" ? (
          <Card style={styles.tabIntro}>
            <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>My activities</Text>
            <Text style={[styles.detailsDescription, themedStyles.detailsDescription]}>Hosting, joined, pending, and past activities in one place.</Text>
            <Button onPress={() => { setShowMyQuests(true); void loadMyActivities(); }}>Open My Activities</Button>
          </Card>
        ) : activeTab === "alerts" ? (
          <Card style={styles.tabIntro}>
            <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>Alerts</Text>
            <EmptyState title="No new alerts" description="Join requests and activity updates will appear here when available." />
          </Card>
        ) : activeTab === "profile" ? (
          <Card style={styles.tabIntro}>
            <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>Profile</Text>
            <Text style={[styles.detailsDescription, themedStyles.detailsDescription]}>Manage your profile, preferences, and safety settings.</Text>
            <Button onPress={() => void openSettings()}>Open profile</Button>
          </Card>
        ) : null}
        {(activeTab === "discover" || activeTab === "create") && <>
        <Text style={[styles.title, themedStyles.title]}>Make plans worth{"\n"}leaving home for.</Text>
        <Text style={[styles.subtitle, themedStyles.subtitle]}>
          Find people nearby who are up for the same things. No endless
          scrolling—just good plans, shared.
        </Text>
        <View style={[styles.searchRow, themedStyles.searchRow]}>
          <Input
            accessibilityLabel="Search quests"
            onChangeText={setSearch}
            placeholder="Search activities or places"
            value={search}
            style={styles.searchInput}
          />
          <Button
            onPress={() => {
              setSearch("");
              setSelectedCategory(undefined);
              setFeedback("Showing all open quests near you.");
            }}
          >
            I'm free
          </Button>
        </View>
        <View style={styles.filterRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cycle maximum budget filter"
            onPress={() => setMaxCost((current) => current === undefined ? 0 : current === 0 ? 500 : undefined)}
            style={[styles.filterButton, themedStyles.filterButton]}
          >
            <Text style={[styles.filterButtonText, themedStyles.filterButtonText]}>
              Budget: {maxCost === undefined ? "Any" : maxCost === 0 ? "Free" : "Under ₹500"}
            </Text>
          </Pressable>
          {(search || selectedCategory || maxCost !== undefined) && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setSearch("");
                setSelectedCategory(undefined);
                setMaxCost(undefined);
              }}
            >
              <Text style={[styles.clearFilter, themedStyles.clearFilter]}>Clear filters</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>Explore nearby</Text>
          <Pressable onPress={() => void refresh()}>
            <Text style={[styles.refresh, themedStyles.refresh]}>Refresh</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.chips}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <Pressable
            onPress={() => setSelectedCategory(undefined)}
            accessibilityState={{ selected: !selectedCategory }}
            style={[styles.chip, themedStyles.chip, !selectedCategory && [styles.activeChip, themedStyles.activeChip]]}
          >
            <Text style={[styles.chipText, themedStyles.chipText, !selectedCategory && [styles.activeChipText, themedStyles.activeChipText]]}>
              All quests
            </Text>
          </Pressable>
          {QUEST_CATEGORIES.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => setSelectedCategory(category.id)}
              accessibilityState={{ selected: selectedCategory === category.id }}
              style={[
                styles.chip,
                themedStyles.chip,
                selectedCategory === category.id && [styles.activeChip, themedStyles.activeChip],
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  themedStyles.chipText,
                  selectedCategory === category.id && [styles.activeChipText, themedStyles.activeChipText],
                ]}
              >
                {category.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        {feedback && <Text style={[styles.feedback, themedStyles.feedback]}>{feedback}</Text>}
        {error && (
          <Card style={styles.errorCard}>
            <Text style={[styles.errorText, themedStyles.errorText]}>{error}</Text>
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
                  <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>Featured quests</Text>
                  <Badge variant="category">Worth the trip</Badge>
                </View>
                {featuredQuests.map(renderQuest)}
              </>
            )}
            {nearbyQuests.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>Nearby quests</Text>
                {nearbyQuests.map(renderQuest)}
              </>
            )}
            {nextCursor && (
              <Button loading={loadingMore} onPress={() => void loadDiscoverPage(nextCursor)}>
                Load more
              </Button>
            )}
          </>
        )}
        </>}
      </ScrollView>
      {!showCreate && !showMyQuests && !showSettings && !coordinationQuestId && !selectedQuest && (
        <View style={[styles.bottomNav, themedStyles.bottomNav]} accessibilityRole="tablist">
          {navigationItems.map((item) => {
            const active = activeTab === item.id;
            const isCreate = item.id === "create";
            return (
              <Pressable
                key={item.id}
                accessibilityLabel={item.label}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => openTab(item.id)}
                style={({ pressed }) => [
                  styles.navItem,
                  isCreate && [styles.createNavItem, themedStyles.createNavItem],
                  active && !isCreate && [styles.activeNavItem, themedStyles.activeNavItem],
                  pressed && (isCreate ? styles.createNavPressed : styles.navPressed),
                ]}
              >
                <Text style={[styles.navIcon, themedStyles.navIcon, active && !isCreate && themedStyles.activeNavIcon, isCreate && [styles.createNavIcon, themedStyles.createNavIcon]]}>{item.icon}</Text>
                <Text style={[styles.navLabel, themedStyles.navLabel, active && !isCreate && [styles.activeNavLabel, themedStyles.activeNavLabel], isCreate && themedStyles.createNavLabel]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <StatusBar style={activeTheme === themes.dark ? "light" : "dark"} />
      <View style={[styles.fullScreen, !selectedQuest && styles.hiddenScreen]}>
        {selectedQuest && (
          <View style={[styles.modalBackdrop, themedStyles.modalBackdrop]}>
            <Card style={styles.detailsCard}>
              <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false} style={styles.modalScroll}>
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
                  <Text style={[styles.backText, themedStyles.close]}>Back</Text>
                </Pressable>
              </View>
              <Text style={[styles.detailsTitle, themedStyles.detailsTitle]}>{selectedQuest.title}</Text>
              <Text style={[styles.detailsDescription, themedStyles.detailsDescription]}>
                {selectedQuest.description}
              </Text>
              <Text style={[styles.detailsMeta, themedStyles.detailsMeta]}>
                {selectedQuest.date} · {selectedQuest.startTime}–
                {selectedQuest.endTime}
              </Text>
              <Text style={[styles.detailsMeta, themedStyles.detailsMeta]}>
                {selectedQuest.locationLabel} · {spotsRemaining(selectedQuest)} spots
                remaining
              </Text>
              <Text style={[styles.detailsMeta, themedStyles.detailsMeta]}>
                Hosted by {profileName(selectedQuest.hostId)} · Minimum age{" "}
                {selectedQuest.minimumAge}+
              </Text>
              <Text style={[styles.detailsMeta, themedStyles.detailsMeta]}>
                Status: {selectedQuest.status} ·{" "}
                {selectedQuest.joinMode === "approval"
                  ? "Request to join"
                  : "Instant join"}
              </Text>
              <Text style={[styles.detailsMeta, themedStyles.detailsMeta]}>
                Visibility: {selectedQuest.visibility}
              </Text>
              <View style={[styles.participantBlock, themedStyles.participantBlock]}>
                <Text style={[styles.participantTitle, themedStyles.participantTitle]}>
                  Participants ({selectedQuest.participantIds.length}/
                  {selectedQuest.capacity})
                </Text>
                <Text style={[styles.detailsMeta, themedStyles.detailsMeta]}>
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
              </ScrollView>
            </Card>
          </View>
        )}
      </View>
      <View style={[styles.fullScreen, !showSettings && styles.hiddenScreen]}>
        <View style={[styles.modalBackdrop, themedStyles.modalBackdrop]}>
          <Card style={styles.detailsCard}>
            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false} style={styles.modalScroll}>
            {profile && settings && <>
              <View style={styles.modalHeader}><View><Badge variant="category">Account</Badge><Text style={[styles.detailsTitle, themedStyles.detailsTitle]}>{profile.displayName}</Text></View><Pressable accessibilityLabel="Back to previous screen" onPress={() => setShowSettings(false)}><Text style={[styles.backText, themedStyles.close]}>Back</Text></Pressable></View>
              <Input accessibilityLabel="Display name" onChangeText={(displayName) => setProfile({ ...profile, displayName })} value={profile.displayName} />
              <Input accessibilityLabel="City" onChangeText={(city) => setProfile({ ...profile, city })} value={profile.city} />
              <Input accessibilityLabel="Bio" onChangeText={(bio) => setProfile({ ...profile, bio })} value={profile.bio} />
              <Button onPress={() => void repository.updateProfile(CURRENT_USER_ID, profile).then(setProfile)}>Save profile</Button>
              <Text style={[styles.participantTitle, themedStyles.participantTitle]}>Theme</Text>
              <View style={styles.myQuestActions}>{(["light", "dark", "system"] as const).map((theme) => <Button key={theme} size="small" variant={themeMode === theme ? "secondary" : "outline"} onPress={() => { setThemeMode(theme); try { globalThis.localStorage?.setItem("sidequest-theme", theme); } catch { /* native storage unavailable */ } void repository.updateAccountSettings(CURRENT_USER_ID, { theme }).then(setSettings); }}>{theme}</Button>)}</View>
              <Text style={[styles.participantTitle, themedStyles.participantTitle]}>Notifications</Text>
              {(["questUpdates", "chatMessages", "reminders"] as const).map((key) => <Pressable key={key} style={styles.preferenceRow} onPress={() => void repository.updateAccountSettings(CURRENT_USER_ID, { notifications: { ...settings.notifications, [key]: !settings.notifications[key] } }).then(setSettings)}><Text style={[styles.detailsMeta, themedStyles.detailsMeta]}>{settings.notifications[key] ? "✓" : "○"} {key}</Text></Pressable>)}
              <Text style={[styles.detailsMeta, themedStyles.detailsMeta]}>Hosted {quests.filter((q) => q.hostId === CURRENT_USER_ID).length} · Joined {quests.filter((q) => q.hostId !== CURRENT_USER_ID && q.participantIds.includes(CURRENT_USER_ID)).length} · Completed {quests.filter((q) => q.status === "completed" && (q.hostId === CURRENT_USER_ID || q.participantIds.includes(CURRENT_USER_ID))).length}</Text>
              <Text style={[styles.detailsMeta, themedStyles.detailsMeta]}>Blocked users: {blockedUsers.length} · Reports: {reports.length}</Text>
              <Button variant="outline" onPress={() => setFeedback("Logout is a placeholder in this mock prototype.")}>Log out</Button>
            </>}
            </ScrollView>
          </Card>
        </View>
      </View>
      <View style={[styles.fullScreen, !coordinationQuestId && styles.hiddenScreen]}>
        <View style={[styles.modalBackdrop, themedStyles.modalBackdrop]}>
          <Card style={styles.detailsCard}>
            <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.modalScroll}>
            {coordinationQuestId && (() => {
              const quest = quests.find((item) => item.id === coordinationQuestId);
              if (!quest) return null;
              return (
                <>
                  <View style={styles.modalHeader}><View><Badge variant="category">Coordination</Badge><Text style={[styles.detailsTitle, themedStyles.detailsTitle]}>{quest.title}</Text></View><Pressable accessibilityLabel="Back to activity details" onPress={() => setCoordinationQuestId(undefined)}><Text style={[styles.backText, themedStyles.close]}>Back</Text></Pressable></View>
                  <Text style={[styles.detailsMeta, themedStyles.detailsMeta]}>{quest.date} · {quest.startTime}–{quest.endTime}</Text>
                  <Text style={[styles.detailsMeta, themedStyles.detailsMeta]}>{quest.locationLabel} · {quest.participantIds.length}/{quest.capacity} participants</Text>
                  <Text style={[styles.participantTitle, themedStyles.participantTitle]}>Participants</Text>
                  {quest.participantIds.map((userId) => { const participant = participants.find((item) => item.questId === quest.id && item.userId === userId); return <View key={userId} style={[styles.coordinationParticipant, themedStyles.coordinationParticipant]}><Text style={[styles.myQuestCopy, themedStyles.myQuestCopy]}>{profileName(userId)}{userId === quest.hostId ? " · Host" : ""} · {participant?.status ?? "accepted"}</Text>{userId !== CURRENT_USER_ID && <View style={styles.myQuestActions}>{quest.hostId === CURRENT_USER_ID && participant && <Button size="small" variant="outline" onPress={() => void repository.updateParticipantStatus(quest.id, participant.id, "left", CURRENT_USER_ID).then(refresh)}>Mark left</Button>}<Button size="small" variant="outline" onPress={() => void repository.reportUser({ reportedUserId: userId, questId: quest.id, reason: "Concern raised from coordination" }, CURRENT_USER_ID).then(() => setSafetyFeedback("Report submitted."))}>Report</Button><Button size="small" variant="danger" onPress={() => void repository.blockUser(CURRENT_USER_ID, userId).then(() => setSafetyFeedback("Participant blocked."))}>Block</Button></View>}</View>; })}
                  <Text style={[styles.participantTitle, themedStyles.participantTitle]}>Group chat</Text>
                  <View style={[styles.chatBox, themedStyles.chatBox]}>{messages.length === 0 ? <Text style={[styles.detailsMeta, themedStyles.detailsMeta]}>No messages yet. Start coordinating the plan.</Text> : messages.map((message) => <Text key={message.id} style={[styles.chatMessage, themedStyles.chatMessage]}><Text style={[styles.participantTitle, themedStyles.participantTitle]}>{profileName(message.senderId)}:</Text> {message.body}</Text>)}</View>
                  <View style={styles.messageComposer}><Input accessibilityLabel="Coordination message" onChangeText={setMessageDraft} placeholder="Share a meeting point or update" value={messageDraft} /><Button onPress={() => void sendCoordinationMessage()}>Send</Button></View>
                  {safetyFeedback && <Text style={[styles.detailsMeta, themedStyles.detailsMeta]}>{safetyFeedback}</Text>}
                </>
              );
            })()}
            </ScrollView>
          </Card>
        </View>
      </View>
      <View style={[styles.fullScreen, !showMyQuests && styles.hiddenScreen]}>
        <View style={[styles.modalBackdrop, themedStyles.modalBackdrop]}>
          <Card style={styles.detailsCard}>
            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false} style={styles.modalScroll}>
            <View style={styles.modalHeader}>
              <View>              <Text style={[styles.detailsTitle, themedStyles.detailsTitle]}>My activities</Text><Text style={[styles.detailsMeta, themedStyles.detailsMeta]}>Hosting, joined, pending, and past</Text></View>
              <Pressable onPress={() => setShowMyQuests(false)}>
                <Text style={[styles.backText, themedStyles.close]}>Back</Text>
              </Pressable>
            </View>
            {myActivitiesLoading && <LoadingState label="Loading your activities" />}
            {myActivitiesError && <><Text style={[styles.errorText, themedStyles.errorText]}>{myActivitiesError}</Text><Button onPress={() => void loadMyActivities()}>Try again</Button></>}
            {!myActivitiesLoading && !myActivitiesError && myActivities && ([
              ["Hosting", myActivities.hosting],
              ["Joined", myActivities.joined],
              ["Past activities", myActivities.past],
            ] as const).map(([label, items]) => <View key={label} style={styles.requestSection}><Text style={[styles.participantTitle, themedStyles.participantTitle]}>{label}</Text>{items.length === 0 ? <Text style={[styles.detailsMeta, themedStyles.detailsMeta]}>No activities here yet.</Text> : items.map((quest) => (
                <View key={quest.id} style={styles.myQuestRow}>
                  <Pressable style={styles.myQuestCopy} onPress={() => { setSelectedQuestId(quest.id); setShowMyQuests(false); }}>
                    <Text style={[styles.participantTitle, themedStyles.participantTitle]}>{quest.title}</Text>
                    <Text style={[styles.detailsMeta, themedStyles.detailsMeta]}>{quest.date} · {quest.startTime}–{quest.endTime}</Text>
                    <Text style={[styles.detailsMeta, themedStyles.detailsMeta]}>{quest.status} · {quest.participantIds.length}/{quest.capacity} · {quest.activityType}</Text>
                  </Pressable>
                  {quest.hostId === CURRENT_USER_ID && (quest.status === "open" || quest.status === "full") && (
                    <View style={styles.myQuestActions}>
                      <Button size="small" loading={busyActionKey === `complete:${quest.id}`} onPress={() => void manageQuest(quest.id, "complete")}>Complete</Button>
                      <Button size="small" variant="danger" loading={busyActionKey === `cancel:${quest.id}`} onPress={() => void manageQuest(quest.id, "cancel")}>Cancel</Button>
                    </View>
                  )}
                  {quest.hostId !== CURRENT_USER_ID && (quest.status === "open" || quest.status === "full") && (
                    <Button size="small" variant="outline" loading={busyActionKey === `leave:${quest.id}`} onPress={() => void manageQuest(quest.id, "leave")}>Leave</Button>
                  )}
                  {quest.status === "completed" && <Button size="small" variant="outline" onPress={() => void repository.getActivityRecap(quest.id).then((value) => setRecap(value ? `Completed ${value.completedAt} with ${value.participantCount} participants.` : "No recap available yet."))}>Recap</Button>}
                </View>
              ))}</View>)}
            {myActivities && <View style={styles.requestSection}><Text style={[styles.participantTitle, themedStyles.participantTitle]}>Pending requests</Text>{myActivities.pending.length === 0 ? <Text style={[styles.detailsMeta, themedStyles.detailsMeta]}>No pending requests.</Text> : myActivities.pending.map(({ quest }) => <Pressable key={quest.id} style={[styles.myQuestRow, themedStyles.myQuestRow]} onPress={() => { setSelectedQuestId(quest.id); setShowMyQuests(false); }}><Text style={[styles.myQuestCopy, themedStyles.myQuestCopy]}>{quest.title}{"\n"}<Text style={[styles.detailsMeta, themedStyles.detailsMeta]}>{quest.date} · Awaiting host approval</Text></Text></Pressable>)}</View>}
            {recap && <Text style={[styles.recap, themedStyles.recap]}>{recap}</Text>}
            {pendingRequests.length > 0 && (
              <View style={styles.requestSection}>
                <Text style={[styles.participantTitle, themedStyles.participantTitle]}>Join requests</Text>
                {pendingRequests.map((request) => {
                  const quest = quests.find((item) => item.id === request.questId);
                  return quest ? (
                    <View key={request.id} style={styles.myQuestRow}>
                      <Text style={[styles.myQuestCopy, themedStyles.myQuestCopy]}>{profileName(request.userId)} wants to join {quest.title}</Text>
                      <View style={styles.myQuestActions}>
                        <Button size="small" loading={busyActionKey === `approve:${request.id}`} onPress={() => void manageRequest(request, true)}>Approve</Button>
                        <Button size="small" variant="danger" loading={busyActionKey === `reject:${request.id}`} onPress={() => void manageRequest(request, false)}>Reject</Button>
                      </View>
                    </View>
                  ) : null;
                })}
              </View>
            )}
            </ScrollView>
          </Card>
        </View>
      </View>
      <View style={[styles.fullScreen, !showCreate && styles.hiddenScreen]}>
        <KeyboardAvoidingView behavior="padding" style={[styles.modalBackdrop, themedStyles.modalBackdrop]}>
          <Card style={styles.detailsCard}>
            <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.modalScroll}
            >
              <View style={styles.modalHeader}>
                <View><Text style={[styles.detailsTitle, themedStyles.detailsTitle]}>{createReview ? "Review your activity" : "Create an activity"}</Text><Text style={[styles.detailsMeta, themedStyles.detailsMeta]}>{createReview ? "Confirm the details before publishing." : "Required details first, then how people join."}</Text></View>
                <Button variant="ghost" size="small" accessibilityLabel="Back from create activity" onPress={() => { setCreateReview(false); setShowCreate(false); setActiveTab("discover"); }}>Back</Button>
              </View>
            {createReview && <Card><Text style={[styles.participantTitle, themedStyles.participantTitle]}>{createTitle}</Text><Text style={[styles.detailsMeta, themedStyles.detailsMeta]}>{createDate} · {createStartTime}–{createEndTime} · {createLocation}</Text><Text style={[styles.detailsMeta, themedStyles.detailsMeta]}>{createCapacity} participants · {createJoinMode === "instant" ? "Instant join" : "Request to join"} · {createVisibility}</Text></Card>}
            <Input
              accessibilityLabel="Activity title"
              onChangeText={setCreateTitle}
              placeholder="Activity title"
              value={createTitle}
            />
            <Input
              accessibilityLabel="Activity description"
              multiline
              onChangeText={setCreateDescription}
              placeholder="What are you planning?"
              style={styles.descriptionInput}
              value={createDescription}
            />
            <Text style={[styles.participantTitle, themedStyles.participantTitle]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{QUEST_CATEGORIES.map((item) => <Button key={item.id} size="small" variant={createCategory === item.id ? "secondary" : "outline"} onPress={() => setCreateCategory(item.id)}>{item.label}</Button>)}</ScrollView>
            <Text style={[styles.participantTitle, themedStyles.participantTitle]}>Activity type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{QUEST_ACTIVITY_TYPES.map((item) => <Button key={item.id} size="small" variant={createActivityType === item.id ? "secondary" : "outline"} onPress={() => setCreateActivityType(item.id)}>{item.label}</Button>)}</ScrollView>
            <Text style={[styles.detailsMeta, themedStyles.detailsMeta]}>{QUEST_ACTIVITY_TYPES.find((item) => item.id === createActivityType)?.description}</Text>
            {createActivityType === "team-sport" && <Input accessibilityLabel="Players per team" keyboardType="number-pad" onChangeText={setCreateTeamSize} placeholder="Players per team" value={createTeamSize} />}
            <View style={styles.formRow}><Input invalid={Boolean(createFieldErrors.date)} accessibilityLabel="Activity date" onChangeText={setCreateDate} placeholder="Date (YYYY-MM-DD)" value={createDate} /><Input invalid={Boolean(createFieldErrors.startTime)} accessibilityLabel="Start time" onChangeText={setCreateStartTime} placeholder="Start (HH:MM)" value={createStartTime} /><Input invalid={Boolean(createFieldErrors.endTime)} accessibilityLabel="End time" onChangeText={setCreateEndTime} placeholder="End (HH:MM)" value={createEndTime} /></View>
            <Input invalid={Boolean(createFieldErrors.locationLabel)} accessibilityLabel="Activity location" onChangeText={setCreateLocation} placeholder="Location or meeting point" value={createLocation} />
            <View style={styles.formRow}><Input invalid={Boolean(createFieldErrors.capacity)} accessibilityLabel="Activity capacity" keyboardType="number-pad" onChangeText={setCreateCapacity} placeholder="Capacity (2–100)" value={createCapacity} /><Input invalid={Boolean(createFieldErrors.estimatedCost)} accessibilityLabel="Optional cost" keyboardType="decimal-pad" onChangeText={setCreateCost} placeholder="Optional cost INR" value={createCost} /></View>
            <View style={styles.myQuestActions}><Button size="small" variant={createJoinMode === "instant" ? "secondary" : "outline"} onPress={() => setCreateJoinMode("instant")}>Instant join</Button><Button size="small" variant={createJoinMode === "approval" ? "secondary" : "outline"} onPress={() => setCreateJoinMode("approval")}>Request to join</Button></View>
            <View style={styles.myQuestActions}><Button size="small" variant={createVisibility === "public" ? "secondary" : "outline"} onPress={() => setCreateVisibility("public")}>Public</Button><Button size="small" variant={createVisibility === "unlisted" ? "secondary" : "outline"} onPress={() => setCreateVisibility("unlisted")}>Unlisted</Button><Button size="small" variant={createVisibility === "invite-only" ? "secondary" : "outline"} onPress={() => setCreateVisibility("invite-only")}>Invite-only</Button></View>
            {createError && <Text style={[styles.errorText, themedStyles.errorText]}>{createError}{Object.keys(createFieldErrors).length > 0 ? ` ${Object.values(createFieldErrors).join(" ")}` : ""}</Text>}
              <Button loading={creating} onPress={() => void createQuest()}>{createReview ? "Publish activity" : "Review activity"}</Button>
            </ScrollView>
          </Card>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fullScreen: { backgroundColor: themes.light.background, bottom: 0, left: 0, position: "absolute", right: 0, top: 0, zIndex: 10 },
  hiddenScreen: { display: "none" },
  safeArea: { backgroundColor: themes.light.background, flex: 1 },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: 132 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  headerActions: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  tabIntro: { gap: spacing.md, marginTop: spacing.lg },
  logo: { color: colors.forest, fontSize: 25, fontWeight: "800" },
  logoAccent: { color: colors.slate },
  eyebrow: { color: colors.slate, fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginTop: spacing.sm },
  title: { color: colors.forest, fontSize: 34, fontWeight: "700", lineHeight: 39, marginTop: spacing.lg },
  subtitle: { color: colors.slate, fontSize: 15, lineHeight: 22 },
  searchRow: { alignItems: "center", backgroundColor: colors.sage, borderRadius: 20, flexDirection: "row", gap: spacing.sm, padding: spacing.sm },
  searchInput: { borderWidth: 0, flex: 1, minHeight: 44 },
  filterRow: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  filterButton: { backgroundColor: colors.white, borderColor: themes.light.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  filterButtonText: { color: colors.forest, fontSize: 13, fontWeight: "700" },
  clearFilter: { color: colors.forest, fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },
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
  errorText: { color: themes.light.error, fontSize: 13 },
  modalBackdrop: { flex: 1 },
  detailsCard: { borderRadius: 0, borderWidth: 0, flex: 1, gap: spacing.md },
  modalScroll: { flex: 1 },
  modalScrollContent: { gap: spacing.md, paddingBottom: spacing.lg },
  modalHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  close: { color: colors.slate, fontSize: 30, lineHeight: 30 },
  backText: { fontSize: 15, fontWeight: "700" },
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
  formRow: { flexDirection: "row", gap: spacing.sm },
  bottomNav: {
    alignItems: "center",
    backgroundColor: colors.forest,
    borderRadius: 28,
    bottom: 12,
    elevation: 10,
    flexDirection: "row",
    justifyContent: "space-around",
    left: spacing.md,
    paddingBottom: 8,
    paddingHorizontal: 4,
    paddingTop: 8,
    position: "absolute",
    right: spacing.md,
    shadowColor: "#000",
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  navItem: {
    alignItems: "center",
    borderRadius: 22,
    justifyContent: "center",
    minHeight: 52,
    minWidth: 52,
    paddingHorizontal: 5,
  },
  activeNavItem: { backgroundColor: "#29463A" },
  navPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  createNavPressed: { opacity: 1, transform: [{ scale: 0.96 }] },
  navIcon: { color: colors.white, fontSize: 21, lineHeight: 24 },
  navLabel: { color: "#D9E3D8", fontSize: 10, fontWeight: "700", marginTop: 2 },
  activeNavLabel: { color: colors.lime },
  createNavItem: {
    backgroundColor: colors.lime,
    borderRadius: 28,
    elevation: 8,
    minHeight: 64,
    minWidth: 64,
    shadowColor: "#000",
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    transform: [{ translateY: -10 }],
  },
  createNavIcon: { color: colors.forest, fontSize: 30, lineHeight: 32 },
});
