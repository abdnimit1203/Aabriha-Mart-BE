import { Schema, model } from "mongoose";

// Singleton config — same pattern as Announcement.ts (findOne({}) + upsert).
export interface IWelcomePopup {
  enabled: boolean;
  image: string;
  titleBn: string;
  titleEn: string;
  descriptionBn: string;
  descriptionEn: string;
  ctaLabel: string;
  ctaUrl: string;
}

const welcomePopupSchema = new Schema<IWelcomePopup>(
  {
    enabled: { type: Boolean, default: false },
    image: { type: String, default: "" },
    titleBn: { type: String, default: "" },
    titleEn: { type: String, default: "" },
    descriptionBn: { type: String, default: "" },
    descriptionEn: { type: String, default: "" },
    ctaLabel: { type: String, default: "" },
    ctaUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

export const WelcomePopup = model<IWelcomePopup>("WelcomePopup", welcomePopupSchema);
