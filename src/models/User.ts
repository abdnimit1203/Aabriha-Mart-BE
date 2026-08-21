import { Schema, model } from "mongoose";

export type AdminRole = "super_admin" | "order_manager";

export interface IAddress {
  division: string;
  district: string;
  area: string;
  detailedAddress: string;
}

export interface IUser {
  firebaseUid: string;
  username: string;
  email: string;
  emailVerified: boolean;
  // Collected at signup for email/password accounts; Google sign-in defers
  // it to a follow-up profile step. Not SMS-verified either way — checkout
  // always re-collects and re-confirms the phone number regardless.
  phone: string;
  profileImage?: string;
  defaultAddress?: IAddress;
  role: "customer" | AdminRole;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<IAddress>(
  {
    division: { type: String, required: true },
    district: { type: String, required: true },
    area: { type: String, required: true },
    detailedAddress: { type: String, required: true },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    firebaseUid: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    emailVerified: { type: Boolean, default: false },
    phone: { type: String, default: "" },
    profileImage: { type: String },
    defaultAddress: { type: addressSchema },
    role: { type: String, enum: ["customer", "super_admin", "order_manager"], default: "customer" },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const User = model<IUser>("User", userSchema);
