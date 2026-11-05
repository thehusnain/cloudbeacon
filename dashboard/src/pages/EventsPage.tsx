import { useEvents } from "../api/events";
import { useServers } from "../api/servers";
import { errorMessage } from "../api/client";
import {
  ActivityFilters,
  Pagination,
  useActivityParams,
} from "../components/ActivityFilters";
import { EventList } from "../components/EventList";
import { Card, ErrorState, Spinner } from "../components/ui";
export function EventsPage() {
  const { filters, page, limit, change } = useActivityParams(true);
  const events = useEvents(filters);
  const servers = useServers();
  const names = Object.fromEntries(
    (servers.data ?? []).map((s) => [s.id, s.name]),
  );
  return (
    <>
      <h1 className="mb-3 text-3xl font-semibold">Events</h1>
      <p className="mb-6 text-slate-400">
        Explore security activity reported by your servers.
      </p>
      <ActivityFilters events />
      {events.isPending ? (
        <Spinner label="Loading events" />
      ) : events.isError ? (
        <ErrorState
          message={errorMessage(events.error)}
          retry={() => void events.refetch()}
        />
      ) : (
        <>
          <Card>
            <EventList items={events.data.items} serverNames={names} />
          </Card>
          <Pagination
            page={page}
            limit={limit}
            total={events.data.total}
            change={change}
          />
        </>
      )}
    </>
  );
}
