import { useQuery } from "@tanstack/react-query";

import { fetchJson } from "@/lib/api";
import { getCachedConfig, isServerConfigReady } from "@/lib/config";
import { StatsDashboard, type StatsPayload } from "@/components/stats/StatsDashboard";

export default function StatsPage() {
  const apiReady = isServerConfigReady(getCachedConfig());
  const statsQuery = useQuery({
    queryKey: ["stats"],
    enabled: apiReady,
    queryFn: () =>
      fetchJson<{ data: StatsPayload }>("/api/stats").then(
        (response) => response.data
      ),
  });

  if (statsQuery.isLoading) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-sm text-text-muted">Loading stats...</p>
      </div>
    );
  }

  if (statsQuery.isError || !statsQuery.data) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-sm text-orange">Unable to load stats right now.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <StatsDashboard stats={statsQuery.data} />
    </div>
  );
}
