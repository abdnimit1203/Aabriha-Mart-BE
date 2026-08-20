import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { getAnnouncement, updateAnnouncement, getWelcomePopup, updateWelcomePopup } from "../controllers/storefrontConfigController";

export const announcementRoutes = Router();
announcementRoutes.get("/", getAnnouncement);
announcementRoutes.put("/", requireAuth, requireRole("super_admin"), updateAnnouncement);

export const welcomePopupRoutes = Router();
welcomePopupRoutes.get("/", getWelcomePopup);
welcomePopupRoutes.put("/", requireAuth, requireRole("super_admin"), updateWelcomePopup);
