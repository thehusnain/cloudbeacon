import { createContext } from "react";
export const SocketContext = createContext<{
  status: "connected" | "reconnecting" | "disconnected";
  unread: number;
}>({ status: "disconnected", unread: 0 });
