import { Request, Response } from "express";
import { Product } from "../models/Product";
import { HttpError } from "../middleware/errorHandler";

const MAX_IMAGES = 6;

export async function listProducts(req: Request, res: Response) {
  const { category, status, search, page = "1", limit = "20" } = req.query as Record<string, string>;

  const filter: Record<string, unknown> = {};
  if (category) filter.category = category;
  if (status) filter.status = status;
  if (search) filter.$text = { $search: search };

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate("category", "name slug")
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .sort({ createdAt: -1 }),
    Product.countDocuments(filter),
  ]);

  res.json({ products, total, page: pageNum, limit: limitNum });
}

export async function getProduct(req: Request, res: Response) {
  const product = await Product.findById(req.params.id).populate("category", "name slug");
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

  if (variantId) {
    const variant = product.variants.find((v) => String(v._id) === variantId);
    if (!variant) throw new HttpError(404, "Variant not found.");
    variant.stock = Math.max(0, variant.stock + delta);
  } else {
    product.stock = Math.max(0, (product.stock ?? 0) + delta);
  }

  await product.save();
  res.json(product);
}
