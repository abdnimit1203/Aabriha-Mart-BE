import { Request, Response, NextFunction } from "express";
import { getAuth } from "firebase-admin/auth";
import { firebaseApp } from "../config/firebase";
import { User, AdminRole } from "../models/User";

export interface AuthedRequest extends Request {
  userId?: string;
  userRole?: "customer" | AdminRole;
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
  if (!decoded) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
  req.firebaseUid = decoded.uid;
  req.firebaseEmail = decoded.email;
  req.firebaseEmailVerified = Boolean(decoded.email_verified);
  next();
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const decoded = await verifyToken(req);
  if (!decoded) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }

  const user = await User.findOne({ firebaseUid: decoded.uid, isDeleted: false });
  if (!user) {
    return res.status(401).json({ message: "Account not found." });
  }
  req.userId = String(user._id);
  req.userRole = user.role;
  next();
}

export function requireRole(...roles: Array<"customer" | AdminRole>) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({ message: "You do not have permission to perform this action." });
    }
    next();
  };
}
