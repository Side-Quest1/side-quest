import { createClient } from "npm:@supabase/supabase-js@2.119.2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
};
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST")
    return new Response(null, { status: 405, headers });
  const token = request.headers
    .get("Authorization")
    ?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return new Response(null, { status: 401, headers });
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return new Response(null, { status: 401, headers });
  if ((await request.json().catch(() => null))?.confirmation !== "DELETE")
    return new Response(null, { status: 400, headers });
  const deletion = await admin.auth.admin.deleteUser(data.user.id);
  return new Response(null, { status: deletion.error ? 500 : 204, headers });
});
