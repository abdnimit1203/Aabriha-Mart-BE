import { Request, Response, NextFunction } from "express";
import { getAuth } from "firebase-admin/auth";
import { firebaseApp } from "../config/firebase";
import { User, AdminRole } from "../models/User";
import { HttpError } from "./errorHandler";

export interface AuthedRequest extends Request {
  userId?: string;
  userRole?: "customer" | AdminRole;
  // The token's *current* verification claim — distinct from the Mongo
  // User's stored emailVerified field, which only gets written at profile
  // creation. Lets a handler notice "Firebase says verified now, but our
  // stored copy is stale" and self-heal (see authController.getMe).
  firebaseEmailVerified?: boolean;
}

export interface FirebaseAuthedRequest extends Request {
  firebaseUid?: string;
  firebaseEmail?: string;
  firebaseEmailVerified?: boolean;
}

async function verifyToken(req: Request) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const idToken = header.slice("Bearer ".length);
    return await getAuth(firebaseApp).verifyIdToken(idToken);
  } catch {
    return null;
  }
}

// Verifies the Firebase token only — no Mongo User lookup, so it works even
// before a profile has been synced (first-time signup/Google sign-in).
export async function verifyFirebaseToken(req: FirebaseAuthedRequest, res: Response, next: NextFunction) {
  const decoded = await verifyToken(req);
  if (!decoded) throw new HttpError(401, "Invalid or expired token.");
  req.firebaseUid = decoded.uid;
  req.firebaseEmail = decoded.email;
  req.firebaseEmailVerified = Boolean(decoded.email_verified);
  next();
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const decoded = await verifyToken(req);
  if (!decoded) throw new HttpError(401, "Invalid or expired token.");

  const user = await User.findOne({ firebaseUid: decoded.uid, isDeleted: false });
  if (!user) throw new HttpError(401, "Account not found.");
  req.userId = String(user._id);
  req.userRole = user.role;
  req.firebaseEmailVerified = Boolean(decoded.email_verified);
  next();
}

export function requireRole(...roles: Array<"customer" | AdminRole>) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      throw new HttpError(403, "You do not have permission to perform this action.");
    }
    next();
  };
}
