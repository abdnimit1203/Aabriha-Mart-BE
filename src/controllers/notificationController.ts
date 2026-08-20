import { Response } from "express";
import { Notification } from "../models/Notification";
import { AdminRole } from "../models/User";
import { AuthedRequest } from "../middleware/auth";
import { HttpError } from "../middleware/errorHandler";

const FEED_LIMIT = 30;

// req.userRole is guaranteed to be an AdminRole here — every route on this
// controller sits behind requireRole("super_admin", "order_manager").
function adminRole(req: AuthedRequest): AdminRole {
  return req.userRole as AdminRole;
}

export async function listNotifications(req: AuthedRequest, res: Response) {
  const role = adminRole(req);
  const filter = { targetRoles: role };

  const [notifications, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(FEED_LIMIT),
    Notification.countDocuments({ ...filter, read: false }),
  ]);

  res.json({ notifications, unreadCount });
}

export async function markNotificationRead(req: AuthedRequest, res: Response) {
  const role = adminRole(req);
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, targetRoles: role },
    { read: true },
    { new: true }
  );
  if (!notification) throw new HttpError(404, "Notification not found.");
  res.json(notification);
}

export async function markAllNotificationsRead(req: AuthedRequest, res: Response) {
  const role = adminRole(req);
  await Notification.updateMany({ targetRoles: role, read: false }, { read: true });
  res.json({ success: true });
}
