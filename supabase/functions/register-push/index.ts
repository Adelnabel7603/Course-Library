import { createClient } from "npm:@supabase/supabase-js@2";

const appOrigin = Deno.env.get("APP_ORIGIN") || "";
const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin === appOrigin ? appOrigin : "null",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

const respond = (body: unknown, status: number, origin: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || "";
  if (!appOrigin || origin !== appOrigin) {
    return respond({ error: "Origin is not allowed." }, 403, origin);
  }
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return respond({ error: "Method not allowed." }, 405, origin);
  }

  try {
    const { subscription } = await request.json();
    const endpoint = subscription?.endpoint;
    const keys = subscription?.keys;
    let endpointUrl: URL | null = null;
    if (typeof endpoint === "string") {
      try {
        endpointUrl = new URL(endpoint);
      } catch {
        return respond({ error: "Invalid push subscription endpoint." }, 400, origin);
      }
    }
    if (
      typeof endpoint !== "string" ||
      endpoint.length > 2048 ||
      !endpointUrl ||
      endpointUrl.protocol !== "https:" ||
      endpointUrl.username !== "" ||
      endpointUrl.password !== "" ||
      endpointUrl.port !== "" ||
      !(
        endpointUrl.hostname === "fcm.googleapis.com" ||
        endpointUrl.hostname === "updates.push.services.mozilla.com" ||
        endpointUrl.hostname === "web.push.apple.com" ||
        endpointUrl.hostname.endsWith(".notify.windows.com")
      ) ||
      typeof keys?.p256dh !== "string" ||
      !/^[A-Za-z0-9_-]{20,200}$/.test(keys.p256dh) ||
      typeof keys?.auth !== "string" ||
      !/^[A-Za-z0-9_-]{16,200}$/.test(keys.auth)
    ) {
      return respond({ error: "Invalid push subscription." }, 400, origin);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await supabase.from("push_subscriptions").upsert({
      endpoint,
      p256dh: keys.p256dh,
      auth_secret: keys.auth,
      user_agent: (request.headers.get("user-agent") || "").slice(0, 500),
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return respond({ registered: true }, 200, origin);
  } catch (error) {
    console.error("Push subscription registration failed.", error);
    return respond({ error: "Could not register this device for notifications." }, 500, origin);
  }
});
