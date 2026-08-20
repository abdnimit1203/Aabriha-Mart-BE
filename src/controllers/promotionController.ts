import { Request, Response } from "express";
import { Promotion } from "../models/Promotion";
import { HttpError } from "../middleware/errorHandler";

export async function listPromotions(req: Request, res: Response) {
  const promotions = await Promotion.find().sort({ sortOrder: 1 });
  res.json(promotions);
}

export async function createPromotion(req: Request, res: Response) {
  const promotion = await Promotion.create(req.body);
  res.status(201).json(promotion);
}

export async function updatePromotion(req: Request, res: Response) {
  const promotion = await Promotion.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!promotion) throw new HttpError(404, "Promotion not found.");
  res.json(promotion);
}

export async function deletePromotion(req: Request, res: Response) {
  const promotion = await Promotion.findByIdAndDelete(req.params.id);
  if (!promotion) throw new HttpError(404, "Promotion not found.");
  res.status(204).send();
}
