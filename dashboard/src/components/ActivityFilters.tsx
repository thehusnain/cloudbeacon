import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useServers } from "../api/servers";
import { errorMessage } from "../api/client";
import { eventLabels, severityLabel } from "../utils/activity";
import { Button, ErrorState, Input } from "./ui";

export function useActivityParams(events = false) {
  const [params, setParams] = useSearchParams();
  const integer = (key: string, fallback: number, max: number) => {
    const value = Number(params.get(key) ?? fallback);
    return Number.isSafeInteger(value) && value >= 1 && value <= max
      ? value
      : fallback;
  };
  const filters: Record<string, string | number> = {
    page: integer("page", 1, Number.MAX_SAFE_INTEGER),
    limit: integer("limit", 25, 100),
  };
  for (const key of [
    "serverId",
    "severity",
    ...(events ? ["type", "sourceIp", "from", "to"] : ["status"]),
  ]) {
    const value = params.get(key)?.trim();
    if (value && value.toLowerCase() !== "all") {
      filters[key] =
        key === "from" || key === "to"
          ? dateBoundary(value, key === "to")
          : value;
    }
  }
  function change(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value.trim() && value.toLowerCase() !== "all")
      next.set(key, value.trim());
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  }
  return {
    params,
    setParams,
    filters,
    page: Number(filters.page),
    limit: Number(filters.limit),
    change,
  };
}
// Date-only filters are local calendar days; explicit ISO timestamps retain their precision.
function dateBoundary(value: string, end: boolean) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value + "T00:00:00");
  if (end) date.setHours(23, 59, 59, 999);
  return Number.isFinite(date.getTime()) ? date.toISOString() : value;
}
function localDate(value: string | null) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (!Number.isFinite(Date.parse(value))) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}
function SourceIpFilter({
  value,
  change,
}: {
  value: string;
  change: (key: string, value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const latestChange = useRef(change);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  useEffect(() => {
    latestChange.current = change;
  }, [change]);
  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(
      () => latestChange.current("sourceIp", draft.trim()),
      400,
    );
    return () => clearTimeout(timer);
  }, [draft, value]);
  return (
    <Input
      label="Source IP"
      name="sourceIp"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
    />
  );
}
export function ActivityFilters({
  events = false,
  incidents = false,
}: {
  events?: boolean;
  incidents?: boolean;
}) {
  const { params, setParams, filters, change } = useActivityParams(events);
  const [reset, setReset] = useState(0);
  const servers = useServers();
  const selectClass =
    "mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white";
  return (
    <div className="mb-6 space-y-3">
      {servers.isError && (
        <ErrorState
          message={errorMessage(servers.error)}
          retry={() => void servers.refetch()}
        />
      )}
      <form
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          // Optional submit flushes a pending IP edit; other controls apply immediately.
          change("sourceIp", String(data.get("sourceIp") ?? ""));
        }}
      >
        <label className="text-sm">
          Server
          <select
            name="serverId"
            value={String(filters.serverId ?? "")}
            onChange={(e) => change("serverId", e.target.value)}
            className={selectClass}
          >
            <option value="">
              {servers.isPending ? "Loading servers…" : "All servers"}
            </option>
            {filters.serverId &&
              !servers.data?.some((s) => s.id === params.get("serverId")) && (
                <option value={params.get("serverId")!}>Selected server</option>
              )}
            {servers.data?.map((server) => (
              <option key={server.id} value={server.id}>
                {server.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Severity
          <select
            name="severity"
            value={String(filters.severity ?? "")}
            onChange={(e) => change("severity", e.target.value)}
            className={selectClass}
          >
            <option value="">All severities</option>
            {["low", "medium", "high", "critical"].map((value) => (
              <option key={value} value={value}>
                {severityLabel(value)}
              </option>
            ))}
          </select>
        </label>
        {events ? (
          <>
            <label className="text-sm">
              Event type
              <select
                name="type"
                value={String(filters.type ?? "")}
                onChange={(e) => change("type", e.target.value)}
                className={selectClass}
              >
                <option value="">All types</option>
                {Object.entries(eventLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <SourceIpFilter
              key={reset}
              value={String(filters.sourceIp ?? "")}
              change={change}
            />
            <Input
              label="From date (local)"
              name="from"
              type="date"
              value={localDate(params.get("from"))}
              onChange={(e) =>
                change(
                  "from",
                  e.target.value ? dateBoundary(e.target.value, false) : "",
                )
              }
            />
            <Input
              label="To date (local)"
              name="to"
              type="date"
              value={localDate(params.get("to"))}
              onChange={(e) =>
                change(
                  "to",
                  e.target.value ? dateBoundary(e.target.value, true) : "",
                )
              }
            />
          </>
        ) : (
          <label className="text-sm">
            Status
            <select
              name="status"
              value={String(filters.status ?? "")}
              onChange={(e) => change("status", e.target.value)}
              className={selectClass}
            >
              <option value="">All statuses</option>
              {(incidents
                ? ["open", "closed"]
                : ["open", "acknowledged", "resolved"]
              ).map((value) => (
                <option key={value} value={value}>
                  {severityLabel(value)}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex items-end gap-3">
          <Button type="submit">Apply filters</Button>
          <Button
            type="button"
            className="!bg-slate-700 !text-white"
            onClick={() => {
              setReset((n) => n + 1);
              setParams({});
            }}
          >
            Clear filters
          </Button>
        </div>
      </form>
    </div>
  );
}
export function Pagination({
  page,
  limit,
  total,
  change,
}: {
  page: number;
  limit: number;
  total: number;
  change: (key: string, value: string) => void;
}) {
  return (
    <nav
      aria-label="Pagination"
      className="mt-6 flex flex-wrap items-center gap-4"
    >
      <Button
        disabled={page <= 1}
        onClick={() => change("page", String(page - 1))}
      >
        Previous
      </Button>
      <span className="text-sm text-slate-400">
        Page {page} of {Math.max(1, Math.ceil(total / limit))} · {total} results
      </span>
      <Button
        disabled={page * limit >= total}
        onClick={() => change("page", String(page + 1))}
      >
        Next
      </Button>
      <label className="text-sm">
        Per page{" "}
        <select
          className="rounded bg-slate-900 p-2"
          value={limit}
          onChange={(e) => change("limit", e.target.value)}
        >
          {[...new Set([10, 25, 50, 100, limit])]
            .sort((a, b) => a - b)
            .map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
        </select>
      </label>
    </nav>
  );
}
