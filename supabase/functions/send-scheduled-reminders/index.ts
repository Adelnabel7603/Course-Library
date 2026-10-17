import { createClient } from "npm:@supabase/supabase-js@2";
import webPush from "npm:web-push@3.6.7";

type Reminder = {
  user_id: string;
  reminder_type: "calendar" | "personal";
  reminder_id: string | null;
  event_id: string | null;
  title: string;
  body: string;
  event_type: "lecture" | "section" | "exam" | null;
  course_name: string | null;
  location_name: string | null;
  occurrence_at: string;
};

type PushSubscription = {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth_secret: string;
};

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

function isTrustedEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && url.username === "" && url.password === "" &&
      url.port === "" && (
        url.hostname === "fcm.googleapis.com" ||
        url.hostname === "updates.push.services.mozilla.com" ||
        url.hostname === "web.push.apple.com" ||
        url.hostname.endsWith(".notify.windows.com")
      );
  } catch {
    return false;
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return respond({ error: "Method not allowed." }, 405);
  const secret = Deno.env.get("SCHEDULED_REMINDERS_SECRET") || "";
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return respond({ error: "Scheduler authentication is required." }, 401);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT");
    const siteUrl = Deno.env.get("SITE_URL");
    const appOrigin = Deno.env.get("APP_ORIGIN");
    if (!supabaseUrl || !serviceKey || !vapidPublicKey || !vapidPrivateKey || !vapidSubject || !siteUrl || !appOrigin) {
      throw new Error("Scheduled reminder server settings are incomplete.");
    }
    const targetUrl = new URL(siteUrl);
    if (targetUrl.origin !== appOrigin) throw new Error("Reminder target is outside the configured site origin.");
    targetUrl.hash = "planner";
    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const client = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: reminders, error: remindersError } = await client.rpc("claim_due_calendar_pushes");
    if (remindersError) throw remindersError;
    const dueReminders = (reminders || []) as Reminder[];
    if (!dueReminders.length) return respond({ sent: 0, failed: 0, expired: 0 });

    const userIds = [...new Set(dueReminders.map((reminder) => reminder.user_id))];
    const { data: subscriptions, error: subscriptionsError } = await client
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth_secret")
      .in("user_id", userIds);
    if (subscriptionsError) throw subscriptionsError;
    const subscriptionsByUser = new Map<string, PushSubscription[]>();
    for (const subscription of (subscriptions || []) as PushSubscription[]) {
      const userSubscriptions = subscriptionsByUser.get(subscription.user_id) || [];
      userSubscriptions.push(subscription);
      subscriptionsByUser.set(subscription.user_id, userSubscriptions);
    }

    let sent = 0;
    let failed = 0;
    let expired = 0;
    for (const reminder of dueReminders) {
      const scheduleTime = new Intl.DateTimeFormat("ar-EG", {
        timeZone: "Africa/Cairo",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(reminder.occurrence_at));
      const eventKind = reminder.event_type === "exam"
        ? "امتحان"
        : reminder.event_type === "section" ? "سكشن" : "محاضرة";
      const title = reminder.reminder_type === "personal"
        ? reminder.title
        : `${eventKind}: ${reminder.course_name || reminder.title}`;
      const body = reminder.reminder_type === "personal"
        ? reminder.body || "موعد تذكيرك الآن."
        : `${reminder.title} · ${reminder.location_name || ""} · ${scheduleTime}`;
      const reminderTag = reminder.reminder_type === "personal"
        ? `personal-${reminder.user_id}-${reminder.reminder_id}`
        : `calendar-${reminder.user_id}-${reminder.event_id}-${reminder.occurrence_at}`;
      const payload = JSON.stringify({
        id: reminderTag,
        title,
        body,
        url: targetUrl.href,
      });

      let deliveredForReminder = false;
      for (const subscription of subscriptionsByUser.get(reminder.user_id) || []) {
        if (!isTrustedEndpoint(subscription.endpoint)) {
          failed += 1;
          continue;
        }
        try {
          await webPush.sendNotification({
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth_secret },
          }, payload);
          sent += 1;
          deliveredForReminder = true;
        } catch (error) {
          const statusCode = error && typeof error === "object" && "statusCode" in error
            ? Number(error.statusCode) || 0
            : 0;
          if (statusCode === 404 || statusCode === 410) {
            const { error: deleteError } = await client.from("push_subscriptions")
              .delete()
              .eq("endpoint", subscription.endpoint)
              .eq("user_id", subscription.user_id);
            if (deleteError) console.error("Could not remove expired push subscription.", deleteError);
            expired += 1;
          } else {
            failed += 1;
            console.error("Scheduled push delivery failed.", { statusCode, userId: reminder.user_id });
          }
        }
      }
      if (deliveredForReminder && reminder.reminder_type === "personal" && reminder.reminder_id) {
        const { error } = await client.from("student_reminders")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", reminder.reminder_id)
          .eq("user_id", reminder.user_id)
          .is("sent_at", null);
        if (error) console.error("Could not mark a personal reminder as sent.", error);
      } else if (deliveredForReminder && reminder.reminder_type === "calendar" && reminder.event_id) {
        const { error } = await client.from("calendar_reminder_deliveries").upsert({
          user_id: reminder.user_id,
          event_id: reminder.event_id,
          occurrence_at: reminder.occurrence_at,
        }, { onConflict: "user_id,event_id,occurrence_at", ignoreDuplicates: true });
        if (error) console.error("Could not mark a calendar reminder as sent.", error);
      }
    }
    return respond({ sent, failed, expired });
  } catch (error) {
    console.error("Scheduled reminders failed.", error);
    return respond({ error: "Could not send scheduled reminders." }, 500);
  }
});
