import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { listNotifications, markNotificationRead, markAllNotificationsRead } from "../controllers/notificationController";

export const notificationRoutes = Router();

// Both admin roles see the dashboard notification feed — Order Manager gets
// order/inventory notifications only via targetRoles filtering inside the
// controller, not via a route-level restriction.
notificationRoutes.use(requireAuth, requireRole("super_admin", "order_manager"));

notificationRoutes.get("/", listNotifications);
notificationRoutes.patch("/:id/read", markNotificationRead);
notificationRoutes.post("/mark-all-read", markAllNotificationsRead);
