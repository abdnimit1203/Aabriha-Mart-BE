import { Request, Response } from "express";
import { Types } from "mongoose";
import {
  Product,
  IVariant,
  MAX_IMAGES,
  EFFECTIVE_PRICE_EXPR,
  IN_STOCK_FILTER,
  ON_SALE_FILTER,
  NEEDS_ATTENTION_FILTER,
  OUT_OF_STOCK_FILTER,
} from "../models/Product";
import { HttpError } from "../middleware/errorHandler";
import { notifyStockCrossing } from "../services/notifications/notificationService";
import { Order } from "../models/Order";

type SortOption = "newest" | "price_asc" | "price_desc";

function isObjectId(value: string): boolean {
  return Types.ObjectId.isValid(value);
}

export async function listProducts(req: Request, res: Response) {
  const { category, status, search, inStock, onSale, stockStatus, sort = "newest", page = "1", limit = "20" } = req.query as Record<
    string,
    string
  >;

  const filter: Record<string, unknown> = {};
  // Comma-separated ids so a parent category page can include its children's products.
  // Cast to ObjectId explicitly — .aggregate() below skips Mongoose's automatic
  // query casting that .find() does, so raw id strings would silently match nothing.
  if (category) {
    const ids = category
      .split(",")
      .filter((id) => isObjectId(id))
      .map((id) => new Types.ObjectId(id));
    if (ids.length > 0) {
      filter.category = ids.length > 1 ? { $in: ids } : ids[0];
    }
  }
  if (status) filter.status = status;
  if (search) filter.name = { $regex: search, $options: "i" };
  if (inStock === "true") {
    filter.$or = IN_STOCK_FILTER.$or;
  }
  if (onSale === "true") {
    filter.$expr = ON_SALE_FILTER.$expr;
  }
  // Admin Inventory list only — the storefront never passes this, so there's
  // no real risk of colliding with inStock's $or above in practice.
  if (stockStatus === "needs_attention") {
    filter.$or = NEEDS_ATTENTION_FILTER.$or;
  } else if (stockStatus === "out") {
    filter.$nor = OUT_OF_STOCK_FILTER.$nor;
  }

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));
  const skip = (pageNum - 1) * limitNum;
  const sortOption = sort as SortOption;

  const total = await Product.countDocuments(filter);

  let products;
  if (sortOption === "price_asc" || sortOption === "price_desc") {
    // Price lives on the product (simple products) or is the min across
    // variants (variant products) — not sortable with a plain find().sort(),
    // so compute it and order by it via aggregation, then re-fetch the
    // populated documents in that same order.
    const direction = sortOption === "price_asc" ? 1 : -1;
    const ordered = await Product.aggregate([
      { $match: filter },
      { $addFields: { effectivePrice: EFFECTIVE_PRICE_EXPR } },
      { $sort: { effectivePrice: direction } },
      { $skip: skip },
      { $limit: limitNum },
      { $project: { _id: 1 } },
    ]);

    const orderedIds = ordered.map((doc) => doc._id);
    const docs = await Product.find({ _id: { $in: orderedIds } }).populate("category", "name slug");
    const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
    products = orderedIds.map((id) => byId.get(String(id))).filter(Boolean);
  } else {
    products = await Product.find(filter)
      .populate("category", "name slug")
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });
  }

  res.json({ products, total, page: pageNum, limit: limitNum });
}

// Ranked by real units sold (summed across each order's line items), not a
// fake "featured" flag or an arbitrary limit — the only honest definition of
// "popular" this app has data for. Cancelled orders never fulfilled, so they
// don't count as demand; a returned order still shipped once, so it does.
// Products with zero sales history are simply absent from the ranking
// (never backfilled with unrelated products) — an empty result is a valid,
// expected answer for a brand-new catalog.
export async function getPopularProducts(req: Request, res: Response) {
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 8));

  const ranked = await Order.aggregate([
    { $match: { status: { $ne: "cancelled" } } },
    { $unwind: "$items" },
    { $group: { _id: "$items.product", unitsSold: { $sum: "$items.quantity" } } },
    { $sort: { unitsSold: -1 } },
    { $limit: limit * 2 }, // headroom for ids whose product was since deactivated/deleted
  ]);

  const rankedIds = ranked.map((r) => r._id);
  const products = await Product.find({ _id: { $in: rankedIds }, status: "active" }).populate("category", "name slug");
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const ordered = rankedIds.map((id) => byId.get(String(id))).filter(Boolean).slice(0, limit);

  res.json({ products: ordered });
}

export async function getProduct(req: Request, res: Response) {
  const id = String(req.params.id);
  const query = isObjectId(id) ? { _id: id } : { slug: id };
  const product = await Product.findOne(query).populate("category", "name slug");
  if (!product) throw new HttpError(404, "Product not found.");
  res.json(product);
}

export async function createProduct(req: Request, res: Response) {
  if (req.body.images?.length > MAX_IMAGES) {
    throw new HttpError(400, `A product cannot have more than ${MAX_IMAGES} images.`);
  }
  const product = await Product.create(req.body);
  res.status(201).json(product);
}

export async function updateProduct(req: Request, res: Response) {
  if (req.body.images?.length > MAX_IMAGES) {
    throw new HttpError(400, `A product cannot have more than ${MAX_IMAGES} images.`);
  }
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!product) throw new HttpError(404, "Product not found.");
  res.json(product);
}

export async function deleteProduct(req: Request, res: Response) {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new HttpError(404, "Product not found.");
  res.status(204).send();
}

export async function adjustStock(req: Request, res: Response) {
  const { variantId, delta } = req.body as { variantId?: string; delta: number };
  const product = await Product.findById(req.params.id);
  if (!product) throw new HttpError(404, "Product not found.");

  let variant: IVariant | undefined;
  let priorStock: number;
  let newStock: number;

  if (variantId) {
    variant = product.variants.find((v) => String(v._id) === variantId);
    if (!variant) throw new HttpError(404, "Variant not found.");
    priorStock = variant.stock;
    variant.stock = Math.max(0, variant.stock + delta);
    newStock = variant.stock;
  } else {
    priorStock = product.stock ?? 0;
    product.stock = Math.max(0, priorStock + delta);
    newStock = product.stock;
  }

  await product.save();

  // Same notification seam order-driven decrements use (checkoutPricing.ts)
  // — a manual correction that crosses a threshold notifies exactly like an
  // order would, without duplicating the crossing rule here.
  notifyStockCrossing(product, variant, priorStock, newStock).catch((err) =>
    console.error("[notifications] stock threshold check failed:", err)
  );

  res.json(product);
}
