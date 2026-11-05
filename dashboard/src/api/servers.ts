import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "./client";
import type { Enrollment, Server } from "../types/server";
export const serverKeys = {
  all: ["servers"] as const,
  detail: (id: string) => ["server", id] as const,
};
export async function fetchServer(id: string) {
  return (
    await client.get<{ server: Server }>(`/servers/${encodeURIComponent(id)}`)
  ).data.server;
}
export function useServers() {
  return useQuery({
    queryKey: serverKeys.all,
    queryFn: async () =>
      (await client.get<{ servers: Server[] }>("/servers")).data.servers,
    refetchInterval: 15000,
  });
}
export function useServer(
  id: string,
  options: { enabled?: boolean; enrollment?: boolean } = {},
) {
  return useQuery({
    queryKey: serverKeys.detail(id),
    queryFn: () => fetchServer(id),
    enabled: !!id && options.enabled !== false,
    refetchInterval: (query) =>
      options.enrollment
        ? query.state.data?.status === "online"
          ? false
          : 3000
        : 15000,
  });
}
export function useCreateServer() {
  const query = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) =>
      (await client.post<Enrollment>("/servers", { name })).data,
    gcTime: 0,
    onSuccess: () => {
      void query.invalidateQueries({ queryKey: serverKeys.all });
    },
  });
}
export function useDeleteServer() {
  const query = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await client.delete(`/servers/${encodeURIComponent(id)}`);
    },
    onSuccess: (_data, id) => {
      query.removeQueries({ queryKey: serverKeys.detail(id) });
      void query.invalidateQueries({ queryKey: serverKeys.all });
    },
  });
}
