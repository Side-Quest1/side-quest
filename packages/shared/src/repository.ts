import { mockProfiles, mockQuests } from "./data";
import { canCompleteQuest, canJoinQuest, participantStatusForJoin, statusAfterMembershipChange } from "./business-rules";
import { validateQuestCreation, validateQuestUpdate } from "./validation";
import type { AccountSettings, BlockedUser, ChatMessage, QuestCreationInput, QuestParticipant, QuestUpdateInput, SideQuest, UserProfile, UserReport, ParticipantStatus, ReportStatus } from "./types";

export interface QuestRepository {
  getQuests(): Promise<SideQuest[]>;
  getQuestById(id: string): Promise<SideQuest | undefined>;
  createQuest(input: QuestCreationInput): Promise<SideQuest>;
  updateQuest(id: string, input: QuestUpdateInput, actorId: string): Promise<SideQuest>;
  cancelQuest(id: string, actorId: string): Promise<SideQuest>;
  joinQuest(id: string, userId: string): Promise<QuestParticipant>;
  leaveQuest(id: string, userId: string): Promise<void>;
  requestToJoin(id: string, userId: string): Promise<QuestParticipant>;
  approveRequest(questId: string, participantId: string, actorId: string): Promise<QuestParticipant>;
  rejectRequest(questId: string, participantId: string, actorId: string): Promise<QuestParticipant>;
  completeQuest(id: string, actorId: string): Promise<SideQuest>;
  getHostedQuests(userId: string): Promise<SideQuest[]>;
  getJoinedQuests(userId: string): Promise<SideQuest[]>;
  getPendingRequests(userId: string): Promise<QuestParticipant[]>;
  getPendingRequestsForHost(hostId: string): Promise<QuestParticipant[]>;
  getActivityRecap(id: string): Promise<import("./types").ActivityRecap | undefined>;
  getProfiles(): Promise<UserProfile[]>;
  getParticipants(questId: string): Promise<QuestParticipant[]>;
  getMessages(questId: string, actorId: string): Promise<ChatMessage[]>;
  sendMessage(questId: string, actorId: string, body: string): Promise<ChatMessage>;
  updateParticipantStatus(questId: string, participantId: string, status: ParticipantStatus, actorId: string): Promise<QuestParticipant>;
  reportUser(input: Omit<UserReport, "id" | "createdAt" | "reporterId">, reporterId: string): Promise<UserReport>;
  blockUser(blockerId: string, blockedUserId: string): Promise<BlockedUser>;
  getProfile(userId: string): Promise<UserProfile | undefined>;
  updateProfile(userId: string, input: Partial<Pick<UserProfile, "displayName" | "username" | "bio" | "city">>): Promise<UserProfile>;
  getBlockedUsers(blockerId: string): Promise<BlockedUser[]>;
  unblockUser(blockerId: string, blockedUserId: string): Promise<void>;
  getReports(reporterId: string): Promise<Array<UserReport & { status: ReportStatus }>>;
  getAccountSettings(userId: string): Promise<AccountSettings>;
  updateAccountSettings(userId: string, input: Partial<AccountSettings>): Promise<AccountSettings>;
}

export class MockQuestRepository implements QuestRepository {
  private readonly quests: SideQuest[];
  private readonly participants: QuestParticipant[];
  private readonly profiles: UserProfile[];
  private readonly messages: ChatMessage[] = [];
  private readonly reports: UserReport[] = [];
  private readonly blockedUsers: BlockedUser[] = [];
  private readonly reportStatuses = new Map<string, ReportStatus>();
  private readonly settings = new Map<string, AccountSettings>();

  constructor(
    quests: readonly SideQuest[] = mockQuests,
    participants?: readonly QuestParticipant[],
    profiles: readonly UserProfile[] = mockProfiles,
  ) {
    this.quests = quests.map((item) => structuredClone(item));
    const seededParticipants = participants ?? quests.flatMap((quest) =>
      quest.participantIds.map((userId, index) => ({
        id: `${quest.id}-participant-${index}`,
        questId: quest.id,
        userId,
        status: "accepted" as const,
        joinedAt: quest.createdAt,
      })),
    );
    this.participants = seededParticipants.map((item) => structuredClone(item));
    this.profiles = profiles.map((item) => structuredClone(item));
  }

