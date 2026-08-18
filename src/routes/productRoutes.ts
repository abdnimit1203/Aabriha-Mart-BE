import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
} from "../controllers/productController";

export const productRoutes = Router();

// Public: storefront browsing.
productRoutes.get("/", listProducts);
productRoutes.get("/:id", getProduct);

productRoutes.post("/", requireAuth, requireRole("super_admin"), createProduct);
productRoutes.patch("/:id", requireAuth, requireRole("super_admin"), updateProduct);
productRoutes.delete("/:id", requireAuth, requireRole("super_admin"), deleteProduct);

// Order Manager can adjust stock, but not create/edit/delete products.
productRoutes.post("/:id/stock", requireAuth, requireRole("super_admin", "order_manager"), adjustStock);
