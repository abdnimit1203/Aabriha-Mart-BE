import { Response } from "express";
import { Types } from "mongoose";
import { Order, OrderStatus, PaymentMethod, PaymentStatus, NEXT_STATUSES } from "../models/Order";
import { User, IAddress } from "../models/User";
import { HttpError } from "../middleware/errorHandler";
import { AuthedRequest } from "../middleware/auth";
import { stripe } from "../config/stripe";
import {
  computeCheckoutPricing,
  decrementStockForItems,
  restoreStockForItems,
  CheckoutItemInput,
} from "../services/checkoutPricing";
import { notifyNewOrder, notifyPaymentSubmitted, notifyOrderCancelled, notifyOrderReturned } from "../services/notifications/notificationService";
import { sendNewOrderTelegramAlert } from "../services/notifications/telegramService";

interface CheckoutBody {
  items: CheckoutItemInput[];
  address: IAddress;
}

function requireAddress(address: unknown): IAddress {
  const a = address as Partial<IAddress> | undefined;
  if (!a?.division || !a.district || !a.area || !a.detailedAddress) {
    throw new HttpError(400, "A complete delivery address is required.");
  }
  return a as IAddress;
}

export async function getCheckoutSummary(req: AuthedRequest, res: Response) {
  const { items, address } = req.body as CheckoutBody;
  const pricing = await computeCheckoutPricing(items, requireAddress(address).district);
  res.json(pricing);
}

export async function createStripeIntent(req: AuthedRequest, res: Response) {
  const { items, address } = req.body as CheckoutBody;
  const pricing = await computeCheckoutPricing(items, requireAddress(address).district);

  // Stripe doesn't support BDT as a charge currency, so the test-mode charge
  // is placed in USD using the same numeric amount as the ৳ total — a
  // stand-in, not a real conversion. Revisit once actually going live.
  const intent = await stripe.paymentIntents.create({
    amount: Math.round(pricing.total * 100),
    currency: "usd",
    payment_method_types: ["card"],
    metadata: { userId: String(req.userId) },
  });

  res.json({ ...pricing, clientSecret: intent.client_secret });
}

interface CreateOrderBody extends CheckoutBody {
  phone: string;
  paymentMethod: PaymentMethod;
  transactionId?: string; // bKash/Nagad manual reference
  paymentIntentId?: string; // Stripe
}

export async function createOrder(req: AuthedRequest, res: Response) {
  const { items, address: rawAddress, phone, paymentMethod, transactionId, paymentIntentId } = req.body as CreateOrderBody;
  const address = requireAddress(rawAddress);

  if (!phone) throw new HttpError(400, "A phone number is required.");

  const pricing = await computeCheckoutPricing(items, address.district);

  let paymentStatus: "unpaid" | "pending_verification" | "paid" = "unpaid";
  let stripePaymentIntentId: string | undefined;

  if (paymentMethod === "bkash" || paymentMethod === "nagad") {
    if (!transactionId) throw new HttpError(400, "Enter the transaction ID from your payment.");
    paymentStatus = "pending_verification";
  } else if (paymentMethod === "stripe") {
    if (!paymentIntentId) throw new HttpError(400, "Missing payment confirmation.");
    // Never trust the client's claim that payment succeeded — re-fetch the
    // PaymentIntent from Stripe and check it ourselves, amount included, so
    // a tampered request can't create a "paid" order for less than it owes.
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== "succeeded") {
      throw new HttpError(402, "Payment has not been completed.");
    }
    if (intent.amount !== Math.round(pricing.total * 100)) {
      throw new HttpError(409, "Payment amount does not match the current order total.");
    }
    paymentStatus = "paid";
    stripePaymentIntentId = paymentIntentId;
  }

  const order = await Order.create({
    customer: req.userId,
    items: pricing.items,
    phone,
    deliveryAddress: address,
    deliveryZone: pricing.deliveryZone,
    subtotal: pricing.subtotal,
    deliveryCharge: pricing.deliveryCharge,
    total: pricing.total,
    paymentMethod,
    paymentStatus,
    paymentTransactionId: transactionId,
    stripePaymentIntentId,
  });

  await decrementStockForItems(pricing.items);
  const customer = await User.findByIdAndUpdate(req.userId, { defaultAddress: address }, { new: false }).select("username");

  // Notifications are a side effect of a successfully created order — never
  // let a failure here (Mongo hiccup, Telegram down, etc.) affect the
  // customer-facing response, which has already succeeded at this point.
  notifyNewOrder(order).catch((err) => console.error("[notifications] new order:", err));
  if (paymentMethod === "bkash" || paymentMethod === "nagad") {
    notifyPaymentSubmitted(order).catch((err) => console.error("[notifications] payment submitted:", err));
  }
  sendNewOrderTelegramAlert(order, customer?.username ?? "Customer").catch((err) =>
    console.error("[telegram] new order:", err)
  );

  res.status(201).json(order);
}

