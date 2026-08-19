import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

interface MongoDuplicateKeyError {
  code: 11000;
  keyValue?: Record<string, unknown>;
}

function isDuplicateKeyError(err: unknown): err is MongoDuplicateKeyError {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === 11000;
}

// Every controller throws HttpError for conditions it anticipated. This
// translates the failure modes Mongoose/Mongo raise on their own — a bad
// :id param, a schema validation failure, a unique-index collision — into
// the same envelope, so no controller needs its own try/catch for those.
function shapeError(err: unknown): { status: number; message: string } {
  if (err instanceof HttpError) {
    return { status: err.status, message: err.message };
  }

  if (err instanceof mongoose.Error.CastError) {
    return { status: 400, message: `Invalid ${err.path}.` };
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const message = Object.values(err.errors)
      .map((e) => e.message)
      .join(" ");
    return { status: 400, message: message || "Invalid data." };
  }

  if (isDuplicateKeyError(err)) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? "value";
    return { status: 409, message: `That ${field} is already in use.` };
  }

  return { status: 500, message: "Something went wrong. Please try again." };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  const shaped = shapeError(err);
  if (shaped.status === 500) console.error(err);
  res.status(shaped.status).json({ message: shaped.message });
}
