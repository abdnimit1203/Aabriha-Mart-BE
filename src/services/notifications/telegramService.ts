import { env } from "../../config/env";
import { NotificationSettings } from "../../models/NotificationSettings";
import { Order, IOrder } from "../../models/Order";

const TELEGRAM_TIMEOUT_MS = 5000;

export interface TelegramSendResult {
  success: boolean;
  error?: string;
}

// Low-level Telegram Bot API call. Never throws — every failure mode (no
// token configured, no chat ID, network error, timeout, API error) resolves
// to { success: false, error }, so callers never need a try/catch to stay
// safe. Timeout is enforced via AbortController so a hung request can't
// stall the caller indefinitely.
export async function sendTelegramMessage(text: string, chatId: string): Promise<TelegramSendResult> {
  const botToken = env.telegram.botToken;
  if (!botToken) return { success: false, error: "Telegram bot token is not configured on the server." };
  if (!chatId) return { success: false, error: "No Telegram chat ID configured." };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", disable_web_page_preview: true }),
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (!res.ok || !body.ok) {
      return { success: false, error: body.description ?? `Telegram API returned ${res.status}` };
    }
    return { success: true };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "AbortError";
    return { success: false, error: timedOut ? "Telegram request timed out." : "Telegram request failed." };
  } finally {
    clearTimeout(timeout);
  }
}

// Records the outcome on the settings doc so the admin Settings page can
// show a real status line ("last sent 2m ago" / "last attempt failed: ...")
// without a separate log viewer. Best-effort — a failure here is logged,
// never thrown, since it must never affect the caller's own success/failure.
export async function recordTelegramAttempt(result: TelegramSendResult): Promise<void> {
  try {
    await NotificationSettings.findOneAndUpdate(
      {},
      result.success
        ? { telegramLastNotifiedAt: new Date(), telegramLastError: null }
        : { telegramLastError: result.error ?? "Unknown error" },
      { upsert: true }
    );
  } catch (err) {
    console.error("[telegram] failed to record attempt status:", err);
  }
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cod: "Cash on Delivery",
  bkash: "bKash",
  nagad: "Nagad",
  stripe: "Card",
};

function formatNewOrderMessage(order: IOrder & { _id: unknown }, customerName: string): string {
  const orderCode = String(order._id).slice(-8).toUpperCase();
  // Reuses the configured frontend origin (already the source of truth for
  // "where the frontend lives") instead of inventing a second URL env var.
  const baseUrl = env.corsOrigins[0] ?? "";

  return [
    "🛒 *NEW ORDER*",
    "",
    `Order: #${orderCode}`,
    `Customer: ${customerName}`,
    `Items: ${order.items.length}`,
    `Total: ৳${order.total.toLocaleString()}`,
    `Delivery: ৳${order.deliveryCharge.toLocaleString()}`,
    `Payment: ${PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}`,
    `District: ${order.deliveryAddress.district}`,
    "",
    baseUrl ? `[View Order](${baseUrl}/admin/orders/${order._id})` : `Order ID: ${order._id}`,
  ].join("\n");
}

// The one thing that actually triggers a Telegram send in this app (per
// spec — Telegram is scoped to new orders only, not every notification
// type). Fire-and-forget from the caller's side; this function itself never
// throws and never blocks checkout beyond its own bounded timeout.
export async function sendNewOrderTelegramAlert(
  order: IOrder & { _id: unknown },
  customerName: string
): Promise<void> {
  const settings = await NotificationSettings.findOne({});
  if (!settings?.telegramEnabled) return;

  // Idempotency guard: only the first caller to claim this order's
  // telegramNotifiedAt field actually sends. Protects against an accidental
  // duplicate invocation for the same order (no queue/retry system exists
  // in this app, so this guards in-process double-calls, not network retries).
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, telegramNotifiedAt: { $exists: false } },
    { $set: { telegramNotifiedAt: new Date() } }
  );
  if (!claimed) return;

  const text = formatNewOrderMessage(order, customerName);
  const result = await sendTelegramMessage(text, settings.telegramChatId);
  await recordTelegramAttempt(result);
  if (!result.success) {
    console.error(`[telegram] new-order alert failed for order ${order._id}: ${result.error}`);
  }
}
