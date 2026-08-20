import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { listHeroBanners, createHeroBanner, updateHeroBanner, deleteHeroBanner } from "../controllers/heroBannerController";

export const heroBannerRoutes = Router();

heroBannerRoutes.get("/", listHeroBanners);

heroBannerRoutes.post("/", requireAuth, requireRole("super_admin"), createHeroBanner);
heroBannerRoutes.patch("/:id", requireAuth, requireRole("super_admin"), updateHeroBanner);
heroBannerRoutes.delete("/:id", requireAuth, requireRole("super_admin"), deleteHeroBanner);
