import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { getAnalytics } from "../controllers/analyticsController";

export const analyticsRoutes = Router();

// Super Admin only — a store-wide performance report isn't something an
// Order Manager needs, matching the Customers section's access level.
analyticsRoutes.use(requireAuth, requireRole("super_admin"));

analyticsRoutes.get("/", getAnalytics);
