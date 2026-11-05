import { useState } from "react";
import type { SecurityEvent } from "../types/activity";
import { eventLabel, readableLabel } from "../utils/activity";
import { Badge, EmptyState, Modal, Table } from "./ui";
import { RelativeTime } from "./RelativeTime";
import { IpAddress } from "./IpAddress";
function DetailValue({ value }: { value: unknown }) {
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) return <span className="text-slate-500">Empty</span>;
    return (
      <dl className="space-y-3 border-l border-slate-700 pl-3">
        {entries.map(([key, item]) => (
          <div key={key}>
            <dt className="text-xs font-semibold text-slate-400">
              {readableLabel(key.replace(/([a-z])([A-Z])/g, "$1 $2"))}
            </dt>
            <dd className="mt-1 break-words whitespace-pre-wrap text-sm">
              <DetailValue value={item} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return <>{value === null ? "None" : String(value)}</>;
}
export function EventList({
  items,
  serverNames,
}: {
  items: SecurityEvent[];
  serverNames: Record<string, string>;
}) {
  const [selected, setSelected] = useState<SecurityEvent | null>(null);
  if (!items.length)
    return (
      <EmptyState
        title="No events found"
        description="Events will appear here when they match your filters."
      />
    );
  return (
    <>
      <Table
        caption="Security events"
        headers={["Time", "Server", "Type", "Severity", "Source IP"]}
      >
        {items.map((event) => (
          <tr
            key={event._id}
            className="cursor-pointer border-b border-slate-800 hover:bg-slate-800/50"
            onClick={() => setSelected(event)}
          >
            <td className="p-3">
              <RelativeTime value={event.timestamp} />
            </td>
            <td className="p-3">
              {serverNames[event.serverId] ?? "Unknown server"}
            </td>
            <td className="p-3">
              <button
                className="text-left text-teal-300 hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(event);
                }}
              >
                {eventLabel(event.type)}
              </button>
            </td>
            <td className="p-3">
              <Badge severity={event.severity} />
            </td>
            <td className="p-3">
              <IpAddress value={event.sourceIp} />
            </td>
          </tr>
        ))}
      </Table>
      {selected && (
        <Modal
          open
          title={eventLabel(selected.type)}
          onClose={() => setSelected(null)}
        >
          <div className="max-h-[70vh] space-y-5 overflow-y-auto">
            <Badge severity={selected.severity} />
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-slate-400">Server</dt>
                <dd>{serverNames[selected.serverId] ?? selected.serverId}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Time</dt>
                <dd>{new Date(selected.timestamp).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Received</dt>
                <dd>{new Date(selected.receivedAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Source IP</dt>
                <dd>
                  <IpAddress value={selected.sourceIp} />
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Event ID</dt>
                <dd className="break-all font-mono">{selected.eventId}</dd>
              </div>
            </dl>
            <h3 className="font-semibold">Event details</h3>
            {Object.keys(selected.details).length ? (
              <DetailValue value={selected.details} />
            ) : (
              <p className="text-slate-400">No additional details reported.</p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
