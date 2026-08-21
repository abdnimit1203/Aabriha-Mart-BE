import { Types } from "mongoose";
import { Notification, NotificationType } from "../../models/Notification";
import { AdminRole } from "../../models/User";
import { IOrder } from "../../models/Order";
import { IProduct, IVariant, stockCrossingLevel } from "../../models/Product";

interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  targetRoles: AdminRole[];
  relatedOrder?: string;
  relatedProduct?: string;
  actionUrl?: string;
}

const RETENTION_DAYS = 30;

// Unbounded growth guard: read notifications older than the retention
// window get swept away. Only a small fraction of creates trigger the sweep
// (a delete query on every single insert would be wasteful) — unread
// notifications are never touched by this, so nothing important is lost
// while waiting for the next sweep to happen to run.
function maybePurgeOldRead(): void {
  if (Math.random() > 0.05) return;
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  Notification.deleteMany({ read: true, createdAt: { $lt: cutoff } }).catch((err) =>
    console.error("[notifications] retention cleanup failed:", err)
  );
}

// The single entry point every business event goes through to reach the
// dashboard channel. Never throws — a notification failing to write must
// never take down the business action that triggered it (order creation,
// stock decrement, etc.), so callers can safely fire this without awaiting
// or catching.
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    await Notification.create(input);
    maybePurgeOldRead();
  } catch (err) {
    console.error("[notifications] failed to create notification:", input.type, err);
  }
}

const ADMIN_ROLES: AdminRole[] = ["super_admin", "order_manager"];

function orderCode(order: IOrder & { _id: unknown }): string {
  return String(order._id).slice(-8).toUpperCase();
}

export function notifyNewOrder(order: IOrder & { _id: Types.ObjectId }): Promise<void> {
  return createNotification({
    type: "new_order",
    title: "New order placed",
    message: `Order #${orderCode(order)} — ৳${order.total.toLocaleString()} (${order.items.length} item${order.items.length !== 1 ? "s" : ""})`,
    targetRoles: ADMIN_ROLES,
    relatedOrder: String(order._id),
    actionUrl: `/admin/orders/${order._id}`,
  });
}

export function notifyPaymentSubmitted(order: IOrder & { _id: Types.ObjectId }): Promise<void> {
  const label = order.paymentMethod === "bkash" ? "bKash" : "Nagad";
  return createNotification({
    type: "payment_submitted",
    title: `${label} payment submitted`,
    message: `Order #${orderCode(order)} — transaction ID submitted, needs verification.`,
    targetRoles: ADMIN_ROLES,
    relatedOrder: String(order._id),
    actionUrl: `/admin/orders/${order._id}`,
  });
}

export function notifyOrderCancelled(order: IOrder & { _id: Types.ObjectId }): Promise<void> {
  return createNotification({
    type: "order_cancelled",
    title: "Order cancelled",
    message: `Order #${orderCode(order)} was cancelled.`,
    targetRoles: ADMIN_ROLES,
    relatedOrder: String(order._id),
    actionUrl: `/admin/orders/${order._id}`,
  });
}

export function notifyOrderReturned(order: IOrder & { _id: Types.ObjectId }): Promise<void> {
  return createNotification({
    type: "return_event",
    title: "Order returned",
    message: `Order #${orderCode(order)} was marked returned.`,
    targetRoles: ADMIN_ROLES,
    relatedOrder: String(order._id),
    actionUrl: `/admin/orders/${order._id}`,
  });
}

function variantLabel(variant?: IVariant): string {
  if (!variant) return "";
  const attrs = Object.values(variant.attributes ?? {}).filter(Boolean).join(" • ");
  return attrs ? ` (${attrs})` : "";
}

export function notifyLowStock(product: IProduct & { _id: Types.ObjectId }, variant: IVariant | undefined, stock: number): Promise<void> {
  return createNotification({
    type: "low_stock",
    title: "Low stock",
    message: `${product.name}${variantLabel(variant)} — only ${stock} left.`,
    targetRoles: ADMIN_ROLES,
    relatedProduct: String(product._id),
    actionUrl: `/admin/products/${product._id}/edit`,
  });
}

export function notifyOutOfStock(product: IProduct & { _id: Types.ObjectId }, variant: IVariant | undefined): Promise<void> {
  return createNotification({
    type: "out_of_stock",
    title: "Out of stock",
    message: `${product.name}${variantLabel(variant)} is now out of stock.`,
    targetRoles: ADMIN_ROLES,
    relatedProduct: String(product._id),
    actionUrl: `/admin/products/${product._id}/edit`,
  });
}

// The single seam every stock mutator calls through after mutating —
// order-driven decrement (checkoutPricing.ts) and admin manual adjustment
// (productController.ts's adjustStock) both go through this, so "does this
// change warrant a notification" has exactly one answer regardless of which
// caller changed the number. Never throws (createNotification already
// swallows its own failures); safe to call without awaiting or catching.
export async function notifyStockCrossing(
  product: IProduct & { _id: Types.ObjectId },
  variant: IVariant | undefined,
  priorStock: number,
  newStock: number
): Promise<void> {
  const level = stockCrossingLevel(priorStock, newStock);
  if (level === "out_of_stock") {
    await notifyOutOfStock(product, variant);
  } else if (level === "low_stock") {
    await notifyLowStock(product, variant, newStock);
  }
}
