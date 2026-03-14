import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";

export interface LicenseUsageSummary {
  license_state: string;
  shares_used: number;
  shares_limit: number | null;
  shares_remaining: number | null;
  devices_used: number;
  devices_limit: number | null;
}

async function fetchLicenseUsage(): Promise<LicenseUsageSummary> {
  const res = await apiRequest<LicenseUsageSummary>("GET", "/api/license/usage");
  return res;
}

export function useLicenseUsage() {
  return useQuery({
    queryKey: ["/api/license/usage"],
    queryFn: fetchLicenseUsage,
    staleTime: 60_000,
    refetchInterval: 10 * 60_000,
  });
}

export function isShareWithinLimit(usage?: LicenseUsageSummary | null): boolean {
  if (!usage) return true;
  if (usage.shares_limit == null) return true;
  return usage.shares_used < usage.shares_limit;
}

export function isDeviceWithinLimit(usage?: LicenseUsageSummary | null): boolean {
  if (!usage) return true;
  if (usage.devices_limit == null) return true;
  return usage.devices_used < usage.devices_limit;
}

