import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
  displayName: z.string().min(1, "表示名を入力してください").max(50),
});

export const loginSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
});

export const profileUpdateSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  displayId: z
    .string()
    .min(3, "IDは3文字以上で入力してください")
    .max(30, "IDは30文字以内で入力してください")
    .regex(/^[a-zA-Z0-9_.]+$/, "IDは半角英数字・アンダースコア・ピリオドのみ使用できます")
    .optional(),
  bio: z.string().max(200).optional().nullable(),
  statusMessage: z.string().max(60).optional().nullable(),
});

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1).max(4000).optional(),
  type: z.enum(["text", "image", "video", "audio", "file", "sticker"]).default("text"),
  replyToId: z.string().uuid().optional().nullable(),
  stickerId: z.string().uuid().optional(),
});

export const createGroupSchema = z.object({
  name: z.string().min(1, "グループ名を入力してください").max(60),
  memberIds: z.array(z.string().uuid()).min(1, "メンバーを1人以上選んでください"),
});
