import { Schema, model } from "mongoose";

// Bn fields are captured but unused by the storefront until it gets a real
// locale switch — same convention as the frontend's HeroSlider Banner type,
// which this schema mirrors 1:1 so the fetch can be a drop-in for the
// hardcoded array it replaces.
export interface IHeroBanner {
  titleBn: string;
  titleEn: string;
  subtitleBn: string;
  subtitleEn: string;
  ctaLabelBn: string;
  ctaLabelEn: string;
  ctaUrl: string;
  desktopImage: string;
  mobileImage?: string;
  objectPosition?: string;
  isActive: boolean;
  sortOrder: number;
}

const heroBannerSchema = new Schema<IHeroBanner>(
  {
    titleBn: { type: String, required: true, trim: true },
    titleEn: { type: String, required: true, trim: true },
    subtitleBn: { type: String, default: "" },
    subtitleEn: { type: String, default: "" },
    ctaLabelBn: { type: String, default: "" },
    ctaLabelEn: { type: String, default: "" },
    ctaUrl: { type: String, required: true },
    desktopImage: { type: String, required: true },
    mobileImage: { type: String },
    objectPosition: { type: String },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

heroBannerSchema.index({ isActive: 1, sortOrder: 1 });

export const HeroBanner = model<IHeroBanner>("HeroBanner", heroBannerSchema);
