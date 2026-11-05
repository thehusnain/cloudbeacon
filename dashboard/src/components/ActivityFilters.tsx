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
    if (params.get(key)) filters[key] = params.get(key)!;
  }
  function change(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.set(key, value);
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
function localDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function ActivityFilters({ events = false }: { events?: boolean }) {
  const { params, setParams } = useActivityParams(events);
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
        key={params.toString()}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const next = new URLSearchParams();
          if (params.has("limit")) next.set("limit", params.get("limit")!);
          for (const [key, value] of data) {
            if (typeof value === "string" && value.trim())
              next.set(
                key,
                key === "from" || key === "to"
                  ? new Date(value).toISOString()
                  : value.trim(),
              );
          }
          setParams(next);
        }}
      >
        <label className="text-sm">
          Server
          <select
            name="serverId"
            defaultValue={params.get("serverId") ?? ""}
            className={selectClass}
          >
            <option value="">
              {servers.isPending ? "Loading servers…" : "All servers"}
            </option>
            {params.get("serverId") &&
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
            defaultValue={params.get("severity") ?? ""}
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
                defaultValue={params.get("type") ?? ""}
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
            <Input
              label="Source IP"
              name="sourceIp"
              defaultValue={params.get("sourceIp") ?? ""}
            />
            <Input
              label="From (local time)"
              name="from"
              type="datetime-local"
              defaultValue={localDate(params.get("from"))}
            />
            <Input
              label="To (local time)"
              name="to"
              type="datetime-local"
              defaultValue={localDate(params.get("to"))}
            />
          </>
        ) : (
          <label className="text-sm">
            Status
            <select
              name="status"
              defaultValue={params.get("status") ?? ""}
              className={selectClass}
            >
              <option value="">All statuses</option>
              {["open", "acknowledged", "resolved"].map((value) => (
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
            onClick={() => setParams({})}
          >
            Clear
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