export async function getOrder(req: AuthedRequest, res: Response) {
  const order = await Order.findOne({ _id: req.params.id, customer: req.userId });
  if (!order) throw new HttpError(404, "Order not found.");
  res.json(order);
}

export async function listMyOrders(req: AuthedRequest, res: Response) {
  const orders = await Order.find({ customer: req.userId }).sort({ createdAt: -1 }).limit(50);
  res.json({ orders });
}

// A cancelled/returned order already had stock decremented at creation — flag
// which statuses represent that "stock is out" state so a status transition
// can tell whether it's restoring stock for the first time or not.
const RESTOCKING_STATUSES: OrderStatus[] = ["cancelled", "returned"];

export async function listAllOrders(req: AuthedRequest, res: Response) {
  const { status, paymentStatus, source, deliveryZone, dateFrom, dateTo, search, page = "1", limit = "20" } =
    req.query as Record<string, string>;

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (source) filter.source = source;
  if (deliveryZone) filter.deliveryZone = deliveryZone;
  if (dateFrom || dateTo) {
    const createdAt: Record<string, Date> = {};
    if (dateFrom) createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      // Treat dateTo as inclusive of the whole day, not just its midnight instant.
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      createdAt.$lte = end;
    }
    filter.createdAt = createdAt;
  }
  if (search) {
    const or: Record<string, unknown>[] = [{ phone: { $regex: search, $options: "i" } }];
    if (Types.ObjectId.isValid(search)) or.push({ _id: search });
    filter.$or = or;
  }

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));
  const skip = (pageNum - 1) * limitNum;

  const total = await Order.countDocuments(filter);
  const orders = await Order.find(filter)
    .populate("customer", "username email phone")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  res.json({ orders, total, page: pageNum, limit: limitNum });
}

export async function getOrderAdmin(req: AuthedRequest, res: Response) {
  const order = await Order.findById(req.params.id).populate("customer", "username email phone");
  if (!order) throw new HttpError(404, "Order not found.");
  res.json(order);
}

export async function updateOrderStatus(req: AuthedRequest, res: Response) {
  const { status } = req.body as { status: OrderStatus };
  const order = await Order.findById(req.params.id);
  if (!order) throw new HttpError(404, "Order not found.");

  if (status !== order.status && !NEXT_STATUSES[order.status].includes(status)) {
    throw new HttpError(400, `Cannot move an order from "${order.status}" to "${status}".`);
  }

  // Restore stock only on the transition into a restocking status — moving
  // between cancelled and returned (both already restocked) must not
  // double-credit inventory.
  if (RESTOCKING_STATUSES.includes(status) && !RESTOCKING_STATUSES.includes(order.status)) {
    await restoreStockForItems(order.items);
  }

  order.status = status;
  await order.save();

  if (status === "cancelled") notifyOrderCancelled(order).catch((err) => console.error("[notifications] cancelled:", err));
  if (status === "returned") notifyOrderReturned(order).catch((err) => console.error("[notifications] returned:", err));

  res.json(order);
}

export async function updateOrderPayment(req: AuthedRequest, res: Response) {
  const { paymentStatus, refundAmount, refundReference } = req.body as {
    paymentStatus: PaymentStatus;
    refundAmount?: number;
    refundReference?: string;
  };
  const order = await Order.findById(req.params.id);
  if (!order) throw new HttpError(404, "Order not found.");

  order.paymentStatus = paymentStatus;
  if (paymentStatus === "refunded") {
    order.refundAmount = refundAmount;
    order.refundReference = refundReference;
  }
  await order.save();
  res.json(order);
}
