import { MealLogService } from "@copilot-chef/core";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export default async function StatsPage() {
  const mealLogService = new MealLogService();
  const heatmap = await mealLogService.getHeatmap(52);

  const statCards = [
    { label: "Tracked meals", value: heatmap.totalMeals },
    { label: "Active days", value: heatmap.activeDays },
    { label: "Current streak", value: heatmap.streak }
  ];

  return (
    <PlaceholderPage
      description="The full-year heatmap page is only partially styled for now, but the summary metrics are already coming from the same meal-log pipeline as the home dashboard."
      eyebrow="Stats"
      primaryAction={{ href: "/meal-plan", label: "See Meal Plan" }}
      secondaryAction={{ href: "/", label: "Back Home" }}
      title="Meal Activity Snapshot"
    >
      <section className="lg:col-span-8 grid gap-4 md:grid-cols-3">
        {statCards.map((card) => (
          <article className="rounded-card border border-green/10 bg-white p-6 shadow-card" key={card.label}>
            <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-text-muted">{card.label}</p>
            <p className="mt-3 font-serif text-5xl font-bold text-green">{card.value}</p>
          </article>
        ))}
      </section>

      <aside className="lg:col-span-4 rounded-card border border-green/10 bg-white p-6 shadow-card">
        <h2 className="font-serif text-2xl font-bold text-text">Planned for the next pass</h2>
        <p className="mt-3 text-sm font-medium text-text-muted">
          The dedicated stats experience will expand this into a full 52-week heatmap, cuisine breakdowns, planning streaks, and deeper patterns pulled from actual meal history.
        </p>
      </aside>
    </PlaceholderPage>
  );
}
