import { Types } from "mongoose";
import { Product, IVariant } from "../models/Product";
import { DeliveryRate, DeliveryZone, calculateDeliveryCharge } from "../models/DeliveryRate";
import { IOrderItem } from "../models/Order";
import { HttpError } from "../middleware/errorHandler";

export interface CheckoutItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface CheckoutPricing {
  items: IOrderItem[];
  subtotal: number;
  deliveryZone: DeliveryZone;
  deliveryCharge: number;
  total: number;
}

// Matches ProductPurchasePanel's "on sale" rule on the frontend — the price
// a customer is charged must be the same one they saw on the product page.
function effectiveUnitPrice(price: number | undefined, discountPrice: number | undefined): number {
  if (price === undefined) return 0;
  return discountPrice !== undefined && discountPrice < price ? discountPrice : price;
}

// Same zone rule the checkout summary and order creation both need — Dhaka
// district specifically, not the wider Dhaka division (which also covers
// Gazipur, Narayanganj, etc., not metro-fast delivery in practice).
export function deliveryZoneForDistrict(district: string): DeliveryZone {
  return district === "Dhaka" ? "inside_dhaka" : "outside_dhaka";
}

// The one place a cart is turned into priced, weighed, stock-checked order
// lines — never trust unitPrice/weight/name from the client. Used by the
// checkout summary, the Stripe intent step, and order creation itself, so
// all three price a cart identically.
export async function computeCheckoutPricing(
  itemInputs: CheckoutItemInput[],
  district: string
): Promise<CheckoutPricing> {
  if (itemInputs.length === 0) throw new HttpError(400, "Your cart is empty.");

  const productIds = [...new Set(itemInputs.map((i) => i.productId))].filter((id) => Types.ObjectId.isValid(id));
  const products = await Product.find({ _id: { $in: productIds }, status: "active" });
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const items: IOrderItem[] = itemInputs.map((input) => {
    const product = byId.get(input.productId);
    if (!product) throw new HttpError(400, "A product in your cart is no longer available.");

    let variant: IVariant | undefined;
    if (input.variantId) {
      variant = product.variants.find((v) => String(v._id) === input.variantId);
      if (!variant || variant.status !== "active") {
        throw new HttpError(400, `A variant of "${product.name}" is no longer available.`);
      }
    }

    const stock = variant ? variant.stock : (product.stock ?? 0);
    if (input.quantity > stock) {
      throw new HttpError(409, `Only ${stock} of "${product.name}" left in stock.`);
    }

    return {
      product: product._id,
      variantId: variant?._id,
      nameSnapshot: product.name,
      attributesSnapshot: variant?.attributes ?? {},
      unitPrice: effectiveUnitPrice(variant ? variant.price : product.price, variant ? variant.discountPrice : product.discountPrice),
      quantity: input.quantity,
      weightGrams: variant?.weightGrams ?? product.weightGrams,
    };
  });

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const totalWeightGrams = items.reduce((sum, i) => sum + i.weightGrams * i.quantity, 0);
  const deliveryZone = deliveryZoneForDistrict(district);

  const rate = await DeliveryRate.findOne({ zone: deliveryZone });
  if (!rate) throw new HttpError(500, "Delivery rates are not configured.");
  const deliveryCharge = calculateDeliveryCharge(rate, totalWeightGrams);

  return { items, subtotal, deliveryZone, deliveryCharge, total: subtotal + deliveryCharge };
}

// Decrements stock for every line in an already-priced order. Assumes
// computeCheckoutPricing already confirmed enough stock exists — a tiny
// TOCTOU race remains between pricing and this call (no reservation system),
// accepted for the same reason generateUniqueUsername's race is: a small,
// single-seller catalog, not a high-concurrency marketplace.
export async function decrementStockForItems(items: IOrderItem[]): Promise<void> {
  for (const item of items) {
    if (item.variantId) {
      await Product.updateOne(
        { _id: item.product, "variants._id": item.variantId },
        { $inc: { "variants.$.stock": -item.quantity } }
      );
    } else {
      await Product.updateOne({ _id: item.product }, { $inc: { stock: -item.quantity } });
    }
  }
}
