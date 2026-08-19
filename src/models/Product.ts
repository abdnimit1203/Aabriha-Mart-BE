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
