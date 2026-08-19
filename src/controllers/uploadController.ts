import { Response } from "express";
import { imagekit } from "../config/imagekit";
import { AuthedRequest } from "../middleware/auth";

// Client uploads directly to ImageKit using these short-lived, signed params —
// the private key itself never leaves the server.
export async function getImagekitAuth(req: AuthedRequest, res: Response) {
  res.json(imagekit.getAuthenticationParameters());
}
