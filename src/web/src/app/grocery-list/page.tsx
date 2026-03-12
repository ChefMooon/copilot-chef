import { GroceryService } from "@copilot-chef/core";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export default async function GroceryListPage() {
  const groceryService = new GroceryService();
  const groceryList = await groceryService.getCurrentGroceryList();

  const items = groceryList?.items ?? [];
  const groupedItems = Object.entries(
    items.reduce<Record<string, typeof items>>((groups, item) => {
      const key = item.category ?? "other";
      groups[key] = [...(groups[key] ?? []), item];
      return groups;
    }, {})
  );

  return (
    <PlaceholderPage
      description="The checklist is real data from the seeded core services. The page is deliberately simple, but the structure is ready for item editing and export controls."
      eyebrow="Grocery List"
      primaryAction={{ href: "/settings", label: "Tune Preferences" }}
      secondaryAction={{ href: "/", label: "Back Home" }}
      title="This Week's Shop"
    >
      <section className="lg:col-span-8 rounded-card border border-green/10 bg-white p-6 shadow-card">
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-orange">Current List</p>
            <h2 className="font-serif text-3xl font-bold text-text">{groceryList?.name ?? "No grocery list yet"}</h2>
          </div>
          <p className="text-sm font-semibold text-text-muted">
            {groceryList?.checkedCount ?? 0} of {groceryList?.totalItems ?? 0} collected
          </p>
        </div>

        <div className="space-y-5">
          {groupedItems.map(([category, items]) => (
            <div key={category}>
              <h3 className="mb-3 font-serif text-xl font-semibold capitalize text-text">{category}</h3>
              <div className="space-y-3">
                {items.map((item) => (
                  <div className="flex items-center justify-between rounded-btn border border-cream-dark bg-cream px-4 py-3" key={item.id}>
                    <div>
                      <p className="font-semibold text-text">{item.name}</p>
                      <p className="text-sm font-medium text-text-muted">{item.checked ? "Collected" : "Still needed"}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] ${item.checked ? "bg-green-pale text-green" : "bg-[#FDF0E8] text-orange"}`}>
                      {item.checked ? "Done" : "Open"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <aside className="lg:col-span-4 space-y-5">
        <section className="rounded-card border border-green/10 bg-white p-6 shadow-card">
          <h2 className="font-serif text-2xl font-bold text-text">Progress</h2>
          <p className="mt-2 text-sm font-medium text-text-muted">
            Completion is already computed by the shared service layer, so toggles and exports can land here without rewriting list logic.
          </p>
        </section>
        <section className="rounded-card bg-cream p-6 shadow-card">
          <h3 className="font-serif text-xl font-semibold text-text">Planned additions</h3>
          <ul className="mt-3 space-y-2 text-sm font-medium text-text-muted">
            <li>Categorized item editing</li>
            <li>Pantry-aware substitutions</li>
            <li>Export to printable shopping sheet</li>
          </ul>
        </section>
      </aside>
    </PlaceholderPage>
  );
}
