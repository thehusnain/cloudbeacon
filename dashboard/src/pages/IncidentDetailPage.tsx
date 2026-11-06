import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useIncident, useTimeline, useUpdateIncident } from "../api/incidents";
import { errorMessage } from "../api/client";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Modal,
  Spinner,
} from "../components/ui";
import { IncidentTimeline, dateText } from "../components/IncidentTimeline";
export function IncidentDetailPage() {
  const { id = "" } = useParams();
  const valid = /^[a-f\d]{24}$/i.test(id);
  const incident = useIncident(valid ? id : "");
  const timeline = useTimeline(valid ? id : "");
  const update = useUpdateIncident(id);
  const [confirm, setConfirm] = useState(false);
  const [copy, setCopy] = useState("");
  if (!valid) return <ErrorState message="Invalid incident ID." />;
  if (incident.isPending) return <Spinner />;
  if (incident.isError)
    return (
      <ErrorState
        message={errorMessage(incident.error)}
        retry={() => void incident.refetch()}
      />
    );
  if (!incident.data) return <EmptyState title="Incident not found" />;
  const data = incident.data;
  const summary = typeof data.summary === "object" ? data.summary : undefined;
  const text = [
    summary?.whatHappened ?? data.title,
    "Started: " + dateText(summary?.startedAt ?? data.startedAt),
    "Last activity: " +
      dateText(summary?.lastActivityAt ?? data.lastActivityAt),
    "Affected: " + (summary?.affected ?? []).join(", "),
    "Source IPs: " + (summary?.sourceIps ?? data.sourceIps ?? []).join(", "),
    "Severity: " + data.severity,
    `${summary?.eventCount ?? data.eventIds?.length ?? 0} events, ${summary?.alertCount ?? data.alertIds?.length ?? 0} alerts`,
  ].join("\n");
  return (
    <div className="space-y-6">
      <Link className="text-teal-300" to="/incidents">
        All incidents
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">{data.title}</h1>
        <Button
          onClick={() => {
            update.reset();
            setConfirm(true);
          }}
        >
          {data.status === "open" ? "Close incident" : "Reopen incident"}
        </Button>
      </div>
      <Card>
        <div className="mb-4 flex gap-3">
          <Badge severity={data.severity} />
          <span className="capitalize">{data.status}</span>
        </div>
        <h2 className="mb-3 text-lg font-semibold">Incident summary</h2>
        <p className="whitespace-pre-line break-words leading-7 text-slate-300">
          {text}
        </p>
        <Button
          className="mt-4"
          onClick={() => {
            void navigator.clipboard
              .writeText(text)
              .then(() => setCopy("Summary copied"))
              .catch(() =>
                setCopy(
                  "Could not copy. Select the summary and copy it manually.",
                ),
              );
          }}
        >
          Copy summary
        </Button>
        {copy && <p role="status">{copy}</p>}
      </Card>
      <h2 className="text-xl font-semibold">Timeline</h2>
      {timeline.isPending ? (
        <Spinner />
      ) : timeline.isError ? (
        <ErrorState
          message={errorMessage(timeline.error)}
          retry={() => void timeline.refetch()}
        />
      ) : (
        <IncidentTimeline steps={timeline.data ?? []} />
      )}
      {confirm && (
        <Modal
          open
          title={
            data.status === "open" ? "Close incident?" : "Reopen incident?"
          }
          onClose={() => {
            if (!update.isPending) setConfirm(false);
          }}
        >
          <p className="mb-4">
            Change this incident to {data.status === "open" ? "closed" : "open"}
            ?
          </p>
          {update.isError && (
            <ErrorState message={errorMessage(update.error)} />
          )}
          <div className="flex gap-3">
            <Button
              disabled={update.isPending}
              onClick={() => setConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={update.isPending}
              onClick={() =>
                update.mutate(data.status === "open" ? "closed" : "open", {
                  onSuccess: () => setConfirm(false),
                })
              }
            >
              Confirm
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
