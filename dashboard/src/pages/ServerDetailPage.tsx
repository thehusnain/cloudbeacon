import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useDeleteServer, useServer } from "../api/servers";
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
import { RelativeTime } from "../components/RelativeTime";
export function ServerDetailPage() {
  const { id = "" } = useParams();
  const valid = /^[a-f\d]{24}$/i.test(id);
  const server = useServer(id, { enabled: valid });
  const remove = useDeleteServer();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  if (!valid) return <ErrorState message="Invalid server ID." />;
  if (server.isPending) return <Spinner label="Loading server" />;
  if (server.isError)
    return (
      <ErrorState
        message={errorMessage(server.error)}
        retry={() => void server.refetch()}
      />
    );
  if (!server.data) return <EmptyState title="Server not found" />;
  const data = server.data;
  async function deleteServer() {
    try {
      await remove.mutateAsync(id);
      navigate("/servers", { replace: true });
    } catch {
      /* Mutation error is displayed inside the confirmation. */
    }
  }
  return (
    <>
      <Link
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-teal-300"
        to="/servers"
      >
        <ArrowLeft size={16} />
        All servers
      </Link>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-3xl font-semibold">{data.name}</h1>
          <Badge status={data.status} />
        </div>
        <Button
          className="flex items-center gap-2 !bg-red-400/10 !text-red-300"
          onClick={() => {
            remove.reset();
            setConfirm(true);
          }}
        >
          <Trash2 size={16} />
          Delete server
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-6 text-lg font-semibold">Server information</h2>
          <dl className="space-y-4">
            {[
              ["Hostname", data.hostname],
              ["Operating system", data.os],
              ["IP address", data.ip],
              ["Agent version", data.agentVersion],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 text-sm">
                <dt className="text-slate-400">{label}</dt>
                <dd className="break-all text-right">
                  {value || "Awaiting agent"}
                </dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 text-sm">
              <dt className="text-slate-400">Last heartbeat</dt>
              <dd>
                <RelativeTime value={data.lastHeartbeat} />
              </dd>
            </div>
          </dl>
        </Card>
        <Card>
          <h2 className="mb-6 text-lg font-semibold">Resource usage</h2>
          {data.stats ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-400">CPU</p>
                <p className="mt-3 text-3xl">
                  {data.stats.cpuPercent !== undefined
                    ? `${data.stats.cpuPercent}%`
                    : "Unavailable"}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Memory</p>
                <p className="mt-3 text-3xl">
                  {data.stats.memoryMb !== undefined
                    ? `${data.stats.memoryMb} MB`
                    : "Unavailable"}
                </p>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No resource data yet"
              description="CPU and memory usage will appear when available."
            />
          )}
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Recent events</h2>
          <EmptyState
            title="Coming soon"
            description="Recent security events will appear here."
          />
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Open alerts</h2>
          <EmptyState
            title="Coming soon"
            description="Open security alerts will appear here."
          />
        </Card>
      </div>
      {confirm && (
        <Modal
          open
          title="Delete this server?"
          onClose={() => {
            if (!remove.isPending) setConfirm(false);
          }}
        >
          <p className="mb-5 text-sm text-slate-300">
            Delete {data.name}? Its agent will no longer be able to send data.
            This action cannot be undone.
          </p>
          {remove.isError && (
            <ErrorState message={errorMessage(remove.error)} />
          )}
          <div className="mt-6 flex justify-end gap-3">
            <Button
              disabled={remove.isPending}
              className="!bg-slate-700 !text-white"
              onClick={() => setConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={remove.isPending}
              className="!bg-red-400"
              onClick={() => void deleteServer()}
            >
              {remove.isPending ? "Deleting…" : "Confirm delete"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
