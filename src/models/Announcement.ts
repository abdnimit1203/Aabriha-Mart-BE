import { Schema, model } from "mongoose";

// Singleton config: exactly one document, read/written via findOne({}) +
// upsert in the controller — no unique key needed since there's only ever
// one. New pattern for this codebase (DeliveryRate is "one doc per fixed
// key," not a true singleton); kept intentionally simple, no settings
// key/value table.
export interface IAnnouncement {
  enabled: boolean;
  messageBn: string;
  messageEn: string;
  url?: string;
  linkLabel?: string;
  marquee: boolean;
}

const announcementSchema = new Schema<IAnnouncement>(
  {
    enabled: { type: Boolean, default: false },
    messageBn: { type: String, default: "" },
    messageEn: { type: String, default: "" },
    url: { type: String },
    linkLabel: { type: String },
    marquee: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Announcement = model<IAnnouncement>("Announcement", announcementSchema);
