import { Schema, model, Types } from "mongoose";
import { IAddress } from "./User";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "returned";

export type PaymentMethod = "cod" | "bkash" | "nagad" | "stripe";
export type PaymentStatus = "unpaid" | "pending_verification" | "paid" | "refunded";
export type OrderSource = "website" | "facebook" | "manual" | "other";

// Orders ship (shipped/out_for_delivery/delivered/returned) can no longer be cancelled.
export const CANCELLABLE_STATUSES: OrderStatus[] = ["pending", "confirmed", "processing", "packed"];

// The single source of truth for which status an order can move to next —
// enforced server-side in updateOrderStatus, and mirrored on the frontend
// only to decide which actions to render. Cancellation disappears once an
// order has shipped; Return takes its place. cancelled/returned are terminal.
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["out_for_delivery", "returned"],
  out_for_delivery: ["delivered", "returned"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};

export interface IOrderItem {
  product: Types.ObjectId;
  variantId?: Types.ObjectId;
  nameSnapshot: string;
  attributesSnapshot: Record<string, string>;
  unitPrice: number;
  quantity: number;
  weightGrams: number;
}

export interface IOrder {
  customer: Types.ObjectId;
  items: IOrderItem[];
  phone: string; // re-confirmed at checkout regardless of profile
  deliveryAddress: IAddress;
  deliveryZone: "inside_dhaka" | "outside_dhaka";
  subtotal: number;
  discount: number;
  deliveryCharge: number; // auto-computed, admin-overridable
  total: number;
  status: OrderStatus;
  source: OrderSource;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentTransactionId?: string; // bKash/Nagad manual reference
  stripePaymentIntentId?: string;
  refundAmount?: number;
  refundReference?: string;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: Schema.Types.ObjectId },
    nameSnapshot: { type: String, required: true },
    attributesSnapshot: { type: Schema.Types.Mixed, default: {} },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    weightGrams: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const addressSchema = new Schema<IAddress>(
  {
    division: { type: String, required: true },
    district: { type: String, required: true },
    area: { type: String, required: true },
    detailedAddress: { type: String, required: true },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [orderItemSchema], required: true, validate: (v: unknown[]) => v.length > 0 },
    phone: { type: String, required: true },
    deliveryAddress: { type: addressSchema, required: true },
    deliveryZone: { type: String, enum: ["inside_dhaka", "outside_dhaka"], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    deliveryCharge: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["pending", "confirmed", "processing", "packed", "shipped", "out_for_delivery", "delivered", "cancelled", "returned"],
      default: "pending",
    },
    source: { type: String, enum: ["website", "facebook", "manual", "other"], default: "website" },
    paymentMethod: { type: String, enum: ["cod", "bkash", "nagad", "stripe"], required: true },
    paymentStatus: { type: String, enum: ["unpaid", "pending_verification", "paid", "refunded"], default: "unpaid" },
    paymentTransactionId: { type: String },
    stripePaymentIntentId: { type: String },
    refundAmount: { type: Number, min: 0 },
    refundReference: { type: String },
  },
  { timestamps: true }
);

orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ status: 1 });

export const Order = model<IOrder>("Order", orderSchema);
