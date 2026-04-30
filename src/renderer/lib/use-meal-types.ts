import { useQuery } from "@tanstack/react-query";

import { getActiveMealTypeProfile, listMealTypeProfiles } from "@/lib/api";
import { isServerConfigReady } from "@/lib/config";
import { useServerConfig } from "@/lib/use-server-config";

export function useMealTypeProfile(date: Date) {
  const config = useServerConfig();
  const apiReady = isServerConfigReady(config);
  return useQuery({
    queryKey: ["meal-types", "active", date.toISOString().slice(0, 10)],
    enabled: apiReady,
    queryFn: () => getActiveMealTypeProfile(date.toISOString()),
  });
}

export function useMealTypeProfiles() {
  const config = useServerConfig();
  const apiReady = isServerConfigReady(config);
  return useQuery({
    queryKey: ["meal-types", "profiles"],
    enabled: apiReady,
    queryFn: () => listMealTypeProfiles(),
  });
}
