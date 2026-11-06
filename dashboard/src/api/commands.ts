import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "./client";
import type { Page } from "../types/activity";
export interface Command {
  _id: string;
  type: "block_ip" | "unblock_ip";
  payload: { ip: string; durationSeconds?: number };
  status: "pending" | "delivered" | "done" | "failed";
  createdAt: string;
  source: "manual" | "rule";
  resultMessage?: string;
}
export function useCommands(serverId: string) {
  return useQuery({
    queryKey: ["commands", serverId],
    queryFn: async () =>
      (
        await client.get<Page<Command>>(
          `/servers/${encodeURIComponent(serverId)}/commands`,
          { params: { page: 1, limit: 25 } },
        )
      ).data,
    refetchInterval: 10000,
  });
}
export function useCommand(serverId: string, type: "block-ip" | "unblock-ip") {
  const query = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { ip: string; durationSeconds?: number }) =>
      (
        await client.post<{ command: Command }>(
          `/servers/${encodeURIComponent(serverId)}/${type}`,
          payload,
        )
      ).data.command,
    onSuccess: () =>
      query.invalidateQueries({ queryKey: ["commands", serverId] }),
  });
}
