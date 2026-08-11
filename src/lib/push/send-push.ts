import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserSettings } from "@/lib/supabase/database.types";

type NotificationType = keyof UserSettings["notification_prefs"];

export async function sendPushToUsers(opts: {
  recipientIds: string[];
  excludeUserId: string;
  type: NotificationType;
  title: string;
  body: string;
  url: string;
}) {
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) return { sent: 0 };

  webpush.setVapidDetails("mailto:support@reinchat.app", vapidPublic, vapidPrivate);

  const admin = createAdminClient();
  const targets = opts.recipientIds.filter((id) => id !== opts.excludeUserId);
  if (targets.length === 0) return { sent: 0 };

  const { data: settings } = await admin.from("user_settings").select("user_id, notification_prefs").in("user_id", targets);
  const optedOut = new Set((settings ?? []).filter((s) => s.notification_prefs?.[opts.type] === false).map((s) => s.user_id));
  const finalTargets = targets.filter((id) => !optedOut.has(id));
  if (finalTargets.length === 0) return { sent: 0 };

  const { data: subscriptions } = await admin.from("push_subscriptions").select("*").in("user_id", finalTargets);

  let sent = 0;
  await Promise.all(
    (subscriptions ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          JSON.stringify({ title: opts.title, body: opts.body, url: opts.url })
        );
        sent += 1;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    })
  );

  return { sent };
}
