import type { AlertStatus, Severity } from "./activity";
import type { ServerStatus } from "./server";
export interface NewAlert {
  id: string;
  serverId: string;
  severity: Severity;
  title: string;
  plainDescription: string;
  createdAt: string;
}
export interface AlertUpdate {
  id: string;
  status: AlertStatus;
  eventCount: number;
}
export interface ServerUpdate {
  serverId: string;
  status: ServerStatus;
  lastHeartbeat: string | null;
}
export interface EventSummary {
  serverId: string;
  count: number;
  latest: {
    type: string;
    severity: Severity;
    sourceIp?: string;
    timestamp: string;
  };
}
export interface ServerEvents {
  "alert:new": (alert: NewAlert) => void;
  "alert:updated": (alert: AlertUpdate) => void;
  "server:status": (server: ServerUpdate) => void;
  "event:new": (event: EventSummary) => void;
}
