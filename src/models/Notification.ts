import { Schema, model, Types } from "mongoose";
import { AdminRole } from "./User";

export type NotificationType =
  | "new_order"
  | "payment_submitted"
  | "order_cancelled"
  | "return_event"
  | "low_stock"
  | "out_of_stock"
  | "order_status_attention"; // reserved for future use — nothing triggers this yet

export interface INotification {
  type: NotificationType;
  title: string;
  message: string;
  // Which admin role(s) can see this — a small-team broadcast model (read
  // state is shared across everyone with that role, not tracked per admin
  // account). Matches this project's scale; revisit only if multiple admins
  // sharing one role ever need independent read tracking.
  targetRoles: AdminRole[];
  relatedOrder?: Types.ObjectId;
  relatedProduct?: Types.ObjectId;
  actionUrl?: string;
  read: boolean;
}

const notificationSchema = new Schema<INotification>(
  {
    type: {
      type: String,
      enum: [
        "new_order",
        "payment_submitted",
        "order_cancelled",
        "return_event",
        "low_stock",
        "out_of_stock",
        "order_status_attention",
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    targetRoles: { type: [String], enum: ["super_admin", "order_manager"], required: true },
    relatedOrder: { type: Schema.Types.ObjectId, ref: "Order" },
    relatedProduct: { type: Schema.Types.ObjectId, ref: "Product" },
    actionUrl: { type: String },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Serves both the dashboard feed query (role + unread-first, newest-first)
// and the retention sweep (read + createdAt).
notificationSchema.index({ targetRoles: 1, read: 1, createdAt: -1 });

export const Notification = model<INotification>("Notification", notificationSchema);
