import { Response } from "express";
import { Order, OrderStatus } from "../models/Order";
import { Product } from "../models/Product";
import { AuthedRequest } from "../middleware/auth";
import { dhakaDateKey, startOfDhakaDay, DHAKA_TIMEZONE } from "../lib/dhakaDate";

const ALLOWED_RANGE_DAYS = [7, 30, 90];
const DEFAULT_RANGE_DAYS = 30;
const TOP_PRODUCTS_LIMIT = 6;

const ALL_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
];

// Midnight-Dhaka instant for the 1st of `year`-`month` (1-indexed). Noon UTC
// on day 1 is safely inside that Dhaka calendar day regardless of which way
// the +6 shift moves it, so startOfDhakaDay always lands on the right day.
function startOfDhakaMonth(year: number, month: number): Date {
  return startOfDhakaDay(new Date(Date.UTC(year, month - 1, 1, 12)));
}

function daysBetween(start: Date, endExclusive: Date): number {
  return Math.round((endExclusive.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

interface ResolvedRange {
  rangeStart: Date;
  rangeEndExclusive: Date | null; // null = open-ended, up to now (the existing 7/30/90 behavior)
  days: number;
  responseMeta: { range: "days" | "month"; days: number; month?: number; year?: number };
}

// Two ways to ask for a window: a rolling N-day count ending today (existing
// 7/30/90 behavior, unchanged), or one specific Bangladesh calendar month.
// Both resolve to the same {rangeStart, rangeEndExclusive, days} shape so
// every aggregation below stays a single code path regardless of mode.
function resolveRange(req: AuthedRequest): ResolvedRange {
  const rangeParam = req.query.range === "month" ? "month" : "days";

  if (rangeParam === "month") {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    const validMonth = Number.isInteger(month) && month >= 1 && month <= 12;
    const validYear = Number.isInteger(year) && year >= 2000 && year <= 2100;

    if (validMonth && validYear) {
      const rangeStart = startOfDhakaMonth(year, month);
      const rangeEndExclusive = month === 12 ? startOfDhakaMonth(year + 1, 1) : startOfDhakaMonth(year, month + 1);
      // A future month has no orders yet, but is still a valid selection —
      // clamp the exclusive end to "now" so the trend array doesn't extend
      // past today for the current month, matching how 7/30/90 behaves.
      const now = new Date();
      const clampedEnd = rangeEndExclusive > now ? now : rangeEndExclusive;
      const days = Math.max(1, daysBetween(rangeStart, rangeEndExclusive));
      return {
        rangeStart,
        rangeEndExclusive: clampedEnd,
        days,
        responseMeta: { range: "month", days, month, year },
      };
    }
    // Invalid month/year falls back to the default days-mode below, same as
    // an invalid `days` value already does.
  }

  const requestedDays = Number(req.query.days);
  const days = ALLOWED_RANGE_DAYS.includes(requestedDays) ? requestedDays : DEFAULT_RANGE_DAYS;
  const rangeStart = new Date(startOfDhakaDay(new Date()));
  rangeStart.setDate(rangeStart.getDate() - (days - 1));
  return { rangeStart, rangeEndExclusive: null, days, responseMeta: { range: "days", days } };
}

// A store-wide performance report over a selectable window — revenue/orders
// trend, top sellers, a status breakdown, and a new-vs-returning customer
// split. All read from real Order/Product data; nothing here is a fabricated
// metric. Cancelled orders never shipped, so (mirroring getPopularProducts
// and getDashboardSummary) they're excluded from revenue/units/customer
// figures but still counted in the status breakdown, which is meant to show
// the honest full picture of what happened to every order in the window.
export async function getAnalytics(req: AuthedRequest, res: Response) {
  const { rangeStart, rangeEndExclusive, days, responseMeta } = resolveRange(req);

  const createdAtMatch: Record<string, Date> = { $gte: rangeStart };
  if (rangeEndExclusive) createdAtMatch.$lt = rangeEndExclusive;

  const rangeMatch = { createdAt: createdAtMatch, status: { $ne: "cancelled" as OrderStatus } };

  const [summaryAgg, trendAgg, statusAgg, topProductsAgg, customersInRange] = await Promise.all([
    Order.aggregate([{ $match: rangeMatch }, { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: "$total" } } }]),
    Order.aggregate([
      { $match: rangeMatch },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: DHAKA_TIMEZONE } },
          orders: { $sum: 1 },
          revenue: { $sum: "$total" },
        },
      },
    ]),
    Order.aggregate([{ $match: { createdAt: createdAtMatch } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: rangeMatch },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          unitsSold: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.unitPrice", "$items.quantity"] } },
        },
      },
      { $sort: { unitsSold: -1 } },
      { $limit: TOP_PRODUCTS_LIMIT },
    ]),
    Order.distinct("customer", rangeMatch),
  ]);

  const summary = (summaryAgg[0] as { orders: number; revenue: number } | undefined) ?? { orders: 0, revenue: 0 };

  const trendByDate = new Map((trendAgg as { _id: string; orders: number; revenue: number }[]).map((r) => [r._id, r]));
  const trend = Array.from({ length: days }, (_, i) => {
    const date = new Date(rangeStart);
    date.setDate(date.getDate() + i);
    const key = dhakaDateKey(date);
    const row = trendByDate.get(key);
    return { date: key, orders: row?.orders ?? 0, revenue: row?.revenue ?? 0 };
  });

  const statusCounts = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  for (const row of statusAgg as { _id: OrderStatus; count: number }[]) {
    if (row._id in statusCounts) statusCounts[row._id] = row.count;
  }

  const productIds = (topProductsAgg as { _id: unknown }[]).map((r) => r._id);
  const products = await Product.find({ _id: { $in: productIds } }).select("name slug images");
  const productById = new Map(products.map((p) => [String(p._id), p]));
  const topProducts = (topProductsAgg as { _id: unknown; unitsSold: number; revenue: number }[])
    .map((r) => {
      const product = productById.get(String(r._id));
      if (!product) return null;
      return {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        image: product.images[0]?.url ?? null,
        unitsSold: r.unitsSold,
        revenue: r.revenue,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  // New = this customer's first-ever order (across all history, not just
  // this window) falls inside the selected range. Returning = they'd
  // already ordered before the range started. Real data, not a guess.
  let newCustomers = 0;
  let returningCustomers = 0;
  if (customersInRange.length > 0) {
    const firstOrderAgg = await Order.aggregate([
      { $match: { customer: { $in: customersInRange }, status: { $ne: "cancelled" } } },
      { $group: { _id: "$customer", firstOrderAt: { $min: "$createdAt" } } },
    ]);
    for (const row of firstOrderAgg as { firstOrderAt: Date }[]) {
      if (row.firstOrderAt >= rangeStart) newCustomers++;
      else returningCustomers++;
    }
  }

  res.json({
    ...responseMeta,
    summary: {
      orders: summary.orders,
      revenue: summary.revenue,
      averageOrderValue: summary.orders > 0 ? summary.revenue / summary.orders : 0,
    },
    trend,
    statusCounts,
    topProducts,
    newCustomers,
    returningCustomers,
  });
}
