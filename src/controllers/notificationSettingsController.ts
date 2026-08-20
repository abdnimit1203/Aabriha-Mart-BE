import { Response } from "express";
import { NotificationSettings, INotificationSettings } from "../models/NotificationSettings";
import { AuthedRequest } from "../middleware/auth";
import { sendTelegramMessage, recordTelegramAttempt } from "../services/notifications/telegramService";

// The only fields ever returned to the client. The bot token is a
// server-only env secret and is never part of this model or this response —
// there is nothing here to accidentally leak even if this function is
// changed carelessly later.
function toSafeSettings(doc: Partial<INotificationSettings> | null) {
  return {
    telegramEnabled: doc?.telegramEnabled ?? false,
    telegramChatId: doc?.telegramChatId ?? "",
    telegramLastNotifiedAt: doc?.telegramLastNotifiedAt ?? null,
    telegramLastError: doc?.telegramLastError ?? null,
  };
}

export async function getNotificationSettings(req: AuthedRequest, res: Response) {
  const settings = await NotificationSettings.findOne({});
  res.json(toSafeSettings(settings));
}

export async function updateNotificationSettings(req: AuthedRequest, res: Response) {
  const { telegramEnabled, telegramChatId } = req.body as { telegramEnabled?: boolean; telegramChatId?: string };
  const settings = await NotificationSettings.findOneAndUpdate(
    {},
    {
      telegramEnabled: Boolean(telegramEnabled),
      telegramChatId: String(telegramChatId ?? "").trim(),
    },
    { new: true, upsert: true, runValidators: true }
  );
  res.json(toSafeSettings(settings));
}

// Sends regardless of the enabled toggle (using the currently saved chat
// ID) — "test" implies verifying the setup works, which is exactly what
// someone wants to do before flipping it on.
export async function sendTestTelegramNotification(req: AuthedRequest, res: Response) {
  const settings = await NotificationSettings.findOne({});
  const result = await sendTelegramMessage(
    "✅ *Test notification*\n\nThis is a test alert from your Aabriha Mart admin dashboard.",
    settings?.telegramChatId ?? ""
  );
  await recordTelegramAttempt(result);
  res.json(result);
}
