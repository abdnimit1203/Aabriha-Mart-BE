import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  listProducts,
  getProduct,
  getPopularProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
} from "../controllers/productController";

export const productRoutes = Router();

// Public: storefront browsing. /popular must come before the /:id catch-all.
productRoutes.get("/", listProducts);
productRoutes.get("/popular", getPopularProducts);
productRoutes.get("/:id", getProduct);

productRoutes.post("/", requireAuth, requireRole("super_admin"), createProduct);
productRoutes.patch("/:id", requireAuth, requireRole("super_admin"), updateProduct);
productRoutes.delete("/:id", requireAuth, requireRole("super_admin"), deleteProduct);

// Order Manager can adjust stock, but not create/edit/delete products.
productRoutes.post("/:id/stock", requireAuth, requireRole("super_admin", "order_manager"), adjustStock);
