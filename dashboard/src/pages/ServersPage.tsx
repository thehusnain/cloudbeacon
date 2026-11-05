import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Server as ServerIcon } from "lucide-react";
import { useServers } from "../api/servers";
import { errorMessage } from "../api/client";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Spinner,
  Table,
} from "../components/ui";
import { AddServerModal } from "../components/AddServerModal";
import { RelativeTime } from "../components/RelativeTime";
export function ServersPage() {
  const servers = useServers();
  const [adding, setAdding] = useState(false);
  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-3 text-xs tracking-widest text-teal-300">
            INFRASTRUCTURE
          </p>
          <h1 className="text-3xl font-semibold">Servers</h1>
          <p className="mt-3 text-slate-400">
            Connect and monitor your Linux servers.
          </p>
        </div>
        <Button
          className="flex items-center gap-2"
          onClick={() => setAdding(true)}
        >
          <Plus size={18} />
          Add Server
        </Button>
      </div>
      {servers.isPending ? (
        <Spinner label="Loading servers" />
      ) : servers.isError ? (
        <ErrorState
          message={errorMessage(servers.error)}
          retry={() => void servers.refetch()}
        />
      ) : !servers.data.length ? (
        <Card>
          <EmptyState
            title="Connect your first server"
            description="Create an enrollment key, then install the agent on your Linux server."
          />
          <div className="text-center">
            <Button onClick={() => setAdding(true)}>
              Add your first server
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="mb-5 flex items-center justify-between">
            <span className="text-sm text-slate-400">
              {servers.data.length} server{servers.data.length === 1 ? "" : "s"}
            </span>
            <span className="text-xs text-slate-500">
              Refreshes every 15 seconds
            </span>
          </div>
          <Table
            caption="Your servers"
            headers={["Server", "Hostname", "OS", "Status", "Last heartbeat"]}
          >
            {servers.data.map((server) => (
              <tr
                key={server.id}
                className="border-b border-slate-800 last:border-0"
              >
                <td className="p-3">
                  <Link
                    className="flex items-center gap-2 font-medium text-teal-300 hover:underline"
                    to={`/servers/${server.id}`}
                  >
                    <ServerIcon size={16} />
                    {server.name}
                  </Link>
                </td>
                <td className="p-3 text-slate-400">
                  {server.hostname || "Awaiting agent"}
                </td>
                <td className="p-3 text-slate-400">{server.os || "—"}</td>
                <td className="p-3">
                  <Badge status={server.status} />
                </td>
                <td className="p-3 text-slate-400">
                  <RelativeTime value={server.lastHeartbeat} />
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
      {adding && <AddServerModal onClose={() => setAdding(false)} />}
    </>
  );
}
