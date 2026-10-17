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
    const { subscription, unsubscribe, endpoint: requestedEndpoint } = await request.json();
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("Supabase server configuration is missing.");
    const client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (authorization && !token) {
      return respond({ error: "Invalid account authentication." }, 401, origin);
    }
    let userId: string | null = null;
    if (token) {
      const { data, error } = await client.auth.getUser(token);
      if (!error && data.user) {
        userId = data.user.id;
      } else if (unsubscribe) {
        return respond({ error: "Invalid account authentication." }, 401, origin);
      }
    }

    if (unsubscribe) {
      if (!userId || typeof requestedEndpoint !== "string") {
        return respond({ error: "Account authentication is required to unlink this device." }, 401, origin);
      }
      const endpointUrl = new URL(requestedEndpoint);
      if (endpointUrl.protocol !== "https:" || ![
        "fcm.googleapis.com",
        "updates.push.services.mozilla.com",
        "web.push.apple.com",
      ].includes(endpointUrl.hostname) && !endpointUrl.hostname.endsWith(".notify.windows.com")) {
        return respond({ error: "Invalid push subscription endpoint." }, 400, origin);
      }
      const { error } = await client.from("push_subscriptions")
        .update({ user_id: null, updated_at: new Date().toISOString() })
        .eq("endpoint", requestedEndpoint)
        .eq("user_id", userId);
      if (error) throw error;
      return respond({ unlinked: true }, 200, origin);
    }

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

    const { error } = await client.from("push_subscriptions").upsert({
      endpoint,
      p256dh: keys.p256dh,
      auth_secret: keys.auth,
      user_id: userId,
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
