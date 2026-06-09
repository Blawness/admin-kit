// Seed an initial admin user. Run from examples/demo with env loaded:
//   node --env-file=.env.local scripts/seed-admin.mjs
import { createUser } from "@blawness/admin-kit/admin/users";

const email = process.env.SEED_EMAIL ?? "admin@demo.test";
const name = process.env.SEED_NAME ?? "Admin Demo";
const password = process.env.SEED_PASSWORD ?? "admin12345";

try {
  await createUser(email, name, password, "admin");
  console.log("\n✅ Admin user seeded:");
  console.log(`   email:    ${email}`);
  console.log(`   password: ${password}\n`);
  process.exit(0);
} catch (e) {
  if (e && typeof e === "object" && "code" in e && e.code === "23505") {
    console.log(`\nℹ️  User ${email} already exists — nothing to do.\n`);
    process.exit(0);
  }
  console.error("\n❌ Seed failed:", e);
  process.exit(1);
}
