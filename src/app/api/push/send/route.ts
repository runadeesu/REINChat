import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUsers } from "@/lib/push/send-push";

// Called by client-side code (e.g. after sending a message) to notify the
// other participants. Auth just confirms the caller is a signed-in
// REINChat user — sendPushToUsers itself checks each recipient's real
// notification_prefs before delivering anything.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { recipientIds, type, title, body: message, url } = body as {
    recipientIds?: string[];
    type?: "messages" | "friend_requests" | "calls";
    title?: string;
    body?: string;
    url?: string;
  };

  if (!Array.isArray(recipientIds) || recipientIds.length === 0 || !type || !title || !message || !url) {
    return NextResponse.json({ error: "入力が正しくありません" }, { status: 400 });
  }

  const result = await sendPushToUsers({ recipientIds, excludeUserId: user.id, type, title, body: message, url });
  return NextResponse.json(result);
}
