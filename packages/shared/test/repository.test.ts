import assert from "node:assert/strict";
import test from "node:test";
import { MockQuestRepository } from "../src/repository.ts";
import type { SideQuest } from "../src/types.ts";
import { validateQuestCreation, validateQuestFilter } from "../src/validation.ts";

const makeQuest = (overrides: Partial<SideQuest> = {}): SideQuest => ({
  id: "quest-test",
  title: "Test quest",
  description: "A test activity",
  category: "social",
  activityType: "social",
  activityType: "social",
  hostId: "host",
  date: "2026-11-20",
  startTime: "10:00",
  endTime: "12:00",
  locationLabel: "Test location",
  capacity: 2,
  participantIds: ["host"],
  visibility: "public",
  joinMode: "instant",
  minimumAge: 16,
  status: "open",
  featured: false,
  createdAt: "2026-10-30T00:00:00Z",
  ...overrides,
});

test("instant joins enforce capacity and reject duplicate members", async () => {
  const repository = new MockQuestRepository([makeQuest()]);

  await repository.joinQuest("quest-test", "member");
  await assert.rejects(() => repository.joinQuest("quest-test", "member"), /already part/);
  await assert.rejects(() => repository.joinQuest("quest-test", "another"), /full/);

  const quest = await repository.getQuestById("quest-test");
  assert.equal(quest?.status, "full");
  assert.deepEqual(quest?.participantIds, ["host", "member"]);
});

test("approval joins create pending participants and host approval fills capacity", async () => {
  const repository = new MockQuestRepository([
    makeQuest({ joinMode: "approval", capacity: 2 }),
  ]);

  await assert.rejects(() => repository.joinQuest("quest-test", "member"), /approval request/);
  const request = await repository.requestToJoin("quest-test", "member");
  assert.equal(request.status, "pending");

  await assert.rejects(() => repository.approveRequest("quest-test", request.id, "member"), /Only the host/);
  const approved = await repository.approveRequest("quest-test", request.id, "host");
  assert.equal(approved.status, "accepted");
  assert.equal((await repository.getQuestById("quest-test"))?.status, "full");
});

test("leaving removes membership and preserves host permissions", async () => {
  const repository = new MockQuestRepository([
    makeQuest({ capacity: 3, participantIds: ["host", "member"] }),
  ]);

  await repository.leaveQuest("quest-test", "member");
  assert.deepEqual((await repository.getQuestById("quest-test"))?.participantIds, ["host"]);
  await assert.rejects(() => repository.leaveQuest("quest-test", "host"), /host cannot leave/);
});

test("only the host can complete an active quest", async () => {
  const repository = new MockQuestRepository([makeQuest()]);

  await assert.rejects(() => repository.completeQuest("quest-test", "member"), /Only the host/);
  const completed = await repository.completeQuest("quest-test", "host");
  assert.equal(completed.status, "completed");
  await assert.rejects(() => repository.joinQuest("quest-test", "late-member"), /no longer active/);
});

test("host management supports cancel, hosted/joined views, and recaps", async () => {
  const repository = new MockQuestRepository([
    makeQuest({ hostId: "host", participantIds: ["host", "member"] }),
  ]);
  await assert.rejects(() => repository.cancelQuest("quest-test", "member"), /Only the host/);
  await repository.cancelQuest("quest-test", "host");
  assert.equal((await repository.getHostedQuests("host")).length, 1);
  assert.equal((await repository.getJoinedQuests("member")).length, 1);

  const completedRepository = new MockQuestRepository([makeQuest()]);
  await completedRepository.completeQuest("quest-test", "host");
  const recap = await completedRepository.getActivityRecap("quest-test");
  assert.equal(recap?.participantCount, 1);
});

test("coordination supports local chat, participant status, reports, and blocks", async () => {
  const repository = new MockQuestRepository([
    makeQuest({ participantIds: ["host", "member"] }),
  ]);
  const message = await repository.sendMessage("quest-test", "member", "Meet at the main gate");
  assert.equal((await repository.getMessages("quest-test", "host"))[0]?.body, message.body);
  const participants = await repository.getParticipants("quest-test");
  const member = participants.find((item) => item.userId === "member");
  assert.ok(member);
  const updated = await repository.updateParticipantStatus("quest-test", member.id, "left", "host");
  assert.equal(updated.status, "left");
  const report = await repository.reportUser({ reportedUserId: "member", questId: "quest-test", reason: "Test report" }, "host");
  assert.equal(report.reporterId, "host");
  await repository.blockUser("host", "member");
  assert.deepEqual(await repository.getMessages("quest-test", "host"), []);
  await assert.rejects(() => repository.sendMessage("quest-test", "host", "   "), /cannot be empty/);
});

test("profile, settings, blocked users, and report history remain locally editable", async () => {
  const repository = new MockQuestRepository([
    makeQuest({ hostId: "user-me", participantIds: ["user-me", "member"], status: "completed" }),
  ]);
  const profile = await repository.updateProfile("user-me", { displayName: "Updated Host", city: "Mysuru" });
  assert.equal(profile.displayName, "Updated Host");
  assert.equal((await repository.getProfile("user-me"))?.city, "Mysuru");
  const settings = await repository.updateAccountSettings("user-me", {
    theme: "dark",
    notifications: { chatMessages: false, questUpdates: true, reminders: false },
  });

  assert.equal(settings.theme, "dark");
  assert.equal(settings.notifications.chatMessages, false);
  await repository.blockUser("user-me", "member");
  assert.equal((await repository.getBlockedUsers("user-me")).length, 1);
  await repository.unblockUser("user-me", "member");
  assert.equal((await repository.getBlockedUsers("user-me")).length, 0);
  await repository.reportUser({ reportedUserId: "member", reason: "Test report" }, "user-me");
  assert.equal((await repository.getReports("user-me"))[0]?.status, "submitted");
});

