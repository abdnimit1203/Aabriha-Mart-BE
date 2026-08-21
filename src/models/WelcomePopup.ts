import { Schema, model } from "mongoose";

// Singleton config — same pattern as Announcement.ts (findOne({}) + upsert).
// Image-only by design: no title/description/CTA-label fields — the image
// itself is the whole popup, and ctaUrl (if set) just makes the image a link.
export interface IWelcomePopup {
  enabled: boolean;
  image: string;
  ctaUrl: string;
}

const welcomePopupSchema = new Schema<IWelcomePopup>(
  {
    enabled: { type: Boolean, default: false },
    image: { type: String, default: "" },
    ctaUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

export const WelcomePopup = model<IWelcomePopup>("WelcomePopup", welcomePopupSchema);
