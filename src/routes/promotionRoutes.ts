import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { listPromotions, createPromotion, updatePromotion, deletePromotion } from "../controllers/promotionController";

export const promotionRoutes = Router();

promotionRoutes.get("/", listPromotions);

promotionRoutes.post("/", requireAuth, requireRole("super_admin"), createPromotion);
promotionRoutes.patch("/:id", requireAuth, requireRole("super_admin"), updatePromotion);
promotionRoutes.delete("/:id", requireAuth, requireRole("super_admin"), deletePromotion);
