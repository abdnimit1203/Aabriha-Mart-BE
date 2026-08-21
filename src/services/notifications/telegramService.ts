import { env } from "../../config/env";
import { NotificationSettings } from "../../models/NotificationSettings";
import { Order, IOrder } from "../../models/Order";

const TELEGRAM_TIMEOUT_MS = 5000;

export interface TelegramSendResult {
  success: boolean;
  error?: string;
}

// Telegram's own inline-keyboard shape (a grid of button rows) — kept
// minimal to just the "one URL button" case this app actually uses.
interface InlineKeyboardButton {
  text: string;
  url: string;
}
export type InlineKeyboard = InlineKeyboardButton[][];

// Low-level Telegram Bot API call. Never throws — every failure mode (no
// token configured, no chat ID, network error, timeout, API error) resolves
// to { success: false, error }, so callers never need a try/catch to stay
// safe. Timeout is enforced via AbortController so a hung request can't
// stall the caller indefinitely.
export async function sendTelegramMessage(
  text: string,
  chatId: string,
  inlineKeyboard?: InlineKeyboard
): Promise<TelegramSendResult> {
  const botToken = env.telegram.botToken;
  if (!botToken) return { success: false, error: "Telegram bot token is not configured on the server." };
  if (!chatId) return { success: false, error: "No Telegram chat ID configured." };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
        ...(inlineKeyboard ? { reply_markup: { inline_keyboard: inlineKeyboard } } : {}),
      }),
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

// Builds a link to the existing protected Admin Order Detail page — never a
// new/public route. The page itself still requires normal sign-in; this URL
// carries nothing but the order id, no token/session/credential of any
// kind, so it grants no access on its own beyond what a signed-out visitor
// already gets (a redirect to /login). Built from FRONTEND_URL (an
// environment-driven config value — localhost in dev, the real Vercel URL
// in production), never from any user-supplied value.
//
// Telegram's Bot API rejects the whole sendMessage call — not just the
// button — if a reply_markup URL button isn't https (confirmed live: "Bad
// Request: inline keyboard button URL '...' is invalid: Wrong HTTP URL").
// So this deliberately requires https specifically, not just "a valid
// http(s) URL": in local dev (http://localhost) it returns null and the
// caller sends the message without a button rather than failing outright;
// in production (the real https Vercel URL) the button is included. Note
// that even a valid https tunnel URL only gets you a genuinely tappable
// button in dev — "localhost" itself is never reachable from a phone,
// tunnel or not.
function buildOrderUrl(orderId: unknown): string | null {
  const base = env.frontendUrl;
  if (!base) return null;
  try {
    const url = new URL(`/admin/orders/${orderId}`, base);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function formatNewOrderMessage(order: IOrder & { _id: unknown }, customerName: string): string {
  const orderCode = String(order._id).slice(-8).toUpperCase();

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
  const orderUrl = buildOrderUrl(order._id);
  const inlineKeyboard: InlineKeyboard | undefined = orderUrl ? [[{ text: "View Order", url: orderUrl }]] : undefined;
  const result = await sendTelegramMessage(text, settings.telegramChatId, inlineKeyboard);
  await recordTelegramAttempt(result);
  if (!result.success) {
    console.error(`[telegram] new-order alert failed for order ${order._id}: ${result.error}`);
  }
}
