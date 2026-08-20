import { Schema, model } from "mongoose";

// Title/description are optional: a self-contained promo flyer (text baked
// into the artwork) needs no overlay at all — the frontend only renders text
// on top of the image when these are actually filled in.
export interface IPromotion {
  image: string;
  mobileImage?: string;
  titleBn?: string;
  titleEn?: string;
  descriptionBn?: string;
  descriptionEn?: string;
  ctaLabelBn?: string;
  ctaLabelEn?: string;
  ctaUrl: string;
  isActive: boolean;
  sortOrder: number;
  startDate?: Date;
  endDate?: Date;
}

const promotionSchema = new Schema<IPromotion>(
  {
    image: { type: String, required: true },
    mobileImage: { type: String },
    titleBn: { type: String },
    titleEn: { type: String },
    descriptionBn: { type: String },
    descriptionEn: { type: String },
    ctaLabelBn: { type: String },
    ctaLabelEn: { type: String },
    ctaUrl: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    startDate: { type: Date },
    endDate: { type: Date },
  },
  { timestamps: true }
);

promotionSchema.index({ isActive: 1, sortOrder: 1 });

export const Promotion = model<IPromotion>("Promotion", promotionSchema);
