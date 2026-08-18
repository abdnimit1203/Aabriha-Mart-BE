import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { listCategories, createCategory, updateCategory, deleteCategory } from "../controllers/categoryController";

export const categoryRoutes = Router();

// Public: storefront needs to read categories without being logged in.
categoryRoutes.get("/", listCategories);

categoryRoutes.post("/", requireAuth, requireRole("super_admin"), createCategory);
categoryRoutes.patch("/:id", requireAuth, requireRole("super_admin"), updateCategory);
categoryRoutes.delete("/:id", requireAuth, requireRole("super_admin"), deleteCategory);
