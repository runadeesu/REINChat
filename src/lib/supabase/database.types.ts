// Hand-written to match supabase/migrations/0001_init.sql and 0002_storage.sql.
// Once the project is connected to a live Supabase instance, this can be
// regenerated exactly with `supabase gen types typescript`.

export type ConversationType = "direct" | "group";
export type MemberRole = "owner" | "admin" | "member";
export type MessageType = "text" | "image" | "video" | "audio" | "file" | "sticker" | "system";
export type FriendRequestStatus = "pending" | "accepted" | "rejected" | "cancelled";
export type CallType = "audio" | "video";
export type CallStatus = "ringing" | "active" | "ended" | "missed" | "declined";

export interface Profile {
  id: string;
  display_id: string;
  display_name: string;
  bio: string | null;
  status_message: string | null;
  avatar_url: string | null;
  background_url: string | null;
  last_online_at: string;
  is_online: boolean;
  is_suspended: boolean;
  suspended_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: FriendRequestStatus;
  created_at: string;
  updated_at: string;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  created_at: string;
}

export interface BlockRow {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null;
  avatar_url: string | null;
  description: string | null;
  announcement: string | null;
  invite_code: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
  last_read_at: string;
  is_muted: boolean;
  is_pinned: boolean;
  is_archived: boolean;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  type: MessageType;
  content: string | null;
  sticker_id: string | null;
  reply_to_id: string | null;
  forwarded_from_id: string | null;
  is_pinned: boolean;
  pinned_at: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface Attachment {
  id: string;
  message_id: string;
  url: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  filename: string | null;
  created_at: string;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface StickerPack {
  id: string;
  name: string;
  cover_url: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Sticker {
  id: string;
  pack_id: string;
  name: string;
  image_url: string;
  sort_order: number;
}

export interface Call {
  id: string;
  conversation_id: string;
  type: CallType;
  status: CallStatus;
  started_by: string;
  started_at: string;
  ended_at: string | null;
}

export interface CallParticipant {
  id: string;
  call_id: string;
  user_id: string;
  joined_at: string | null;
  left_at: string | null;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface UserSettings {
  user_id: string;
  theme: "system" | "light" | "dark";
  notification_prefs: { messages: boolean; friend_requests: boolean; calls: boolean };
  updated_at: string;
}

export interface Announcement {
  id: string;
  message: string;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  status: string;
  created_at: string;
}
