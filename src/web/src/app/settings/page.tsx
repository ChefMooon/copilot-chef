import { PreferenceService } from "@copilot-chef/core";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export default async function SettingsPage() {
  const preferenceService = new PreferenceService();
  const preferences = await preferenceService.getPreferences();

  return (
    <PlaceholderPage
      description="Preferences already live in the shared core package. This page exposes the current values now, and it is ready for a richer form pass next."
      eyebrow="Settings"
      primaryAction={{ href: "/grocery-list", label: "See Grocery List" }}
      secondaryAction={{ href: "/", label: "Back Home" }}
      title="Household Preferences"
    >
      <section className="lg:col-span-7 space-y-5 rounded-card border border-green/10 bg-white p-6 shadow-card">
        <div>
          <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-orange">Preference Profile</p>
          <h2 className="mt-2 font-serif text-3xl font-bold text-text">Configured for {preferences?.householdSize ?? 0} people</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-card border border-cream-dark bg-cream p-4">
            <h3 className="font-serif text-xl font-semibold text-text">Dietary Direction</h3>
            <p className="mt-2 text-sm font-medium text-text-muted">
              {(preferences?.dietaryRestrictions ?? []).join(", ") || "None set yet"}
            </p>
          </article>
          <article className="rounded-card border border-cream-dark bg-cream p-4">
            <h3 className="font-serif text-xl font-semibold text-text">Favorite Cuisines</h3>
            <p className="mt-2 text-sm font-medium text-text-muted">
              {(preferences?.cuisinePreferences ?? []).join(", ") || "None set yet"}
            </p>
          </article>
          <article className="rounded-card border border-cream-dark bg-cream p-4">
            <h3 className="font-serif text-xl font-semibold text-text">Avoid Ingredients</h3>
            <p className="mt-2 text-sm font-medium text-text-muted">
              {(preferences?.avoidIngredients ?? []).join(", ") || "None set yet"}
            </p>
          </article>
          <article className="rounded-card border border-cream-dark bg-cream p-4">
            <h3 className="font-serif text-xl font-semibold text-text">Planning Notes</h3>
            <p className="mt-2 text-sm font-medium text-text-muted">{preferences?.notes || "No notes yet"}</p>
          </article>
        </div>
      </section>

      <aside className="lg:col-span-5 space-y-5">
        <section className="rounded-card border border-green/10 bg-white p-6 shadow-card">
          <h2 className="font-serif text-2xl font-bold text-text">Ready for form controls</h2>
          <p className="mt-3 text-sm font-medium text-text-muted">
            The API route for reading and updating preferences is already wired. The next pass only needs a polished editing form on top.
          </p>
        </section>
      </aside>
    </PlaceholderPage>
  );
}
