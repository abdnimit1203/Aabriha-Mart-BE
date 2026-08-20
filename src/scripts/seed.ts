// SAFE seed command — `npm run seed`.
//
// This NEVER deletes anything. It only ensures storefront CMS defaults
// (HeroBanner/Announcement/WelcomePopup) exist, inserting them if the
// collection is empty and leaving them untouched otherwise. It never touches
// Category, Product, Order, or User — those are real business data and this
// command must be safe to run against a live database at any time.
//
// For the destructive dev-only catalog reset (wipes and reseeds
// Category/Product/DeliveryRate), see `npm run seed:reset` (seedReset.ts) —
// a separate, explicitly-named command so it can't be triggered by accident.
import { connectToDatabase } from "../config/db";
import { ensureStorefrontDefaults } from "./ensureStorefrontDefaults";

async function seed() {
  await connectToDatabase();

  console.log("Ensuring storefront CMS defaults (additive only, nothing deleted)...");
  await ensureStorefrontDefaults();

  console.log("Done.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
