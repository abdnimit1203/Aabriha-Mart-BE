import { Response } from "express";
import { Order, OrderStatus } from "../models/Order";
import { Product, NEEDS_ATTENTION_FILTER } from "../models/Product";
import { AuthedRequest } from "../middleware/auth";
import { dhakaDateKey, startOfDhakaDay, DHAKA_TIMEZONE } from "../lib/dhakaDate";

// The real pipeline, in order — mirrors NEXT_STATUSES' linear chain
// (Order.ts). cancelled/returned are terminal side-branches, not part of
// this sequence, and are reported separately rather than folded in.
const PIPELINE_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
];
const ALL_STATUSES: OrderStatus[] = [...PIPELINE_STATUSES, "cancelled", "returned"];

const TREND_DAYS = 7;

// The four numbers the Dashboard page's own placeholder already promised:
// today's orders, today's revenue, and a low-stock alert count — plus
// pending orders, the other thing an admin actually needs to act on first
// thing. Reuses NEEDS_ATTENTION_FILTER (the same filter the Inventory
// list's default view runs) rather than a second definition of "low stock."
// Also reports a full order-status breakdown and a 7-day orders/revenue
// trend — both read-only aggregate reports, not new business rules.
export async function getDashboardSummary(req: AuthedRequest, res: Response) {
  const startOfToday = startOfDhakaDay(new Date());

  const trendStart = new Date(startOfToday);
  trendStart.setDate(trendStart.getDate() - (TREND_DAYS - 1));

  const [todayAgg, pendingOrders, needsAttentionCount, statusAgg, trendAgg, totalProducts, totalOrders] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: { $gte: startOfToday } } },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: "$total" } } },
    ]),
    Order.countDocuments({ status: "pending" }),
    Product.countDocuments({ $or: NEEDS_ATTENTION_FILTER.$or }),
    Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { createdAt: { $gte: trendStart } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: DHAKA_TIMEZONE } },
          orders: { $sum: 1 },
          revenue: { $sum: "$total" },
        },
      },
    ]),
    // Whole-catalog/lifetime counts — every product regardless of
    // active/inactive status, every order regardless of status, since these
    // answer "how big is the catalog / how many orders has the store ever
    // gotten," not "what's customer-visible right now."
    Product.countDocuments({}),
    Order.countDocuments({}),
  ]);

  const today = todayAgg[0] ?? { count: 0, revenue: 0 };

  const statusCounts = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  for (const row of statusAgg as { _id: OrderStatus; count: number }[]) {
    if (row._id in statusCounts) statusCounts[row._id] = row.count;
  }

  const trendByDate = new Map(
    (trendAgg as { _id: string; orders: number; revenue: number }[]).map((row) => [row._id, row])
  );
  const last7Days = Array.from({ length: TREND_DAYS }, (_, i) => {
    const date = new Date(trendStart);
    date.setDate(date.getDate() + i);
    const key = dhakaDateKey(date);
    const row = trendByDate.get(key);
    return { date: key, orders: row?.orders ?? 0, revenue: row?.revenue ?? 0 };
  });

  res.json({
    todayOrders: today.count as number,
    todayRevenue: today.revenue as number,
    pendingOrders,
    needsAttentionCount,
    totalProducts,
    totalOrders,
    statusCounts,
    last7Days,
  });
}
