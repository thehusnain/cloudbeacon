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
      query.setQueryData<Incident>(["incident", id], (old) =>
        old ? { ...old, status: incident.status } : old,
      );
      await Promise.all([
        query.invalidateQueries({ queryKey: ["incident", id] }),
        query.invalidateQueries({ queryKey: ["incidents"] }),
        query.invalidateQueries({ queryKey: ["stats", "overview"] }),
      ]);
    },
  });
}
