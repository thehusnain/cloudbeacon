import { Activity, Bell } from "lucide-react";
import { Link } from "react-router-dom";
import type { Step } from "../api/incidents";
import { Badge, EmptyState } from "./ui";
export function dateText(value?: string) {
  return value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString()
    : "Time not reported";
}
export function Evidence({ value }: { value: unknown }) {
  if (value == null)
    return <p className="text-slate-400">No evidence provided.</p>;
  if (Array.isArray(value))
    return value.length ? (
      <ol className="space-y-4">
        {value.map((item, index) => (
          <li key={index} className="rounded border border-slate-700 p-3">
            <p className="mb-2 text-xs text-slate-400">Evidence {index + 1}</p>
            <Evidence value={item} />
          </li>
        ))}
      </ol>
    ) : (
      <p>No evidence provided.</p>
    );
  if (typeof value === "object")
    return (
      <dl className="space-y-3">
        {Object.entries(value).map(([key, item]) => (
          <div key={key}>
            <dt className="text-xs font-semibold text-slate-400">
              {key.replace(/([a-z])([A-Z])/g, "$1 $2")}
            </dt>
            <dd className="break-all whitespace-pre-wrap pl-2 text-sm">
              <Evidence value={item} />
            </dd>
          </div>
        ))}
      </dl>
    );
  return <>{String(value)}</>;
}
export function IncidentTimeline({ steps }: { steps: Step[] }) {
  if (!steps.length) return <EmptyState title="No timeline steps yet" />;
  const colors = {
    low: "text-blue-300",
    medium: "text-yellow-300",
    high: "text-orange-300",
    critical: "text-red-300",
  };
  return (
    <ol
      aria-label="Incident timeline"
      className="ml-3 border-l border-slate-700"
    >
      {[...steps]
        .sort(
          (a, b) =>
            (Date.parse(a.timestamp ?? "") || 0) -
            (Date.parse(b.timestamp ?? "") || 0),
        )
        .map((step, index) => {
          const Icon = step.kind === "alert" ? Bell : Activity;
          const evidence =
            step.evidence &&
            typeof step.evidence === "object" &&
            !Array.isArray(step.evidence)
              ? (step.evidence as Record<string, unknown>)
              : {};
          return (
            <li key={index} className="relative pb-8 pl-8">
              <Icon
                size={24}
                className={`absolute -left-3 rounded-full bg-slate-950 p-1 ${colors[step.severity ?? "low"]}`}
              />
              <article
                className={`space-y-3 rounded-xl border p-4 sm:p-6 ${step.kind === "alert" ? "border-orange-400/40 bg-orange-400/5" : "border-slate-800 bg-slate-900/50"}`}
              >
                <div className="flex flex-wrap gap-3 text-sm">
                  <span>{dateText(step.timestamp)}</span>
                  {step.severity && <Badge severity={step.severity} />}
                  <span>{step.kind === "alert" ? "Alert" : "Event"}</span>
                </div>
                <p className="font-medium">
                  {step.description || "Security activity recorded"}
                </p>
                {(step.count ?? 0) > 1 && (
                  <p className="text-sm text-slate-300">
                    {step.count} events · {dateText(step.firstAt)} —{" "}
                    {dateText(step.lastAt)}
                  </p>
                )}
                {step.kind === "alert" &&
                  typeof evidence.alertId === "string" && (
                    <Link
                      className="block text-teal-300 underline"
                      to={
                        "/alerts?alert=" + encodeURIComponent(evidence.alertId)
                      }
                    >
                      View alert
                    </Link>
                  )}
                <details className="rounded bg-slate-950/50 p-3">
                  <summary className="cursor-pointer text-sm text-teal-300 focus-visible:outline focus-visible:outline-teal-300">
                    Evidence
                  </summary>
                  <div className="mt-4">
                    <Evidence value={step.evidence} />
                    {Array.isArray(step.evidence) &&
                    step.evidenceCount &&
                    step.evidenceCount > step.evidence.length ? (
                      <p className="mt-3 text-sm text-slate-400">
                        Showing {step.evidence.length} of {step.evidenceCount}{" "}
                        evidence events.
                      </p>
                    ) : null}
                  </div>
                </details>
              </article>
            </li>
          );
        })}
    </ol>
  );
}
