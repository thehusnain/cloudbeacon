import { Link } from "react-router-dom";
import { useEvents } from "../api/events";
import { useAlerts } from "../api/alerts";
import { errorMessage } from "../api/client";
import { EventList } from "./EventList";
import { AlertList } from "./AlertList";
import { Card, ErrorState, Spinner } from "./ui";
export function ServerActivity({ id, name }: { id: string; name: string }) {
  const events = useEvents({ serverId: id, page: 1, limit: 10 });
  const alerts = useAlerts({
    serverId: id,
    status: "open",
    page: 1,
    limit: 10,
  });
  const names = { [id]: name };
  return (
    <>
      <Card className="lg:col-span-2">
        <div className="mb-4 flex justify-between gap-4">
          <h2 className="text-lg font-semibold">Recent events</h2>
          <Link className="text-teal-300" to={`/events?serverId=${id}`}>
            View all events
          </Link>
        </div>
        {events.isPending ? (
          <Spinner label="Loading recent events" />
        ) : events.isError ? (
          <ErrorState
            message={errorMessage(events.error)}
            retry={() => void events.refetch()}
          />
        ) : (
          <EventList items={events.data.items} serverNames={names} />
        )}
      </Card>
      <Card className="lg:col-span-2">
        <div className="mb-4 flex justify-between gap-4">
          <h2 className="text-lg font-semibold">Open alerts</h2>
          <Link
            className="text-teal-300"
            to={`/alerts?serverId=${id}&status=open`}
          >
            View all open alerts
          </Link>
        </div>
        {alerts.isPending ? (
          <Spinner label="Loading open alerts" />
        ) : alerts.isError ? (
          <ErrorState
            message={errorMessage(alerts.error)}
            retry={() => void alerts.refetch()}
          />
        ) : (
          <AlertList items={alerts.data.items} serverNames={names} />
        )}
      </Card>
    </>
  );
}
