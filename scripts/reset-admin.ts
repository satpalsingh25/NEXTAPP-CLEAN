import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  const hash = await bcrypt.hash("Admin123", 10);
  const u = await prisma.user.update({
    where: { email: "admin@local.com" },
    data:  { password_hash: hash, is_active: true, role: "SUPER_ADMIN" },
    select:{ email: true, role: true, is_active: true },
  });
  console.log("RESET OK:", u);
  // Verify
  const back = await prisma.user.findUnique({ where: { email: "admin@local.com" } });
  const ok = await bcrypt.compare("Admin123", back!.password_hash);
  console.log("bcrypt.compare('Admin123', stored_hash) =", ok);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
