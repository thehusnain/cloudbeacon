import { useAlerts } from "../api/alerts";
import { useServers } from "../api/servers";
import { errorMessage } from "../api/client";
import {
  ActivityFilters,
  Pagination,
  useActivityParams,
} from "../components/ActivityFilters";
import { AlertList } from "../components/AlertList";
import { ErrorState, Spinner } from "../components/ui";
export function AlertsPage() {
  const { filters, page, limit, change } = useActivityParams();
  const alerts = useAlerts(filters);
  const servers = useServers();
  const names = Object.fromEntries(
    (servers.data ?? []).map((s) => [s.id, s.name]),
  );
  return (
    <>
      <h1 className="mb-3 text-3xl font-semibold">Alerts</h1>
      <p className="mb-6 text-slate-400">
        Review and respond to suspicious activity.
      </p>
      <ActivityFilters />
      {alerts.isPending ? (
        <Spinner label="Loading alerts" />
      ) : alerts.isError ? (
        <ErrorState
          message={errorMessage(alerts.error)}
          retry={() => void alerts.refetch()}
        />
      ) : (
        <>
          <AlertList items={alerts.data.items} serverNames={names} />
          <Pagination
            page={page}
            limit={limit}
            total={alerts.data.total}
            change={change}
          />
        </>
      )}
    </>
  );
}
