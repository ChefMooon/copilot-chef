import { bootstrapDatabase } from "../lib/bootstrap";

async function main() {
  await bootstrapDatabase();
  console.log("Copilot Chef database is ready.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
