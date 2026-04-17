import { useQuery } from "@tanstack/react-query";

import { getActiveMealTypeProfile, listMealTypeProfiles } from "@/lib/api";

export function useMealTypeProfile(date: Date) {
  return useQuery({
    queryKey: ["meal-types", "active", date.toISOString().slice(0, 10)],
    queryFn: () => getActiveMealTypeProfile(date.toISOString()),
  });
}

export function useMealTypeProfiles() {
  return useQuery({
    queryKey: ["meal-types", "profiles"],
    queryFn: () => listMealTypeProfiles(),
  });
}