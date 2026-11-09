export type QuestStatus = "open" | "full" | "completed" | "cancelled" | "expired";
export type SideQuestStatus = QuestStatus;
export type JoinMode = "instant" | "approval";
export type Visibility = "public" | "unlisted" | "invite-only";
export type QuestActivityType =
  | "team-sport"
  | "individual-sport"
  | "outdoor"
  | "food"
  | "creative"
  | "gaming"
  | "study"
  | "social";
export type QuestCategory =
  | "sports" | "food" | "adventure" | "fitness" | "travel" | "gaming"
  | "study" | "music" | "photography" | "movies" | "social" | "other";
export type ParticipantStatus = "pending" | "accepted" | "rejected" | "left";

export type UserProfile = {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  bio: string;
  city: string;
  ageEligibility: boolean;
  hostedQuestCount: number;
  joinedQuestCount: number;
  completedQuestCount: number;
};

export type SideQuest = {
  id: string;
  title: string;
  description: string;
  category: QuestCategory;
  activityType: QuestActivityType;
  activityDetails?: {
    teamSize?: number;
    skillLevel?: "beginner" | "intermediate" | "advanced" | "all-levels";
  };
  hostId: string;
  date: string;
  startTime: string;
  endTime: string;
  locationLabel: string;
  approximateDistance?: string;
  capacity: number;
  participantIds: string[];
  estimatedCost?: { amount: number; currency: string };
  visibility: Visibility;
  joinMode: JoinMode;
  minimumAge: number;
  status: QuestStatus;
  featured: boolean;
  createdAt: string;
};

export type QuestParticipant = {
  id: string;
  questId: string;
  userId: string;
  status: ParticipantStatus;
  joinedAt: string;
};

export type QuestFilter = {
  category?: QuestCategory;
  date?: string;
  maxCost?: number;
  status?: QuestStatus;
  search?: string;
  featured?: boolean;
};

export type QuestPageInput = QuestFilter & {
  limit?: number;
  cursor?: string;
};

export type QuestPage = {
  items: SideQuest[];
  nextCursor?: string;
};

export type MyActivityGroups = {
  hosting: SideQuest[];
  joined: SideQuest[];
  pending: Array<{ quest: SideQuest; participant: QuestParticipant }>;
  past: SideQuest[];
};

export type QuestCreationInput = Omit<
  SideQuest,
  "id" | "participantIds" | "status" | "createdAt"
> & { hostId: string };
export type QuestUpdateInput = Partial<
  Omit<SideQuest, "id" | "hostId" | "participantIds" | "createdAt">
>;

export type UserReport = {
  id: string;
  reporterId: string;
  reportedUserId?: string;
  questId?: string;
  reason: string;
  createdAt: string;
};

export type BlockedUser = { blockerId: string; blockedUserId: string; createdAt: string };
export type ThemePreference = "light" | "dark" | "system";
export type NotificationPreferences = {
  questUpdates: boolean;
  chatMessages: boolean;
  reminders: boolean;
};
export type AccountSettings = {
  theme: ThemePreference;
  notifications: NotificationPreferences;
};
export type ReportStatus = "submitted" | "reviewing" | "resolved";
export type ChatMessage = {
  id: string;
  questId: string;
  senderId: string;
  body: string;
  createdAt: string;
};
export type ParticipantStatusUpdate = {
  participantId: string;
  status: ParticipantStatus;
  updatedAt: string;
};
export type ActivityRecap = {
  questId: string;
  completedAt: string;
  participantCount: number;
  category: QuestCategory;
};
