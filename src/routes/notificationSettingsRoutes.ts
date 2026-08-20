import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  getNotificationSettings,
  updateNotificationSettings,
  sendTestTelegramNotification,
} from "../controllers/notificationSettingsController";

export const notificationSettingsRoutes = Router();

// Super Admin only, unlike the notification feed itself — this is
// business/payment-adjacent configuration, not an operations task.
notificationSettingsRoutes.use(requireAuth, requireRole("super_admin"));

notificationSettingsRoutes.get("/", getNotificationSettings);
notificationSettingsRoutes.put("/", updateNotificationSettings);
notificationSettingsRoutes.post("/test-telegram", sendTestTelegramNotification);
