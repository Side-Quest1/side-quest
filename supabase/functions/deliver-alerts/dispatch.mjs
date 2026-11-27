// The gateway and acknowledgements are injectable for local delivery tests.
export async function dispatch(jobs, gateway, finish) {
  const sending = jobs.filter((job) => !job.ticket);
  const checking = jobs.filter((job) => job.ticket);
  async function process(batch, receipts) {
    if (!batch.length) return;
    const body = receipts
      ? { ids: batch.map((j) => j.ticket) }
      : batch.map((j) => ({
          to: j.token,
          title: "SideQuest",
          body: j.body,
          data: { activityId: j.activity_id },
          channelId: "activities",
        }));
    const data = await gateway(receipts ? "getReceipts" : "send", body);
    for (const [index, job] of batch.entries()) {
      const reply = receipts ? data?.[job.ticket] : data?.[index];
      let outcome = "retry";
      if (reply?.status === "ok")
        outcome = receipts ? "delivered" : reply.id ? "ticket" : "retry";
      else if (reply?.details?.error === "DeviceNotRegistered")
        outcome = "invalid_device";
      else if (reply?.details?.error === "MessageTooBig") outcome = "failed";
      await finish(job, outcome, outcome === "ticket" ? reply.id : null);
    }
  }
  await process(checking, true);
  await process(sending, false);
}