  async getQuests() { return structuredClone(this.quests); }
  async getProfiles() { return structuredClone(this.profiles); }
  async getBlockedUsers(blockerId: string) {
    return structuredClone(this.blockedUsers.filter((item) => item.blockerId === blockerId));
  }
  async unblockUser(blockerId: string, blockedUserId: string) {
    const index = this.blockedUsers.findIndex((item) => item.blockerId === blockerId && item.blockedUserId === blockedUserId);
    if (index >= 0) this.blockedUsers.splice(index, 1);
  }
  async getReports(reporterId: string) {
    return structuredClone(this.reports.filter((report) => report.reporterId === reporterId).map((report) => ({
      ...report,
      status: this.reportStatuses.get(report.id) ?? "submitted",
    })));
  }
  async getAccountSettings(userId: string) {
    const defaults: AccountSettings = {
      theme: "system",
      notifications: { questUpdates: true, chatMessages: true, reminders: true },
    };
    return structuredClone(this.settings.get(userId) ?? defaults);
  }
  async updateAccountSettings(userId: string, input: Partial<AccountSettings>) {
    const current = await this.getAccountSettings(userId);
    const next: AccountSettings = {
      theme: input.theme ?? current.theme,
      notifications: { ...current.notifications, ...input.notifications },
    };
    this.settings.set(userId, next);
    return structuredClone(next);
  }
  async getProfile(userId: string) { return structuredClone(this.profiles.find((profile) => profile.id === userId)); }
  async updateProfile(userId: string, input: Partial<Pick<UserProfile, "displayName" | "username" | "bio" | "city">>) {
    const profile = this.profiles.find((item) => item.id === userId);
    if (!profile) throw new Error(`Profile not found: ${userId}`);
    Object.assign(profile, input);
    return structuredClone(profile);
  }
  async getParticipants(questId: string) {
    this.requireQuest(questId);
    return structuredClone(this.participants.filter((item) => item.questId === questId && item.status !== "left"));
  }
  async getMessages(questId: string, actorId: string) {
    const quest = this.requireQuest(questId);
    if (!quest.participantIds.includes(actorId)) throw new Error("Join the quest to view its chat");
    return structuredClone(this.messages.filter((item) => item.questId === questId && !this.isBlockedBetween(item.senderId, actorId)));
  }
  async sendMessage(questId: string, actorId: string, body: string) {
    await this.getMessages(questId, actorId);
    if (!body.trim()) throw new Error("Message cannot be empty");
    const message: ChatMessage = { id: `message-${Date.now()}`, questId, senderId: actorId, body: body.trim(), createdAt: new Date().toISOString() };
    this.messages.push(message);
    return structuredClone(message);
  }
  async updateParticipantStatus(questId: string, participantId: string, status: ParticipantStatus, actorId: string) {
    const quest = this.requireQuest(questId);
    this.requireHost(quest, actorId);
    const participant = this.requireParticipant(questId, participantId);
    participant.status = status;
    if (status === "accepted" && !quest.participantIds.includes(participant.userId)) quest.participantIds.push(participant.userId);
    if (status === "left" || status === "rejected") quest.participantIds = quest.participantIds.filter((id) => id !== participant.userId);
    quest.status = statusAfterMembershipChange(quest, quest.participantIds.length);
    return structuredClone(participant);
  }
  async reportUser(input: Omit<UserReport, "id" | "createdAt" | "reporterId">, reporterId: string) {
    const report: UserReport = { ...input, reporterId, id: `report-${Date.now()}`, createdAt: new Date().toISOString() };
    this.reports.push(report);
    this.reportStatuses.set(report.id, "submitted");
    return structuredClone(report);
  }
  async blockUser(blockerId: string, blockedUserId: string) {
    if (blockerId === blockedUserId) throw new Error("You cannot block yourself");
    const existing = this.blockedUsers.find((item) => item.blockerId === blockerId && item.blockedUserId === blockedUserId);
    if (existing) return structuredClone(existing);
    const blocked: BlockedUser = { blockerId, blockedUserId, createdAt: new Date().toISOString() };
    this.blockedUsers.push(blocked);
    return structuredClone(blocked);
  }
  async getQuestById(id: string) { return structuredClone(this.quests.find((item) => item.id === id)); }

  async createQuest(input: QuestCreationInput) {
    const validation = validateQuestCreation(input);
    if (!validation.success) throw new Error(`Invalid quest: ${JSON.stringify(validation.errors)}`);
    const created: SideQuest = { ...input, id: `quest-${Date.now()}`, participantIds: [input.hostId], status: "open", createdAt: new Date().toISOString() };
    this.quests.push(created);
    this.participants.push({ id: `${created.id}-host`, questId: created.id, userId: input.hostId, status: "accepted", joinedAt: created.createdAt });
    return structuredClone(created);
  }

  async updateQuest(id: string, input: QuestUpdateInput, actorId: string) {
    const quest = this.requireQuest(id);
    this.requireHost(quest, actorId);
    const validation = validateQuestUpdate(input);
    if (!validation.success) throw new Error(`Invalid quest update: ${JSON.stringify(validation.errors)}`);
    Object.assign(quest, input);
    quest.status = statusAfterMembershipChange(quest, quest.participantIds.length);
    return structuredClone(quest);
  }

  async cancelQuest(id: string, actorId: string) {
    const quest = this.requireQuest(id);
    this.requireHost(quest, actorId);
    if (quest.status === "completed" || quest.status === "expired") {
      throw new Error("This quest cannot be cancelled");
    }
    quest.status = "cancelled";
    return structuredClone(quest);
  }

