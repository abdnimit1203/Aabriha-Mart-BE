import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000").split(",").map((o) => o.trim());

export const env = {
  port: Number(process.env.PORT ?? 5000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  mongodbUri: required("MONGODB_URI", "mongodb://localhost:27017/aabriha-mart"),
  corsOrigins,
  // The canonical frontend origin for building outbound links (currently
  // just the Telegram "View Order" button) — a distinct concept from
  // corsOrigins (which is about who's *allowed to call this API*, not
  // where the frontend lives), even though they're usually the same value.
  // Falls back to the first CORS origin so existing setups keep working
  // without an immediate .env change, but should be set explicitly in
  // production (the real Vercel URL).
  frontendUrl: (process.env.FRONTEND_URL?.trim() || corsOrigins[0] || "").replace(/\/+$/, ""),
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID ?? "",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? "",
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  },
  imagekit: {
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY ?? "",
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY ?? "",
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT ?? "",
  },
  telegram: {
    // Optional — the whole feature degrades to "disabled" when unset. Never
    // stored in Mongo, never returned from any API response (see
    // notificationSettingsController).
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  },
  isVercel: Boolean(process.env.VERCEL),
};
