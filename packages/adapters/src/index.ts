import {
  createClient,
  type SupabaseClient,
  type SupportedStorage,
} from "@supabase/supabase-js";
export type { Session, SupabaseClient } from "@supabase/supabase-js";
export * from "./recommendations";

export function connect(
  url?: string,
  key?: string,
  storage?: SupportedStorage,
) {
  if (!url || !key) return undefined;
  return createClient(url, key, {
    auth: {
      storage,
      flowType: "pkce",
      detectSessionInUrl: !storage,
      persistSession: true,
    },
  });
}

export type LiveActivity = {
  id: string;
  host_id: string;
  title: string;
  description: string;
  area: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  join_mode: "approval" | "instant";
  state: string;
  category: string;
  cost_inr: number;
  available_spots: number;
  activity_type: string;
  visibility: string;
  latitude: number | null;
  longitude: number | null;
  requirements: string;
  type_notes: string;
  team_size: number | null;
  activity_host?: string;
  participations: { user_id: string; status: string }[];
};
export type ParticipationAction =
  | "join"
  | "leave"
  | "approve"
  | "reject"
  | "complete"
  | "cancel";

export class SupabaseQuestRepository {
  constructor(private readonly db: SupabaseClient) {}

  async byId(id: string) {
    const { data, error } = await this.db
      .from("activities")
      .select("*,available_spots,activity_host,participations(user_id,status)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as LiveActivity | null;
  }

  async discover(input: {
    search: string;
    category: string;
    budget: string;
    pages: number;
    mine?: string;
    group?: string;
  }) {
    let query = this.db
      .from("activities")
      .select(
        input.mine
          ? "*,available_spots,participations(user_id,status),mine:participations!inner(user_id,status)"
          : "*,available_spots,participations(user_id,status)",
      );
    if (input.mine) {
      query = query
        .eq("mine.user_id", input.mine)
        .in(
          "mine.status",
          input.group === "Pending"
            ? ["pending"]
            : input.group === "Joined"
              ? ["accepted"]
              : ["pending", "accepted"],
        );
      if (input.group === "Hosting") query = query.eq("host_id", input.mine);
      if (input.group === "Joined") query = query.neq("host_id", input.mine);
      if (input.group === "Past")
        query = query.or(
          "state.neq.open,ends_at.lt." + new Date().toISOString(),
        );
      if (input.group === "Upcoming")
        query = query
          .eq("state", "open")
          .gt("starts_at", new Date().toISOString());
    } else
      query = query
        .eq("state", "open")
        .gt("starts_at", new Date().toISOString());
    if (input.category) query = query.eq("category", input.category);
    if (input.budget) query = query.lte("cost_inr", Number(input.budget));
    if (input.search.trim())
      query = query.ilike("title", "%" + input.search.trim() + "%");
    const { data, error } = await query
      .order("starts_at", { ascending: input.group !== "Past" })
      .order("id")
      .range(0, input.pages * 20 - 1);
    if (error) throw error;
    return data as unknown as LiveActivity[];
  }

  async save(
    input: Omit<
      LiveActivity,
      | "id"
      | "host_id"
      | "state"
      | "available_spots"
      | "participations"
      | "activity_host"
    >,
    id?: string,
  ): Promise<string> {
    if (id) {
      const { error } = await this.db.rpc("update_activity_details", {
        q: id,
        changes: input,
      });
      if (error) throw error;
      return id;
    }
    const { data, error } = await this.db
      .from("activities")
      .insert(input)
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  async participate(q: string, action: ParticipationAction, target?: string) {
    const { error } = await this.db.rpc("change_participation", {
      q,
      action,
      target: target ?? null,
    });
    if (error) throw error;
  }

  async messages(id: string) {
    const { data, error } = await this.db
      .from("activity_messages")
      .select("id,body,sender,created_at")
      .eq("activity_id", id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(60);
    if (error) throw error;
    return data.reverse() as {
      id: string;
      body: string;
      sender: string;
      created_at: string;
    }[];
  }

  async send(id: string, body: string) {
    const { error } = await this.db
      .from("activity_messages")
      .insert({ activity_id: id, body: body.trim() });
    if (error) throw error;
  }
}
