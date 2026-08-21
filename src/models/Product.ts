import { Schema, model, Types } from "mongoose";

export const MAX_IMAGES = 6;

export interface IProductImage {
  url: string;
  alt?: string;
}

export interface IVariant {
  _id?: Types.ObjectId;
  sku: string;
  attributes: Record<string, string>; // e.g. { color: "Black", size: "M" }
  price: number;
  discountPrice?: number;
  stock: number;
  weightGrams?: number; // falls back to product.weightGrams when unset
  images: IProductImage[];
  status: "active" | "inactive";
}

export interface IProduct {
  name: string;
  slug: string;
  category: Types.ObjectId;
  description?: string;
  images: IProductImage[]; // max 6, gallery + variant images combined
  weightGrams: number; // default weight used by variants/simple product
  attributeNames: string[]; // e.g. ["color", "size"] — drives variant selector UI
  variants: IVariant[]; // empty array => simple product, use price/discount/stock below
  price?: number; // simple-product price, used when variants is empty
  discountPrice?: number;
  stock?: number;
  status: "active" | "inactive";
  ratingAverage: number;
  ratingCount: number;
}

const productImageSchema = new Schema<IProductImage>(
  {
    url: { type: String, required: true },
    alt: { type: String },
  },
  { _id: false }
);

const variantSchema = new Schema<IVariant>(
  {
    sku: { type: String, required: true, unique: true, trim: true },
    attributes: { type: Schema.Types.Mixed, default: {} },
    price: { type: Number, required: true, min: 0 },
    discountPrice: { type: Number, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    weightGrams: { type: Number, min: 0 },
    images: { type: [productImageSchema], default: [] },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { _id: true }
);

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    description: { type: String },
    images: {
      type: [productImageSchema],
      default: [],
      validate: {
        validator: (images: IProductImage[]) => images.length <= MAX_IMAGES,
        message: `A product cannot have more than ${MAX_IMAGES} images.`,
      },
    },
    weightGrams: { type: Number, required: true, min: 0 },
    attributeNames: { type: [String], default: [] },
    variants: { type: [variantSchema], default: [] },
    price: { type: Number, min: 0 },
    discountPrice: { type: Number, min: 0 },
    stock: { type: Number, min: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productSchema.index({ category: 1, status: 1 });
productSchema.index({ name: "text", description: "text" });

export const Product = model<IProduct>("Product", productSchema);

// A product's price is either its own `price` (simple product) or the
// cheapest variant (variant product) — never both. "In stock" follows the
// same split. These are the one place that rule is defined: a pure-function
// form for documents already in hand, and the equivalent Mongo expressions
// for use inside aggregation pipelines/query filters, so a query and an
// in-memory check can never drift apart.
export function getEffectivePrice(product: Pick<IProduct, "price" | "variants">): number {
  if (product.variants.length > 0) {
    return Math.min(...product.variants.map((v) => v.price));
  }
  return product.price ?? 0;
}

export function isProductInStock(product: Pick<IProduct, "stock" | "variants">): boolean {
  if (product.variants.length > 0) {
    return product.variants.some((v) => v.stock > 0);
  }
  return (product.stock ?? 0) > 0;
}

export const EFFECTIVE_PRICE_EXPR = {
  $cond: [{ $gt: [{ $size: { $ifNull: ["$variants", []] } }, 0] }, { $min: "$variants.price" }, "$price"],
};

export const IN_STOCK_FILTER = { $or: [{ stock: { $gt: 0 } }, { "variants.stock": { $gt: 0 } }] };

// Shared with the admin Inventory list's default filter and the low-stock
// notification's crossing-check (checkoutPricing.ts), so both always agree
// on what "low" means. Not admin-configurable — nothing has asked for that yet.
export const LOW_STOCK_THRESHOLD = 5;

// A product "needs attention" if any of its sellable units (root stock for a
// simple product, or any variant) is at or below the threshold — including
// zero. A field left unset (e.g. a variant product's root `stock`) never
// matches a $lte comparison in Mongo, so this doesn't false-positive on the
// side that doesn't apply to a given product shape.
export const NEEDS_ATTENTION_FILTER = {
  $or: [{ stock: { $lte: LOW_STOCK_THRESHOLD } }, { "variants.stock": { $lte: LOW_STOCK_THRESHOLD } }],
};

// The exact negation of IN_STOCK_FILTER — a product is out of stock only
// when neither its root stock nor any variant has any left.
export const OUT_OF_STOCK_FILTER = { $nor: [{ stock: { $gt: 0 } }, { "variants.stock": { $gt: 0 } }] };

export type StockCrossingLevel = "out_of_stock" | "low_stock" | null;

// Pure decision, no I/O: did a stock change cross *downward* through a
// threshold? Only downward crossings matter — restocking back up (or
// staying within the same band across repeated edits) is never itself
// cause for an alert, which is what keeps this from re-firing on every
// subsequent sale while a product is already low. This is the one
// definition of "does this stock change warrant a notification," used by
// every stock mutator (order-driven decrement, admin manual adjustment)
// via notifyStockCrossing (services/notifications/notificationService.ts)
// — so a new mutator gets the right behavior automatically instead of
// needing to remember to wire it in.
export function stockCrossingLevel(priorStock: number, newStock: number): StockCrossingLevel {
  if (newStock <= 0 && priorStock > 0) return "out_of_stock";
  if (newStock > 0 && newStock <= LOW_STOCK_THRESHOLD && priorStock > LOW_STOCK_THRESHOLD) return "low_stock";
  return null;
}

// "On sale" means discountPrice is set and actually less than price — at the
// product level for simple products, or on any variant for variant products.
// Needs $expr (comparing two fields of the same document/subdocument), which
// Mongo supports directly in find() queries, not just aggregation.
// $ifNull (not $ne-against-null) on purpose: a missing discountPrice field
// doesn't reliably compare equal to a literal null inside $map/$let scope,
// so substitute price itself when discountPrice is absent — that collapses
// the comparison to price > price (false), which is what "no discount" means.
// The product-level branch is guarded to simple products (empty variants)
// specifically: for a variant product, top-level price AND discountPrice are
// both genuinely missing, so $ifNull cascades all the way to null on both
// sides — and BSON orders null below any number, so an unguarded $gt would
// wrongly read every variant product as "on sale".
export const ON_SALE_FILTER = {
  $expr: {
    $or: [
      {
        $and: [
          { $eq: [{ $size: { $ifNull: ["$variants", []] } }, 0] },
          { $gt: [{ $ifNull: ["$price", 0] }, { $ifNull: ["$discountPrice", "$price"] }] },
        ],
      },
      {
        $anyElementTrue: {
          $map: {
            input: { $ifNull: ["$variants", []] },
            as: "v",
            in: { $gt: [{ $ifNull: ["$$v.price", 0] }, { $ifNull: ["$$v.discountPrice", "$$v.price"] }] },
          },
        },
      },
    ],
  },
};
