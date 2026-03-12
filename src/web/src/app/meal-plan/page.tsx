import { MealPlanService } from "@copilot-chef/core";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export default async function MealPlanPage() {
  const mealPlanService = new MealPlanService();
  const mealPlan = await mealPlanService.getCurrentMealPlan();

  return (
    <PlaceholderPage
      description="This page is intentionally light but already connected to real plan data, so the next pass can focus on editing interactions instead of basic plumbing."
      eyebrow="Meal Plan"
      primaryAction={{ href: "/calendar", label: "View Calendar" }}
      secondaryAction={{ href: "/", label: "Back Home" }}
      title="Current Meal Plan"
    >
      <section className="lg:col-span-7 rounded-card border border-green/10 bg-white p-6 shadow-card">
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-orange">Active Plan</p>
            <h2 className="font-serif text-3xl font-bold text-text">{mealPlan?.name ?? "No plan yet"}</h2>
          </div>
          <p className="text-sm font-semibold text-text-muted">{mealPlan?.totalMeals ?? 0} meals currently mapped</p>
        </div>

        <div className="space-y-4">
          {mealPlan?.meals.map((meal) => (
            <article className="rounded-card border border-cream-dark bg-cream p-4" key={meal.id}>
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-serif text-xl font-semibold text-text">{meal.name}</h3>
                  <p className="mt-1 text-sm font-semibold uppercase tracking-[0.08em] text-text-muted">
                    Day {meal.dayOfWeek === 0 ? 7 : meal.dayOfWeek} · {meal.mealType}
                  </p>
                </div>
                <span className="rounded-md bg-[#FDF0E8] px-2 py-1 text-[0.68rem] font-bold uppercase tracking-[0.04em] text-orange">
                  Ready to edit
                </span>
              </div>
              {meal.notes ? <p className="mt-3 text-sm font-medium text-text-muted">{meal.notes}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <aside className="lg:col-span-5 space-y-5">
        <section className="rounded-card border border-green/10 bg-white p-6 shadow-card">
          <h2 className="font-serif text-2xl font-bold text-text">What comes next</h2>
          <p className="mt-3 text-sm font-medium text-text-muted">
            This is the staging area for AI-generated alternatives, bulk swaps, and drag-to-reorder meal editing.
          </p>
        </section>
        <section className="rounded-card bg-cream p-6 shadow-card">
          <h3 className="font-serif text-xl font-semibold text-text">Planned editing features</h3>
          <ul className="mt-3 space-y-2 text-sm font-medium text-text-muted">
            <li>Inline add and remove meal actions</li>
            <li>Daily prep load balancing</li>
            <li>One-click regenerate for a single slot</li>
          </ul>
        </section>
      </aside>
    </PlaceholderPage>
  );
}
