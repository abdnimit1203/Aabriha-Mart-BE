import { app } from "./app";
import { connectToDatabase } from "./config/db";
import { env } from "./config/env";

connectToDatabase()
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

if (env.nodeEnv !== "test" && !env.isVercel) {
  app.listen(env.port, () => {
    console.log(`Aabriha Mart API listening on http://localhost:${env.port}`);
  });
}

export default app;
