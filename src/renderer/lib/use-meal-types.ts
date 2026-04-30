import { useQuery } from "@tanstack/react-query";

import { getActiveMealTypeProfile, listMealTypeProfiles } from "@/lib/api";
import { getCachedConfig, isServerConfigReady } from "@/lib/config";

export function useMealTypeProfile(date: Date) {
  const apiReady = isServerConfigReady(getCachedConfig());
  return useQuery({
    queryKey: ["meal-types", "active", date.toISOString().slice(0, 10)],
    enabled: apiReady,
    queryFn: () => getActiveMealTypeProfile(date.toISOString()),
  });
}

export function useMealTypeProfiles() {
  const apiReady = isServerConfigReady(getCachedConfig());
  return useQuery({
    queryKey: ["meal-types", "profiles"],
    enabled: apiReady,
    queryFn: () => listMealTypeProfiles(),
  });
}