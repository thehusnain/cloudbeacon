import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useOverviewStats, useEventsOverTime } from "../api/stats";
import { useAlerts } from "../api/alerts";
import { errorMessage } from "../api/client";
import { Badge, Card, EmptyState, ErrorState, Spinner } from "../components/ui";
import { RelativeTime } from "../components/RelativeTime";
import type { Severity } from "../types/activity";
export function OverviewPage() {
  const overview = useOverviewStats();
  const chart = useEventsOverTime();
  const alerts = useAlerts({ page: 1, limit: 5 });
  const data = overview.data;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Overview</h1>
        <p className="mt-3 text-slate-400">
          Your servers and security activity at a glance.
        </p>
      </div>
      {overview.isPending ? (
        <Spinner label="Loading overview" />
      ) : overview.isError ? (
        <ErrorState
          message={errorMessage(overview.error)}
          retry={() => void overview.refetch()}
        />
      ) : (
        data && (
          <>
            {data.servers.total === 0 && (
              <Card>
                <EmptyState
                  title="Connect your first server"
                  description="Add a Linux server to start monitoring its security."
                />
                <Link className="text-teal-300" to="/servers">
                  Add a server
                </Link>
              </Card>
            )}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[
                ["Servers online", data.servers.online],
                ["Servers offline", data.servers.offline],
                ["Servers pending", data.servers.pending],
                ["Open alerts", data.alerts.open],
                ["Open incidents", data.incidents.open],
                ["Events in the last 24 hours", data.events.last24h],
              ].map(([label, value]) => (
                <Card key={label}>
                  <h2 className="text-sm text-slate-400">{label}</h2>
                  <p className="mt-3 text-3xl font-semibold">{value}</p>
                </Card>
              ))}
            </div>
            <Card>
              <h2 className="mb-4 text-lg font-semibold">
                Open alerts by severity
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {(["low", "medium", "high", "critical"] as Severity[]).map(
                  (severity) => (
                    <div key={severity}>
                      <Badge severity={severity} />
                      <p className="mt-3 text-2xl">
                        {data.alerts.bySeverity[severity]}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </Card>
          </>
        )
      )}
      <Card>
        <h2 className="mb-2 text-lg font-semibold">Events over time</h2>
        <p className="mb-5 text-sm text-slate-400">
          Last 24 hourly buckets · times shown locally
        </p>
        {chart.isPending ? (
          <Spinner label="Loading events chart" />
        ) : chart.isError ? (
          <ErrorState
            message={errorMessage(chart.error)}
            retry={() => void chart.refetch()}
          />
        ) : chart.data.buckets.every((bucket) => bucket.count === 0) ? (
          <EmptyState title="No events in this period" />
        ) : (
          <div className="h-64 w-full" aria-label="Hourly event counts">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart.data.buckets} accessibilityLayer>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis
                  dataKey="start"
                  tickFormatter={(value) =>
                    new Date(value).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  }
                  stroke="#94a3b8"
                  minTickGap={40}
                />
                <YAxis allowDecimals={false} stroke="#94a3b8" />
                <Tooltip
                  labelFormatter={(value) =>
                    new Date(String(value)).toLocaleString()
                  }
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    color: "#fff",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Events"
                  stroke="#5eead4"
                  fill="#2dd4bf"
                  fillOpacity={0.15}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
      <Card>
        <div className="mb-5 flex justify-between">
          <h2 className="text-lg font-semibold">Latest alerts</h2>
          <Link className="text-teal-300" to="/alerts">
            View all alerts
          </Link>
        </div>
        {alerts.isPending ? (
          <Spinner label="Loading latest alerts" />
        ) : alerts.isError ? (
          <ErrorState
            message={errorMessage(alerts.error)}
            retry={() => void alerts.refetch()}
          />
        ) : !alerts.data.items.length ? (
          <EmptyState title="No alerts yet" />
        ) : (
          <ul className="divide-y divide-slate-800">
            {alerts.data.items.map((alert) => (
              <li key={alert._id} className="space-y-2 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge severity={alert.severity} />
                  <Link
                    className="font-semibold text-teal-300 hover:underline"
                    to={"/alerts?alert=" + encodeURIComponent(alert._id)}
                  >
                    {alert.title}
                  </Link>
                </div>
                <p className="text-sm text-slate-300">
                  {alert.plainDescription}
                </p>
                <RelativeTime value={alert.createdAt} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
