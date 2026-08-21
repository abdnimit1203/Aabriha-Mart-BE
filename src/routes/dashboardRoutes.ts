import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { getDashboardSummary } from "../controllers/dashboardController";

export const dashboardRoutes = Router();

// Same access as the Dashboard nav item itself — both admin roles.
dashboardRoutes.use(requireAuth, requireRole("super_admin", "order_manager"));

dashboardRoutes.get("/summary", getDashboardSummary);
