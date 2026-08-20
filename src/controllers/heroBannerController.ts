import { Request, Response } from "express";
import { HeroBanner } from "../models/HeroBanner";
import { HttpError } from "../middleware/errorHandler";

export async function listHeroBanners(req: Request, res: Response) {
  const banners = await HeroBanner.find().sort({ sortOrder: 1 });
  res.json(banners);
}

export async function createHeroBanner(req: Request, res: Response) {
  const banner = await HeroBanner.create(req.body);
  res.status(201).json(banner);
}

export async function updateHeroBanner(req: Request, res: Response) {
  const banner = await HeroBanner.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!banner) throw new HttpError(404, "Hero banner not found.");
  res.json(banner);
}

export async function deleteHeroBanner(req: Request, res: Response) {
  const banner = await HeroBanner.findByIdAndDelete(req.params.id);
  if (!banner) throw new HttpError(404, "Hero banner not found.");
  res.status(204).send();
}
