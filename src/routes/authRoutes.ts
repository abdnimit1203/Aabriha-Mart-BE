import { Router } from "express";
import { requireAuth, verifyFirebaseToken } from "../middleware/auth";
import { syncProfile, getMe, updateMe } from "../controllers/authController";

export const authRoutes = Router();

authRoutes.post("/sync", verifyFirebaseToken, syncProfile);
authRoutes.get("/me", requireAuth, getMe);
authRoutes.patch("/me", requireAuth, updateMe);