  async joinQuest(id: string, userId: string) {
    const quest = this.requireQuest(id);
    if (quest.joinMode !== "instant") throw new Error("This quest requires an approval request");
    const rule = canJoinQuest(quest, userId);
    if (!rule.allowed) throw new Error(rule.reason);
    return this.addParticipant(quest, userId, participantStatusForJoin(quest));
  }

  async requestToJoin(id: string, userId: string) {
    const quest = this.requireQuest(id);
    if (quest.joinMode !== "approval") throw new Error("This quest accepts instant joins");
    const rule = canJoinQuest(quest, userId);
    if (!rule.allowed) throw new Error(rule.reason);
    return this.addParticipant(quest, userId, "pending");
  }

  async leaveQuest(id: string, userId: string) {
    const quest = this.requireQuest(id);
    if (quest.hostId === userId) throw new Error("The host cannot leave; cancel the quest instead");
    const participant = this.participants.find((item) => item.questId === id && item.userId === userId && (item.status === "accepted" || item.status === "pending"));
    if (!participant) throw new Error("You are not part of this quest");
    participant.status = "left";
    quest.participantIds = quest.participantIds.filter((item) => item !== userId);
    quest.status = statusAfterMembershipChange(quest, quest.participantIds.length);
  }

  async approveRequest(questId: string, participantId: string, actorId: string) {
    const quest = this.requireQuest(questId);
    this.requireHost(quest, actorId);
    const participant = this.requireParticipant(questId, participantId);
    const rule = canJoinQuest(quest, participant.userId);
    if (participant.status !== "pending") throw new Error("This request is not pending");
    if (!rule.allowed && rule.reason !== "You are already part of this quest") throw new Error(rule.reason);
    participant.status = "accepted";
    if (!quest.participantIds.includes(participant.userId)) quest.participantIds.push(participant.userId);
    quest.status = statusAfterMembershipChange(quest, quest.participantIds.length);
    return structuredClone(participant);
  }

  async rejectRequest(questId: string, participantId: string, actorId: string) {
    const quest = this.requireQuest(questId);
    this.requireHost(quest, actorId);
    const participant = this.requireParticipant(questId, participantId);
    if (participant.status !== "pending") throw new Error("This request is not pending");
    participant.status = "rejected";
    return structuredClone(participant);
  }

  async completeQuest(id: string, actorId: string) {
    const quest = this.requireQuest(id);
    const rule = canCompleteQuest(quest, actorId);
    if (!rule.allowed) throw new Error(rule.reason);
    quest.status = "completed";
    return structuredClone(quest);
  }

  async getHostedQuests(userId: string) {
    return structuredClone(this.quests.filter((quest) => quest.hostId === userId));
  }

  async getJoinedQuests(userId: string) {
    return structuredClone(this.quests.filter((quest) =>
      quest.participantIds.includes(userId) && quest.hostId !== userId,
    ));
  }

  async getPendingRequests(userId: string) {
    return structuredClone(this.participants.filter((participant) =>
      participant.userId === userId && participant.status === "pending",
    ));
  }
  async getPendingRequestsForHost(hostId: string) {
    const hostedQuestIds = new Set(this.quests.filter((quest) => quest.hostId === hostId).map((quest) => quest.id));
    return structuredClone(this.participants.filter((participant) =>
      hostedQuestIds.has(participant.questId) && participant.status === "pending",
    ));
  }

  async getActivityRecap(id: string) {
    const quest = this.requireQuest(id);
    if (quest.status !== "completed") return undefined;
    return {
      questId: quest.id,
      completedAt: new Date().toISOString(),
      participantCount: quest.participantIds.length,
      category: quest.category,
    };
  }

  private addParticipant(quest: SideQuest, userId: string, status: QuestParticipant["status"]) {
    const participant: QuestParticipant = { id: `${quest.id}-${userId}-${Date.now()}`, questId: quest.id, userId, status, joinedAt: new Date().toISOString() };
    this.participants.push(participant);
    if (status === "accepted") {
      quest.participantIds.push(userId);
      quest.status = statusAfterMembershipChange(quest, quest.participantIds.length);
    }
    return structuredClone(participant);
  }

  private requireQuest(id: string) {
    const quest = this.quests.find((item) => item.id === id);
    if (!quest) throw new Error(`Quest not found: ${id}`);
    return quest;
  }

  private requireParticipant(questId: string, participantId: string) {
    const participant = this.participants.find((item) => item.questId === questId && item.id === participantId);
    if (!participant) throw new Error(`Participant not found: ${participantId}`);
    return participant;
  }

  private requireHost(quest: SideQuest, actorId: string) {
    if (quest.hostId !== actorId) throw new Error("Only the host can manage this quest");
  }
  private isBlockedBetween(firstUserId: string, secondUserId: string) {
    return this.blockedUsers.some((item) =>
      (item.blockerId === firstUserId && item.blockedUserId === secondUserId) ||
      (item.blockerId === secondUserId && item.blockedUserId === firstUserId),
    );
  }
}
