import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";
import { categoryRoutes } from "./routes/categoryRoutes";
import { productRoutes } from "./routes/productRoutes";
import { authRoutes } from "./routes/authRoutes";
import { uploadRoutes } from "./routes/uploadRoutes";
import { orderRoutes } from "./routes/orderRoutes";
import { heroBannerRoutes } from "./routes/heroBannerRoutes";
import { promotionRoutes } from "./routes/promotionRoutes";
import { announcementRoutes, welcomePopupRoutes } from "./routes/storefrontConfigRoutes";
import { notificationRoutes } from "./routes/notificationRoutes";
import { notificationSettingsRoutes } from "./routes/notificationSettingsRoutes";
import { dashboardRoutes } from "./routes/dashboardRoutes";
import { userRoutes } from "./routes/userRoutes";
import { analyticsRoutes } from "./routes/analyticsRoutes";

export const app = express();

app.use(cors({ origin: env.corsOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/hero-banners", heroBannerRoutes);
app.use("/api/promotions", promotionRoutes);
app.use("/api/announcement", announcementRoutes);
app.use("/api/welcome-popup", welcomePopupRoutes);
app.use("/api/admin/notifications", notificationRoutes);
app.use("/api/admin/notification-settings", notificationSettingsRoutes);
app.use("/api/admin/dashboard", dashboardRoutes);
app.use("/api/admin/users", userRoutes);
app.use("/api/admin/analytics", analyticsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
