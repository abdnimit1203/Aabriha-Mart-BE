import { Response } from "express";
import { User } from "../models/User";
import { HttpError } from "../middleware/errorHandler";
import { FirebaseAuthedRequest, AuthedRequest } from "../middleware/auth";

function usernameFromEmail(email: string): string {
  const base = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return base || "user";
}

async function generateUniqueUsername(preferred: string): Promise<string> {
  const base = preferred.trim().toLowerCase().replace(/\s+/g, "");
  let candidate = base;
  let suffix = 0;
  // Small catalog of users for a personal store — a short retry loop is plenty.
  while (await User.exists({ username: candidate })) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
  return candidate;
}

async function assertUsernameAvailable(username: string, excludeUserId?: string) {
  const taken = await User.exists({ username, _id: { $ne: excludeUserId } });
  if (taken) throw new HttpError(409, "That username is already taken.");
}

// Called right after Firebase sign-up/sign-in to create or fetch the matching
// Mongo profile. Google sign-in won't have a username/phone yet on first call —
// that's fine, they're collected in a follow-up "complete your profile" step.
export async function syncProfile(req: FirebaseAuthedRequest, res: Response) {
  const { username, phone } = req.body as { username?: string; phone?: string };

  const existing = await User.findOne({ firebaseUid: req.firebaseUid, isDeleted: false });
  if (existing) {
    existing.emailVerified = Boolean(req.firebaseEmailVerified);
    if (username && username !== existing.username) {
      await assertUsernameAvailable(username, String(existing._id));
      existing.username = username;
    }
    if (phone) existing.phone = phone;
    await existing.save();
    return res.json(existing);
  }

  if (!req.firebaseEmail) {
    throw new HttpError(400, "This account has no email on file.");
  }

  const requestedUsername = username || usernameFromEmail(req.firebaseEmail);
  const uniqueUsername = await generateUniqueUsername(requestedUsername);

  const user = await User.create({
    firebaseUid: req.firebaseUid,
    username: uniqueUsername,
    email: req.firebaseEmail,
    emailVerified: Boolean(req.firebaseEmailVerified),
    phone: phone ?? "",
  });

  res.status(201).json(user);
}

export async function getMe(req: AuthedRequest, res: Response) {
  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(404, "Profile not found.");
  res.json(user);
}

export async function updateMe(req: AuthedRequest, res: Response) {
  const { username, phone, profileImage, defaultAddress } = req.body as {
    username?: string;
    phone?: string;
    profileImage?: string;
    defaultAddress?: unknown;
  };

  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(404, "Profile not found.");

  if (username && username !== user.username) {
    await assertUsernameAvailable(username, req.userId);
    user.username = username;
  }
  if (phone !== undefined) user.phone = phone;
  if (profileImage !== undefined) user.profileImage = profileImage;
  if (defaultAddress) user.defaultAddress = defaultAddress as typeof user.defaultAddress;

  await user.save();
  res.json(user);
}
