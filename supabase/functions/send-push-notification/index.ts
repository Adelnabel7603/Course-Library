import { createClient } from "npm:@supabase/supabase-js@2";
import webPush from "npm:web-push@3.6.7";

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
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) {
      return respond({ error: "Administrator authentication is required." }, 401, origin);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("Supabase server configuration is missing.");
    const adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !userData.user) {
      return respond({ error: "Administrator authentication is invalid." }, 401, origin);
    }
    const { data: admin, error: adminError } = await adminClient
      .from("admins")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (adminError) throw adminError;
    if (!admin) return respond({ error: "Administrator access is required." }, 403, origin);

    const { notificationId } = await request.json();
    if (
      typeof notificationId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(notificationId)
    ) {
      return respond({ error: "Invalid notification ID." }, 400, origin);
    }
    const { data: notification, error: notificationError } = await adminClient
      .from("notifications")
      .select("id, title, body, image_path, is_active")
      .eq("id", notificationId)
      .maybeSingle();
    if (notificationError) throw notificationError;
    if (!notification || !notification.is_active) {
      return respond({ error: "Notification is not available." }, 404, origin);
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT");
    const siteUrl = Deno.env.get("SITE_URL");
    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject || !siteUrl) {
      return respond({ error: "Web push is not configured on the server." }, 503, origin);
    }
    const targetUrl = new URL(siteUrl);
    if (targetUrl.origin !== appOrigin) {
      return respond({ error: "Notification destination is not allowed." }, 500, origin);
    }
    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const { data: subscriptions, error: subscriptionsError } = await adminClient
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth_secret");
    if (subscriptionsError) throw subscriptionsError;

    targetUrl.searchParams.set("notification", notification.id);
    const image = notification.image_path
      ? adminClient.storage.from("notification-images").getPublicUrl(notification.image_path).data.publicUrl
      : undefined;
    const payload = JSON.stringify({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      image,
      url: targetUrl.href,
    });
    const results = await Promise.all((subscriptions || []).map(async (subscription) => {
      try {
        const endpoint = new URL(subscription.endpoint);
        if (
          endpoint.protocol !== "https:" ||
          !(
            endpoint.hostname === "fcm.googleapis.com" ||
            endpoint.hostname === "updates.push.services.mozilla.com" ||
            endpoint.hostname === "web.push.apple.com" ||
            endpoint.hostname.endsWith(".notify.windows.com")
          )
        ) throw new Error("Untrusted push endpoint.");
        await webPush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth_secret },
        }, payload);
        return { sent: true, expired: false };
      } catch (error) {
        const statusCode = error && typeof error === "object" && "statusCode" in error
          ? Number(error.statusCode) || 0
          : 0;
        if (statusCode === 404 || statusCode === 410) {
          const { error: deleteError } = await adminClient
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", subscription.endpoint);
          if (deleteError) console.error("Could not remove expired push subscription.", deleteError);
          return { sent: false, expired: true };
        }
        console.error("Push delivery failed.", { statusCode });
        return { sent: false, expired: false };
      }
    }));
    return respond({
      sent: results.filter((result) => result.sent).length,
      failed: results.filter((result) => !result.sent && !result.expired).length,
      expired: results.filter((result) => result.expired).length,
    }, 200, origin);
  } catch (error) {
    console.error("Push notification delivery failed.", error);
    return respond({ error: "Could not send device notifications." }, 500, origin);
  }
});
