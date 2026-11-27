import { createClient } from "npm:@supabase/supabase-js@2.119.2";
import { dispatch } from "./dispatch.mjs";

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  const secret = Deno.env.get("PUSH_WORKER_SECRET");
  if (!secret || request.headers.get("Authorization") !== "Bearer " + secret)
    return new Response(null, { status: 401 });
  if (Deno.env.get("PUSH_DELIVERY_ENABLED") !== "true")
    return new Response(null, { status: 204 });
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await db.rpc("claim_push_work");
  if (error) return new Response(null, { status: 503 });
  try {
    await dispatch(
      data,
      async (action: string, payload: unknown) => {
        const token = Deno.env.get("EXPO_ACCESS_TOKEN");
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) headers.Authorization = "Bearer " + token;
        const response = await fetch(
          "https://exp.host/--/api/v2/push/" + action,
          {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15000),
          },
        );
        if (!response.ok) throw Error("Push gateway unavailable");
        return (await response.json()).data;
      },
      async (
        job: { id: number; lease: string },
        outcome: string,
        receipt: string | null,
      ) => {
        const { error } = await db.rpc("finish_push_work", {
          job: job.id,
          lease_id: job.lease,
          outcome,
          receipt,
        });
        if (error) throw error;
      },
    );
    return Response.json({ claimed: data.length });
  } catch {
    return new Response(null, { status: 503 });
  }
});
