import { useState } from "react";
import { Link } from "react-router-dom";
import { useAlert, useUpdateAlert } from "../api/alerts";
import { errorMessage } from "../api/client";
import type { Alert } from "../types/activity";
import { readableLabel } from "../utils/activity";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Modal,
  Spinner,
} from "./ui";
import { RelativeTime } from "./RelativeTime";
import { IpAddress } from "./IpAddress";
function AlertActions({ alert }: { alert: Alert }) {
  const update = useUpdateAlert();
  return (
    <div className="space-y-3">
      {update.isError && <ErrorState message={errorMessage(update.error)} />}
      <div className="flex gap-3">
        <Button
          disabled={update.isPending || alert.status !== "open"}
          onClick={() =>
            update.mutate({ id: alert._id, status: "acknowledged" })
          }
        >
          Acknowledge
        </Button>
        <Button
          disabled={update.isPending || alert.status === "resolved"}
          onClick={() => update.mutate({ id: alert._id, status: "resolved" })}
        >
          Resolve
        </Button>
      </div>
    </div>
  );
}
function AlertDetail({
  id,
  onClose,
  serverNames,
}: {
  id: string;
  onClose: () => void;
  serverNames: Record<string, string>;
}) {
  const query = useAlert(id);
  const alert = query.data;
  return (
    <Modal open title="Alert details" onClose={onClose}>
      {query.isPending ? (
        <Spinner />
      ) : query.isError ? (
        <ErrorState
          message={errorMessage(query.error)}
          retry={() => void query.refetch()}
        />
      ) : (
        alert && (
          <div className="max-h-[70vh] space-y-5 overflow-y-auto">
            <Badge severity={alert.severity} />
            <h3 className="text-xl font-semibold">{alert.title}</h3>
            <p>{alert.plainDescription}</p>
            <p className="text-sm text-slate-400">
              {serverNames[alert.serverId] ?? "Unknown server"} ·{" "}
              {readableLabel(alert.status)}
            </p>
            <IpAddress value={alert.sourceIp} />
            <p>
              <RelativeTime value={alert.createdAt} />
            </p>
            <p>
              {alert.eventIds.length} linked event
              {alert.eventIds.length === 1 ? "" : "s"}.
            </p>
            {alert.incidentId && (
              <Link
                className="block text-teal-300 hover:underline"
                to={`/incidents/${alert.incidentId}`}
              >
                View incident
              </Link>
            )}
            <AlertActions alert={alert} />
          </div>
        )
      )}
    </Modal>
  );
}
export function AlertList({
  items,
  serverNames,
}: {
  items: Alert[];
  serverNames: Record<string, string>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  if (!items.length)
    return (
      <EmptyState
        title="No alerts found"
        description="There are no alerts matching these filters."
      />
    );
  return (
    <div className="space-y-4">
      {items.map((alert) => (
        <Card key={alert._id}>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Badge severity={alert.severity} />
            <span className="text-sm text-slate-300">
              {readableLabel(alert.status)}
            </span>
          </div>
          <button
            className="text-left text-lg font-semibold text-teal-300 hover:underline"
            onClick={() => setSelected(alert._id)}
          >
            {alert.title}
          </button>
          <p className="mt-2 text-slate-300">{alert.plainDescription}</p>
          <div className="my-4 flex flex-wrap gap-4 text-sm text-slate-400">
            <span>{serverNames[alert.serverId] ?? "Unknown server"}</span>
            <IpAddress value={alert.sourceIp} />
            <RelativeTime value={alert.createdAt} />
          </div>
          <AlertActions alert={alert} />
        </Card>
      ))}
      {selected && (
        <AlertDetail
          id={selected}
          serverNames={serverNames}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
