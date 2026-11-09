import type { QuestActivityType, QuestCategory, QuestStatus } from "./types";

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

export const QUEST_ACTIVITY_TYPES: ReadonlyArray<{
  id: QuestActivityType;
  label: string;
  description: string;
  requiresTeamSize?: boolean;
}> = [
  { id: "team-sport", label: "Team sport", description: "A team-based game such as football or volleyball.", requiresTeamSize: true },
  { id: "individual-sport", label: "Individual sport", description: "A sport such as badminton, running, or climbing." },
  { id: "outdoor", label: "Outdoor adventure", description: "A trek, ride, walk, or outdoor plan." },
  { id: "food", label: "Food and drink", description: "A meal, cafe visit, or food discovery." },
  { id: "creative", label: "Creative", description: "Photography, music, art, or making something." },
  { id: "gaming", label: "Gaming", description: "Board games, video games, or a tournament." },
  { id: "study", label: "Study", description: "A focused study or learning session." },
  { id: "social", label: "Social", description: "A casual hangout or conversation." },
];

export const isJoinableStatus = (status: QuestStatus) =>
  status === "open" || status === "full";
