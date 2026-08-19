import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { getCheckoutSummary, createStripeIntent, createOrder, getOrder, listMyOrders } from "../controllers/orderController";

export const orderRoutes = Router();

// Account required to place an order (Section 18) — every route here needs a signed-in customer.
orderRoutes.use(requireAuth);

orderRoutes.post("/summary", getCheckoutSummary);
orderRoutes.post("/stripe/intent", createStripeIntent);
orderRoutes.post("/", createOrder);
orderRoutes.get("/", listMyOrders);
orderRoutes.get("/:id", getOrder);
