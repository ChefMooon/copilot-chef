import { prisma } from "./prisma";
import { seedDatabase } from "./seed";

let bootstrapPromise: Promise<void> | undefined;

export async function bootstrapDatabase() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await prisma.$connect();
      await seedDatabase();
    })().catch((error) => {
      bootstrapPromise = undefined;
      throw error;
    });
  }

  await bootstrapPromise;
}
