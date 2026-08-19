import { Response } from "express";
import { Order, PaymentMethod } from "../models/Order";
import { User, IAddress } from "../models/User";
import { HttpError } from "../middleware/errorHandler";
import { AuthedRequest } from "../middleware/auth";
import { stripe } from "../config/stripe";
import { computeCheckoutPricing, decrementStockForItems, CheckoutItemInput } from "../services/checkoutPricing";

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
  await User.findByIdAndUpdate(req.userId, { defaultAddress: address });

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
