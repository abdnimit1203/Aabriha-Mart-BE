import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { getImagekitAuth } from "../controllers/uploadController";

export const uploadRoutes = Router();

uploadRoutes.get("/imagekit-auth", requireAuth, getImagekitAuth);
