import { seedDemo } from "../services/seed.js";
import { prisma } from "../lib/prisma.js";

try {
  const summary = await seedDemo();
  console.log("\nZitounaDeFi seed complete\n");
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error("\nSeed failed:", error.message);
  if (error.details) console.error(error.details);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
