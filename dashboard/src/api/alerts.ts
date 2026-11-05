import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "./client";
import type { Alert, AlertFilters, AlertStatus, Page } from "../types/activity";
export function useAlerts(filters: AlertFilters) {
  return useQuery({
    queryKey: ["alerts", filters],
    queryFn: async () =>
      (await client.get<Page<Alert>>("/alerts", { params: filters })).data,
  });
}
export function useAlert(id: string) {
  return useQuery({
    queryKey: ["alert", id],
    queryFn: async () =>
      (await client.get<{ alert: Alert }>(`/alerts/${encodeURIComponent(id)}`))
        .data.alert,
  });
}
export function useUpdateAlert() {
  const query = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AlertStatus }) =>
      (
        await client.patch<{ alert: Alert }>(
          `/alerts/${encodeURIComponent(id)}`,
          { status },
        )
      ).data.alert,
    onSuccess: async (alert) => {
      query.setQueryData(["alert", alert._id], alert);
      await query.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}
