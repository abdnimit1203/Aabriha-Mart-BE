import { Response } from "express";
import { Types } from "mongoose";
import { User } from "../models/User";
import { Order } from "../models/Order";
import { AuthedRequest } from "../middleware/auth";
import { HttpError } from "../middleware/errorHandler";

export async function listCustomers(req: AuthedRequest, res: Response) {
  const { search, page = "1", limit = "20" } = req.query as Record<string, string>;

  const filter: Record<string, unknown> = { role: "customer", isDeleted: false };
  if (search) {
    const or: Record<string, unknown>[] = [
      { username: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
    if (Types.ObjectId.isValid(search)) or.push({ _id: search });
    filter.$or = or;
  }

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));
  const skip = (pageNum - 1) * limitNum;

  const total = await User.countDocuments(filter);
  const customers = await User.find(filter)
    .select("username email phone profileImage createdAt")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  // Order count/lifetime spend read from real Order history rather than a
  // duplicated counter on User — always current, no separate write path to
  // keep in sync. Cancelled orders never shipped, so they don't count as spend.
  const customerIds = customers.map((c) => c._id);
  const stats = await Order.aggregate([
    { $match: { customer: { $in: customerIds }, status: { $ne: "cancelled" } } },
    {
      $group: {
        _id: "$customer",
        orderCount: { $sum: 1 },
        lifetimeSpend: { $sum: "$total" },
        lastOrderAt: { $max: "$createdAt" },
      },
    },
  ]);
  const statsById = new Map(stats.map((s) => [String(s._id), s]));

  const result = customers.map((c) => {
    const s = statsById.get(String(c._id));
    return {
      _id: c._id,
      username: c.username,
      email: c.email,
      phone: c.phone,
      profileImage: c.profileImage,
      createdAt: c.createdAt,
      orderCount: s?.orderCount ?? 0,
      lifetimeSpend: s?.lifetimeSpend ?? 0,
      lastOrderAt: s?.lastOrderAt ?? null,
    };
  });

  res.json({ customers: result, total, page: pageNum, limit: limitNum });
}

export async function listModerators(req: AuthedRequest, res: Response) {
  const moderators = await User.find({ role: { $in: ["super_admin", "order_manager"] }, isDeleted: false })
    .select("username email phone role createdAt")
    .sort({ createdAt: -1 });
  res.json({ moderators });
}

const ASSIGNABLE_ROLES = ["customer", "order_manager", "super_admin"];

// Symmetric endpoint for both directions (promote a customer to staff, demote
// staff back to customer, or change staff role) — one seam instead of two
// near-identical routes. Blocking self-changes is the whole safety story: as
// long as a super_admin can never touch their own role, and the very first
// super_admin was created by the promoteAdmin script (never via this API),
// the app can never be left with zero super admins.
export async function updateUserRole(req: AuthedRequest, res: Response) {
  const { role } = req.body as { role?: string };
  if (!role || !ASSIGNABLE_ROLES.includes(role)) {
    throw new HttpError(400, `role must be one of: ${ASSIGNABLE_ROLES.join(", ")}.`);
  }
  if (req.params.id === req.userId) {
    throw new HttpError(400, "You cannot change your own role.");
  }

  const user = await User.findOneAndUpdate({ _id: req.params.id, isDeleted: false }, { role }, { new: true }).select(
    "username email phone role createdAt"
  );
  if (!user) throw new HttpError(404, "User not found.");

  res.json(user);
}
