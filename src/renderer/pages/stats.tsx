import { Suspense, lazy } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchJson } from "@/lib/api";
import { isServerConfigReady } from "@/lib/config";
import { useServerConfig } from "@/lib/use-server-config";
import { type StatsPayload } from "@/components/stats/StatsDashboard";

const StatsDashboard = lazy(async () => {
  const module = await import("@/components/stats/StatsDashboard");
  return { default: module.StatsDashboard };
});

export default function StatsPage() {
  const config = useServerConfig();
  const apiReady = isServerConfigReady(config);
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
      <Suspense
        fallback={<p className="text-sm text-text-muted">Loading charts...</p>}
      >
        <StatsDashboard stats={statsQuery.data} />
      </Suspense>
    </div>
  );
}
