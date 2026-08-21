import { Request, Response } from "express";
import { Announcement } from "../models/Announcement";
import { WelcomePopup } from "../models/WelcomePopup";

// Both configs are singletons — findOne({}) treats "no document yet" as the
// default-disabled state; the upsert on write creates the one-and-only
// document the first time an admin saves settings.

export async function getAnnouncement(req: Request, res: Response) {
  const announcement = (await Announcement.findOne({})) ?? { enabled: false };
  res.json(announcement);
}

export async function updateAnnouncement(req: Request, res: Response) {
  const announcement = await Announcement.findOneAndUpdate({}, req.body, {
    new: true,
    upsert: true,
    runValidators: true,
  });
  res.json(announcement);
}

export async function getWelcomePopup(req: Request, res: Response) {
  const popup = (await WelcomePopup.findOne({})) ?? { enabled: false, image: "", ctaUrl: "" };
  res.json(popup);
}

export async function updateWelcomePopup(req: Request, res: Response) {
  const popup = await WelcomePopup.findOneAndUpdate({}, req.body, {
    new: true,
    upsert: true,
    runValidators: true,
  });
  res.json(popup);
}
