import { Schema, model } from "mongoose";

export type DeliveryZone = "inside_dhaka" | "outside_dhaka";

export interface IDeliveryRate {
  zone: DeliveryZone;
  baseCharge: number; // covers up to thresholdGrams
  thresholdGrams: number;
  perKgCharge: number; // charged per additional kg beyond the threshold
}

const deliveryRateSchema = new Schema<IDeliveryRate>(
  {
    zone: { type: String, enum: ["inside_dhaka", "outside_dhaka"], required: true, unique: true },
    baseCharge: { type: Number, required: true, min: 0 },
    thresholdGrams: { type: Number, required: true, min: 0, default: 1000 },
    perKgCharge: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

export const DeliveryRate = model<IDeliveryRate>("DeliveryRate", deliveryRateSchema);

export function calculateDeliveryCharge(rate: IDeliveryRate, totalWeightGrams: number): number {
  const extraGrams = Math.max(0, totalWeightGrams - rate.thresholdGrams);
  const extraKg = Math.ceil(extraGrams / 1000);
  return rate.baseCharge + extraKg * rate.perKgCharge;
}