test("quest pages apply filters and return a continuation cursor", async () => {
  const repository = new MockQuestRepository([
    makeQuest({ id: "one", title: "Morning football", featured: true }),
    makeQuest({ id: "two", title: "Evening football", featured: false }),
  ]);

  const firstPage = await repository.getQuestPage({ search: "football", limit: 1 });
  assert.equal(firstPage.items.length, 1);
  assert.equal(firstPage.nextCursor, "1");
  const secondPage = await repository.getQuestPage({
    search: "football",
    limit: 1,
    cursor: firstPage.nextCursor,
  });
  assert.equal(secondPage.items[0]?.id, "two");
});

test("quest pages combine category, cost, and search filters", async () => {
  const repository = new MockQuestRepository([
    makeQuest({ id: "match", category: "sports", title: "Football", estimatedCost: { amount: 300, currency: "INR" } }),
    makeQuest({ id: "wrong-category", category: "food", title: "Football food walk", estimatedCost: { amount: 100, currency: "INR" } }),
    makeQuest({ id: "too-expensive", category: "sports", title: "Football premium", estimatedCost: { amount: 900, currency: "INR" } }),
  ]);

  const page = await repository.getQuestPage({
    category: "sports",
    maxCost: 500,
    search: "football",
  });
  assert.deepEqual(page.items.map((quest) => quest.id), ["match"]);
});

test("cancelled and expired quests reject new membership", async () => {
  for (const status of ["cancelled", "expired"] as const) {
    const repository = new MockQuestRepository([makeQuest({ status })]);
    await assert.rejects(() => repository.joinQuest("quest-test", "member"), /no longer active/);
  }
});

test("validation rejects unsafe quest inputs and invalid filters", () => {
  const invalid = validateQuestCreation({
    title: " ",
    description: "",
    category: "social",
    hostId: "user-me",
    date: "2026-11-20",
    startTime: "12:00",
    endTime: "10:00",
    locationLabel: "",
    capacity: 1,
    visibility: "public",
    joinMode: "instant",
    minimumAge: 15,
    featured: false,
  });
  assert.equal(invalid.success, false);
  assert.equal(validateQuestFilter({ maxCost: -1 }).success, false);
});

test("activity creation validates schedule and team-sport details", async () => {
  const repository = new MockQuestRepository([]);
  await assert.rejects(() => repository.createQuest({
    title: "Five-a-side",
    description: "A team game",
    category: "sports",
    activityType: "team-sport",
    hostId: "host",
    date: "2026-11-20",
    startTime: "12:00",
    endTime: "10:00",
    locationLabel: "Arena",
    capacity: 4,
    activityDetails: { teamSize: 5 },
    visibility: "public",
    joinMode: "instant",
    minimumAge: 16,
    featured: false,
  }), /Invalid quest/);
  const created = await repository.createQuest({
    title: "Five-a-side",
    description: "A team game",
    category: "sports",
    activityType: "team-sport",
    hostId: "host",
    date: "2026-11-20",
    startTime: "10:00",
    endTime: "12:00",
    locationLabel: "Arena",
    capacity: 10,
    activityDetails: { teamSize: 5 },
    visibility: "public",
    joinMode: "instant",
    minimumAge: 16,
    featured: false,
  });
  assert.equal(created.participantIds[0], "host");
  assert.equal((await repository.getHostedQuests("host")).length, 1);
});

test("my activity groups separate active, pending, and past activities", async () => {
  const repository = new MockQuestRepository([
    makeQuest({ id: "hosted", hostId: "user-me" }),
    makeQuest({ id: "joined", hostId: "other", participantIds: ["other", "user-me"] }),
    makeQuest({ id: "past", hostId: "user-me", status: "completed" }),
    makeQuest({ id: "pending", hostId: "other", joinMode: "approval", participantIds: ["other"] }),
  ]);
  const request = await repository.requestToJoin("pending", "user-me");
  const groups = await repository.getMyActivities("user-me");
  assert.deepEqual(groups.hosting.map((quest) => quest.id), ["hosted"]);
  assert.deepEqual(groups.joined.map((quest) => quest.id), ["joined"]);
  assert.deepEqual(groups.past.map((quest) => quest.id), ["past"]);
  assert.equal(groups.pending[0]?.participant.id, request.id);
  await assert.rejects(() => repository.requestToJoin("pending", "user-me"), /active membership or request/);
});

test("approval cannot exceed capacity and host actions remain protected", async () => {
  const repository = new MockQuestRepository([
    makeQuest({ id: "approval", hostId: "host", joinMode: "approval", capacity: 3, participantIds: ["host", "member"] }),
  ]);
  const request = await repository.requestToJoin("approval", "second");
  const nextRequest = await repository.requestToJoin("approval", "third");
  await repository.approveRequest("approval", request.id, "host");
  await assert.rejects(() => repository.approveRequest("approval", nextRequest.id, "host"), /full/);
  await assert.rejects(() => repository.cancelQuest("approval", "second"), /Only the host/);
});
