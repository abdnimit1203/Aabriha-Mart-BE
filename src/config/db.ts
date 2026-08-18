import dns from "node:dns";
import mongoose from "mongoose";
import { env } from "./env";

// Node's own DNS resolver (not the OS's) sometimes fails to reach a
// nameserver for the SRV lookup mongodb+srv:// needs, especially on Windows.
// Pointing it at a public resolver works around that.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

let connectionPromise: Promise<typeof mongoose> | null = null;

export function connectToDatabase(): Promise<typeof mongoose> {
  if (connectionPromise) return connectionPromise;

  mongoose.set("strictQuery", true);
  // Explicit dbName so the target database is correct regardless of whether
  // the connection string's path segment includes one (Atlas connection
  // strings copied from the dashboard often omit it).
  connectionPromise = mongoose.connect(env.mongodbUri, { dbName: "Aabriha-mart" });
  return connectionPromise;
}
