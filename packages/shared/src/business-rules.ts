import { isJoinableStatus } from "./constants";
import type { JoinMode, ParticipantStatus, QuestStatus, SideQuest } from "./types";

export type RuleResult = { allowed: true } | { allowed: false; reason: string };

export const acceptedCount = (quest: SideQuest) => quest.participantIds.length;
export const spotsRemaining = (quest: SideQuest) => Math.max(quest.capacity - acceptedCount(quest), 0);

export function canJoinQuest(quest: SideQuest, userId: string): RuleResult {
  if (!userId) return { allowed: false, reason: "A user is required" };
  if (!isJoinableStatus(quest.status)) return { allowed: false, reason: "This quest is no longer active" };
  if (quest.participantIds.includes(userId)) return { allowed: false, reason: "You are already part of this quest" };
  if (spotsRemaining(quest) === 0) return { allowed: false, reason: "This quest is full" };
  return { allowed: true };
}

export function participantStatusForJoin(quest: SideQuest): ParticipantStatus {
  return quest.joinMode === "instant" ? "accepted" : "pending";
}

export function statusAfterMembershipChange(quest: SideQuest, participantCount: number): QuestStatus {
  if (quest.status === "completed" || quest.status === "cancelled" || quest.status === "expired") return quest.status;
  return participantCount >= quest.capacity ? "full" : "open";
}

export function canCompleteQuest(quest: SideQuest, actorId: string): RuleResult {
  if (quest.hostId !== actorId) return { allowed: false, reason: "Only the host can complete a quest" };
  if (quest.status !== "open" && quest.status !== "full") return { allowed: false, reason: "Only active quests can be completed" };
  return { allowed: true };
}

export function canChangeJoinMode(mode: JoinMode): boolean {
  return mode === "instant" || mode === "approval";
}
