import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { listCustomers, listModerators, updateUserRole } from "../controllers/userController";

export const userRoutes = Router();

// Customer/staff management is Super Admin only — Order Manager has no
// access, same stricter rule as the Storefront CMS section.
userRoutes.use(requireAuth, requireRole("super_admin"));

userRoutes.get("/customers", listCustomers);
userRoutes.get("/moderators", listModerators);
userRoutes.patch("/:id/role", updateUserRole);
