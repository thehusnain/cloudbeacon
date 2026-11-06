import { useQuery } from "@tanstack/react-query";
import { client } from "./client";
import type { Severity } from "../types/activity";
export interface OverviewStats {
  servers: { total: number; online: number; offline: number; pending: number };
  alerts: { open: number; bySeverity: Record<Severity, number> };
  incidents: { open: number };
  events: { last24h: number };
}
export function useOverviewStats() {
  return useQuery({
    queryKey: ["stats", "overview"],
    queryFn: async () =>
      (await client.get<OverviewStats>("/stats/overview")).data,
  });
}
export function useEventsOverTime() {
  return useQuery({
    queryKey: ["stats", "events-over-time", 24],
    queryFn: async () =>
      (
        await client.get<{ buckets: { start: string; count: number }[] }>(
          "/stats/events-over-time",
          { params: { hours: 24 } },
        )
      ).data,
  });
}
