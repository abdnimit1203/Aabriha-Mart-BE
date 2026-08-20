import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  getCheckoutSummary,
  createStripeIntent,
  createOrder,
  getOrder,
  listMyOrders,
  listAllOrders,
  getOrderAdmin,
  updateOrderStatus,
  updateOrderPayment,
} from "../controllers/orderController";

export const orderRoutes = Router();

// Account required to place an order (Section 18) — every route here needs a signed-in customer.
orderRoutes.use(requireAuth);

// Admin routes first: "/admin" would otherwise be captured by the customer-
// scoped "/:id" below (Express matches route patterns in registration order).
const requireOrderStaff = requireRole("super_admin", "order_manager");
orderRoutes.get("/admin", requireOrderStaff, listAllOrders);
orderRoutes.get("/admin/:id", requireOrderStaff, getOrderAdmin);
orderRoutes.patch("/admin/:id/status", requireOrderStaff, updateOrderStatus);
orderRoutes.patch("/admin/:id/payment", requireOrderStaff, updateOrderPayment);

orderRoutes.post("/summary", getCheckoutSummary);
orderRoutes.post("/stripe/intent", createStripeIntent);
orderRoutes.post("/", createOrder);
orderRoutes.get("/", listMyOrders);
orderRoutes.get("/:id", getOrder);
