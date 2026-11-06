import { useIncidents } from "../api/incidents";
import { useServers } from "../api/servers";
import { errorMessage } from "../api/client";
import {
  ActivityFilters,
  Pagination,
  useActivityParams,
} from "../components/ActivityFilters";
import { IncidentList } from "../components/IncidentList";
import { ErrorState, Spinner } from "../components/ui";
export function IncidentsPage() {
  const { filters, page, limit, change } = useActivityParams();
  const query = useIncidents(filters);
  const servers = useServers();
  return (
    <>
      <h1 className="mb-3 text-3xl font-semibold">Beacon Trace</h1>
      <p className="mb-6 text-slate-400">
        Understand the story behind your security incidents.
      </p>
      <ActivityFilters incidents />
      {query.isPending ? (
        <Spinner />
      ) : query.isError ? (
        <ErrorState
          message={errorMessage(query.error)}
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          <IncidentList
            items={query.data.items}
            serverNames={Object.fromEntries(
              (servers.data ?? []).map((s) => [s.id, s.name]),
            )}
          />
          <Pagination
            page={page}
            limit={limit}
            total={query.data.total}
            change={change}
          />
        </>
      )}
    </>
  );
}
