import { connectToDatabase } from "../config/db";
import { User } from "../models/User";

async function promote() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: tsx src/scripts/promoteAdmin.ts <email>");
    process.exit(1);
  }

  await connectToDatabase();

  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase().trim() },
    { role: "super_admin" },
    { new: true }
  );

  if (!user) {
    console.error(`No user found with email ${email}. Sign up on the site first.`);
    process.exit(1);
  }

  console.log(`Promoted ${user.email} (${user.username}) to super_admin.`);
  process.exit(0);
}

promote();
