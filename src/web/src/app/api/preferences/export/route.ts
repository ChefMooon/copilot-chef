import { MealLogService, PreferenceService } from "@copilot-chef/core";

const mealLogService = new MealLogService();
const preferenceService = new PreferenceService();

export async function GET() {
  const [preferences, mealLogs] = await Promise.all([
    preferenceService.getPreferences(),
    mealLogService.listAll(),
  ]);

  const payload = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      preferences,
      mealLogs,
    },
    null,
    2
  );

  const fileName = `copilot-chef-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(payload, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
