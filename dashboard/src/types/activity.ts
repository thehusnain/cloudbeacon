export type Severity = "low" | "medium" | "high" | "critical";
export type AlertStatus = "open" | "acknowledged" | "resolved";
export interface SecurityEvent {
  _id: string;
  serverId: string;
  eventId: string;
  type: string;
  severity: Severity;
  sourceIp?: string;
  timestamp: string;
  receivedAt: string;
  details: Record<string, unknown>;
}
export interface Alert {
  _id: string;
  serverId: string;
  severity: Severity;
  title: string;
  plainDescription: string;
  status: AlertStatus;
  sourceIp?: string;
  eventIds: string[];
  eventCount?: number;
  incidentId?: string;
  createdAt: string;
  updatedAt: string;
}
export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}
export interface ActivityFilters {
  serverId?: string;
  severity?: string;
  page?: number;
  limit?: number;
}
export interface EventFilters extends ActivityFilters {
  type?: string;
  sourceIp?: string;
  from?: string;
  to?: string;
}
export interface AlertFilters extends ActivityFilters {
  status?: string;
}
