import { Link } from "react-router-dom";
import type { Incident } from "../api/incidents";
import { Badge, Card, EmptyState } from "./ui";
import { RelativeTime } from "./RelativeTime";
import { IpAddress } from "./IpAddress";
import { dateText } from "./IncidentTimeline";
export function IncidentList({
  items,
  serverNames,
}: {
  items: Incident[];
  serverNames: Record<string, string>;
}) {
  if (!items.length) return <EmptyState title="No incidents found" />;
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <Card key={item._id}>
          <div className="mb-3 flex gap-3">
            <Badge severity={item.severity} />
            <span className="capitalize">{item.status}</span>
          </div>
          <Link
            className="text-xl font-semibold text-teal-300 hover:underline"
            to={"/incidents/" + item._id}
          >
            {item.title}
          </Link>
          <p className="my-3 text-slate-400">
            {serverNames[item.serverId] ?? "Unknown server"}
          </p>
          <div className="flex flex-wrap gap-3">
            {(item.sourceIps ?? []).map((ip) => (
              <IpAddress key={ip} value={ip} />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-400">
            <span>Started {dateText(item.startedAt)}</span>
            <span>
              Last activity: <RelativeTime value={item.lastActivityAt} />
            </span>
            <span>
              {item.alertIds?.length ?? 0} alerts · {item.eventIds?.length ?? 0}{" "}
              events
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}
