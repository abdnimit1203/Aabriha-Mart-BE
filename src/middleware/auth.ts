import { Request, Response, NextFunction } from "express";
import { getAuth } from "firebase-admin/auth";
import { firebaseApp } from "../config/firebase";
import { User, AdminRole } from "../models/User";

export interface AuthedRequest extends Request {
  userId?: string;
  userRole?: "customer" | AdminRole;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing authorization token." });
  }

  try {
    const idToken = header.slice("Bearer ".length);
    const decoded = await getAuth(firebaseApp).verifyIdToken(idToken);
    const user = await User.findOne({ firebaseUid: decoded.uid, isDeleted: false });
    if (!user) {
      return res.status(401).json({ message: "Account not found." });
    }
    req.userId = String(user._id);
    req.userRole = user.role;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

export function requireRole(...roles: Array<"customer" | AdminRole>) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({ message: "You do not have permission to perform this action." });
    }
    next();
  };
}
