import { MealPlanService } from "@copilot-chef/core";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function CalendarPage() {
  const mealPlanService = new MealPlanService();
  const mealPlan = await mealPlanService.getCurrentMealPlan();

  return (
    <PlaceholderPage
      description="A structured weekly overview is in place so the next customization pass can become a real calendar editor instead of a blank page."
      eyebrow="Calendar"
      primaryAction={{ href: "/meal-plan", label: "Edit Meal Plan" }}
      secondaryAction={{ href: "/", label: "Back Home" }}
      title="Weekly Meal Calendar"
    >
      <div className="lg:col-span-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {labels.map((label, index) => {
          const entries = mealPlan?.meals.filter((meal) => meal.dayOfWeek === index) ?? [];
          return (
            <section className="rounded-card border border-green/10 bg-white p-5 shadow-card" key={label}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-serif text-xl font-bold text-text">{label}</h2>
                <span className="rounded-md bg-green-pale px-2 py-1 text-[0.68rem] font-bold uppercase tracking-[0.04em] text-green">
                  {entries.length} item{entries.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="space-y-3">
                {entries.length > 0 ? (
                  entries.map((meal) => (
                    <div className="rounded-btn border border-cream-dark bg-cream p-3" key={meal.id}>
                      <p className="font-serif text-base font-semibold text-text">{meal.name}</p>
                      <p className="mt-1 text-sm font-semibold uppercase tracking-[0.08em] text-text-muted">
                        {meal.mealType}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm font-medium text-text-muted">Open slot ready for recipes, leftovers, or a night off.</p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <aside className="lg:col-span-4 space-y-5 rounded-card border border-green/10 bg-white p-6 shadow-card">
        <div>
          <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-text-muted">Current Plan</p>
          <h2 className="mt-2 font-serif text-2xl font-bold text-text">{mealPlan?.name ?? "No active plan yet"}</h2>
          <p className="mt-3 text-sm font-medium text-text-muted">
            {mealPlan
              ? `${mealPlan.totalMeals} meals are already staged for the week.`
              : "Once plans are created, this sidebar can hold filters, drag-and-drop controls, and plan switching."}
          </p>
        </div>
        <div className="rounded-card bg-cream p-4">
          <p className="font-serif text-lg font-semibold text-text">Next iteration</p>
          <p className="mt-2 text-sm font-medium text-text-muted">
            Add month navigation, drag-and-drop meal blocks, and direct AI-assisted rescheduling from the calendar itself.
          </p>
        </div>
      </aside>
    </PlaceholderPage>
  );
}
