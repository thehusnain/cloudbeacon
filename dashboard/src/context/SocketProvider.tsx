import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "../hooks/useAuth";
import { SocketContext } from "./SocketContext";
import { Toast, type ToastMessage } from "../components/Toast";
import type { ServerEvents } from "../types/realtime";
import type { Alert } from "../types/activity";
import type { Server } from "../types/server";
import { serverKeys } from "../api/servers";

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  return user && token ? (
    <SessionSocket key={user.id + ":" + token} token={token}>
      {children}
    </SessionSocket>
  ) : (
    <SocketContext.Provider value={{ status: "disconnected", unread: 0 }}>
      {children}
    </SocketContext.Provider>
  );
}
function SessionSocket({
  children,
  token,
}: {
  children: ReactNode;
  token: string;
}) {
  const query = useQueryClient();
  const { pathname } = useLocation();
  const path = useRef(pathname);
  const [status, setStatus] = useState<"connected" | "reconnecting">(
    "reconnecting",
  );
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const sequence = useRef(0);
  const dismiss = useCallback(
    (id: number) =>
      setToasts((items) => items.filter((item) => item.id !== id)),
    [],
  );
  useEffect(() => {
    path.current = pathname;
    if (pathname === "/alerts") setUnread(0);
  }, [pathname]);
  useEffect(() => {
    const socket: Socket<ServerEvents> = io(
      import.meta.env.VITE_SOCKET_URL || "http://localhost:5000",
      { auth: { token }, autoConnect: false, reconnection: true },
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const keys = new Map<string, readonly string[]>();
    // A fixed window, rather than a trailing debounce, still refreshes under continuous traffic.
    function refresh(...groups: (readonly string[])[]) {
      for (const group of groups) keys.set(JSON.stringify(group), group);
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        for (const key of keys.values())
          void query.invalidateQueries({ queryKey: key });
        keys.clear();
      }, 500);
    }
    function toast(message: Omit<ToastMessage, "id">) {
      setToasts((items) =>
        [...items, { ...message, id: ++sequence.current }].slice(-4),
      );
    }
    function reconnect() {
      setStatus("reconnecting");
      if (!socket.active && !retry)
        retry = setTimeout(() => {
          retry = undefined;
          socket.connect();
        }, 5000);
    }
    socket.on("connect", () => {
      if (retry) clearTimeout(retry);
      retry = undefined;
      setStatus("connected");
      // Recover changes missed while disconnected.
      refresh(
        ["incidents"],
        ["incident"],
        ["alerts"],
        ["alert"],
        ["events"],
        ["stats"],
        serverKeys.all,
        ["server"],
      );
    });
    socket.on("disconnect", reconnect);
    socket.on("connect_error", reconnect);
    socket.on("alert:new", (alert) => {
      refresh(["alerts"], ["stats", "overview"], ["incidents"], ["incident"]);
      if (path.current !== "/alerts") setUnread((value) => value + 1);
      toast({
        title: alert.title,
        description: alert.plainDescription,
        severity: alert.severity,
        href: "/alerts?alert=" + encodeURIComponent(alert.id),
      });
    });
    socket.on("alert:updated", (alert) => {
      query.setQueryData<Alert>(["alert", alert.id], (old) =>
        old
          ? { ...old, status: alert.status, eventCount: alert.eventCount }
          : old,
      );
      refresh(
        ["alert", alert.id],
        ["alerts"],
        ["stats", "overview"],
        ["incidents"],
        ["incident"],
      );
    });
    socket.on("event:new", () => refresh(["events"], ["stats"]));
    socket.on("server:status", (update) => {
      const servers = query.getQueryData<Server[]>(serverKeys.all);
      const known =
        servers?.find((server) => server.id === update.serverId) ??
        query.getQueryData<Server>(serverKeys.detail(update.serverId));
      const patch = (server: Server) => ({
        ...server,
        status: update.status,
        lastHeartbeat: update.lastHeartbeat,
      });
      query.setQueryData<Server[]>(serverKeys.all, (old) =>
        old?.map((server) =>
          server.id === update.serverId ? patch(server) : server,
        ),
      );
      query.setQueryData<Server>(serverKeys.detail(update.serverId), (old) =>
        old ? patch(old) : old,
      );
      refresh(serverKeys.all, serverKeys.detail(update.serverId), [
        "stats",
        "overview",
      ]);
      if (update.status === "offline" || update.status === "online")
        toast({
          title: known?.name ?? "Server status changed",
          description:
            update.status === "offline"
              ? "Your server went offline."
              : "Your server is online.",
          href: "/servers/" + encodeURIComponent(update.serverId),
        });
    });
    socket.connect();
    return () => {
      if (timer) clearTimeout(timer);
      if (retry) clearTimeout(retry);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [query, token]);
  return (
    <SocketContext.Provider value={{ status, unread }}>
      {children}
      <div
        aria-label="Notifications"
        className="fixed bottom-5 right-5 z-50 max-h-[85vh] w-[min(24rem,90vw)] space-y-3 overflow-y-auto"
      >
        {toasts.map((message) => (
          <Toast key={message.id} message={message} dismiss={dismiss} />
        ))}
      </div>
    </SocketContext.Provider>
  );
}
