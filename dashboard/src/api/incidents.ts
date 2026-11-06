import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "./client";
import type { Severity, Page, ActivityFilters } from "../types/activity";
export interface Summary {
  startedAt: string;
  lastActivityAt: string;
  whatHappened: string;
  affected: string[];
  sourceIps: string[];
  severity: Severity;
  eventCount: number;
  alertCount: number;
}
export interface Incident {
  _id: string;
  serverId: string;
  title: string;
  severity: Severity;
  status: "open" | "closed";
  sourceIps: string[];
  startedAt: string;
  lastActivityAt: string;
  alertIds: string[];
  eventIds: string[];
  summary?: Summary | string;
}
export interface Step {
  timestamp?: string;
  kind?: "event" | "alert";
  type?: string;
  severity?: Severity;
  description?: string;
  evidence?: unknown;
  count?: number;
  firstAt?: string;
  lastAt?: string;
  evidenceCount?: number;
}
export function useIncidents(filters: ActivityFilters & { status?: string }) {
  return useQuery({
    queryKey: ["incidents", filters],
    queryFn: async () =>
      (await client.get<Page<Incident>>("/incidents", { params: filters }))
        .data,
  });
}
export function useIncident(id: string) {
  return useQuery({
    queryKey: ["incident", id],
    enabled: !!id,
    queryFn: async () =>
      (
        await client.get<{ incident: Incident }>(
          `/incidents/${encodeURIComponent(id)}`,
        )
      ).data.incident,
  });
}
export function useTimeline(id: string) {
  return useQuery({
    queryKey: ["incident", id, "timeline"],
    enabled: !!id,
    queryFn: async () =>
      (
        await client.get<{ steps: Step[] }>(
          `/incidents/${encodeURIComponent(id)}/timeline`,
        )
      ).data.steps,
  });
}
export function useUpdateIncident(id: string) {
  const query = useQueryClient();
  return useMutation({
    mutationFn: async (status: "open" | "closed") =>
      (
        await client.patch<{ incident: Incident }>(`/incidents/${id}`, {
          status,
        })
      ).data.incident,
    onSuccess: async (incident) => {
      // The PATCH response is authoritative. An older GET must not overwrite it.
      await query.cancelQueries({ queryKey: ["incident", id], exact: true });
      query.setQueryData<Incident>(["incident", id], (old) =>
        old ? { ...old, status: incident.status } : old,
      );
      await query.cancelQueries({ queryKey: ["incidents"] });
      query.setQueriesData<Page<Incident>>(
        { queryKey: ["incidents"] },
        (old) =>
          old
            ? {
                ...old,
                items: old.items.map((item) =>
                  item._id === id ? { ...item, status: incident.status } : item,
                ),
              }
            : old,
      );
      // Refresh filtered membership and totals without delaying mutation completion.
      void query.invalidateQueries({ queryKey: ["incidents"] });
      void query.invalidateQueries({ queryKey: ["stats", "overview"] });
    },
  });
}
