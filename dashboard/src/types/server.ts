export type ServerStatus = "online" | "offline" | "pending";
export interface Server {
  id: string;
  owner: string;
  name: string;
  status: ServerStatus;
  hostname?: string;
  os?: string;
  ip?: string;
  agentVersion?: string;
  lastHeartbeat: string | null;
  createdAt: string;
  updatedAt: string;
  stats?: { cpuPercent?: number; memoryMb?: number; bufferedEvents?: number };
}
export interface Enrollment {
  server: Server;
  enrollmentKey: string;
  expiresAt: string;
}
