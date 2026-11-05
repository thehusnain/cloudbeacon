import { useQuery } from "@tanstack/react-query";
import { client } from "./client";
import type { EventFilters, Page, SecurityEvent } from "../types/activity";
export function useEvents(filters: EventFilters) {
  return useQuery({
    queryKey: ["events", filters],
    queryFn: async () =>
      (await client.get<Page<SecurityEvent>>("/events", { params: filters }))
        .data,
  });
}
