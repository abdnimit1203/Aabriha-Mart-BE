import { Request, Response } from "express";
import { Category } from "../models/Category";
import { HttpError } from "../middleware/errorHandler";

export async function listCategories(req: Request, res: Response) {
  const categories = await Category.find().sort({ sortOrder: 1, name: 1 });
  res.json(categories);
}

export async function createCategory(req: Request, res: Response) {
  const { name, slug, parent, image, sortOrder } = req.body;
  const category = await Category.create({ name, slug, parent: parent || null, image, sortOrder });
  res.status(201).json(category);
}

export async function updateCategory(req: Request, res: Response) {
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!category) throw new HttpError(404, "Category not found.");
  res.json(category);
}

export async function deleteCategory(req: Request, res: Response) {
  const hasChildren = await Category.exists({ parent: req.params.id });
  if (hasChildren) {
    throw new HttpError(400, "Cannot delete a category that has subcategories.");
  }
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw new HttpError(404, "Category not found.");
  res.status(204).send();
}
