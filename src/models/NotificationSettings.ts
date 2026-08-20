import { Schema, model } from "mongoose";

// Singleton config, same pattern as Announcement/WelcomePopup — exactly one
// document, read/written via findOne({}) + upsert. The Telegram BOT TOKEN is
// never stored here (or anywhere in Mongo) — it's a server-only secret that
// lives in an environment variable (see config/env.ts). Only the recipient
// chat ID and the on/off toggle are admin-configurable through this model.
export interface INotificationSettings {
  telegramEnabled: boolean;
  telegramChatId: string;
  // Status of the most recent send attempt (test or real), for the settings
  // page's status line — not a full log, just "is this currently working."
  telegramLastNotifiedAt?: Date;
  telegramLastError?: string;
}

const notificationSettingsSchema = new Schema<INotificationSettings>(
  {
    telegramEnabled: { type: Boolean, default: false },
    telegramChatId: { type: String, default: "" },
    telegramLastNotifiedAt: { type: Date },
    telegramLastError: { type: String },
  },
  { timestamps: true }
);

export const NotificationSettings = model<INotificationSettings>("NotificationSettings", notificationSettingsSchema);
