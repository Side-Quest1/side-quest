import type { LiveActivity, SupabaseClient } from "./index";

export type DiscoveryFilters = Partial<
  Record<
    | "category"
    | "type"
    | "mode"
    | "budget"
    | "spots"
    | "distance"
    | "from"
    | "until"
    | "search"
    | "timezone",
    string
  >
>;
export type RecommendedActivity = LiveActivity & {
  reason: string;
  score: number;
};
export type DiscoveryCursor = { snapshot: string; offset: number };
export type RecommendationPage = {
  items: RecommendedActivity[];
  next: DiscoveryCursor | null;
};

export class RecommendationService {
  constructor(private readonly db: SupabaseClient) {}
  async page(
    options: DiscoveryFilters,
    cursor: DiscoveryCursor | null = null,
    signal?: AbortSignal,
  ): Promise<RecommendationPage> {
    const request = this.db.rpc("recommend_activities", {
      options,
      after_cursor: cursor,
      page_size: 12,
    });
    const { data, error } = await (signal
      ? request.abortSignal(signal)
      : request);
    if (error) throw error;
    return data as RecommendationPage;
  }
  async record(id: string, kind: "save" | "dismiss" | "detail" | "impression") {
    const { error } = await this.db.rpc("record_discovery", {
      q: id,
      event_kind: kind,
    });
    if (error) throw error;
  }
}
