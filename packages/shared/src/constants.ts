import type { QuestCategory, QuestStatus } from "./types";

export const QUEST_CATEGORIES: ReadonlyArray<{ id: QuestCategory; label: string }> = [
  { id: "sports", label: "Sports" }, { id: "food", label: "Food" },
  { id: "adventure", label: "Adventure" }, { id: "fitness", label: "Fitness" },
  { id: "travel", label: "Travel" }, { id: "gaming", label: "Gaming" },
  { id: "study", label: "Study" }, { id: "music", label: "Music" },
  { id: "photography", label: "Photography" }, { id: "movies", label: "Movies" },
  { id: "social", label: "Social" }, { id: "other", label: "Other" },
];

export const QUEST_STATUSES: readonly QuestStatus[] = [
  "open", "full", "completed", "cancelled", "expired",
];

export const CURRENT_USER_ID = "user-me";

export const isJoinableStatus = (status: QuestStatus) =>
  status === "open" || status === "full";
