import { useState } from "react";
import { useCommands, useCommand } from "../api/commands";
import { errorMessage } from "../api/client";
import { Card, Button, Table, EmptyState, ErrorState, Spinner } from "./ui";
import { RelativeTime } from "./RelativeTime";
import { IpAddress } from "./IpAddress";
import { BlockIpModal } from "./BlockIpModal";
export function ServerCommands({ serverId }: { serverId: string }) {
  const query = useCommands(serverId);
  const unblock = useCommand(serverId, "unblock-ip");
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const colors = {
    pending: "text-yellow-300 bg-yellow-400/10",
    delivered: "text-blue-300 bg-blue-400/10",
    done: "text-green-300 bg-green-400/10",
    failed: "text-red-300 bg-red-400/10",
  };
  return (
    <Card className="lg:col-span-2">
      <div className="mb-4 flex flex-wrap justify-between gap-4">
        <h2 className="text-lg font-semibold">Blocked IPs and commands</h2>
        <Button onClick={() => setOpen(true)}>Block IP</Button>
      </div>
      <p className="mb-4 text-sm text-slate-400">
        Latest 25 commands. Refreshes every 10 seconds. Command history does not
        show whether an earlier block has expired.
      </p>
      {notice && (
        <p role="status" className="mb-4 text-teal-300">
          {notice}
        </p>
      )}
      {unblock.isError && <ErrorState message={errorMessage(unblock.error)} />}
      {query.isPending ? (
        <Spinner />
      ) : query.isError ? (
        <ErrorState
          message={errorMessage(query.error)}
          retry={() => void query.refetch()}
        />
      ) : !query.data.items?.length ? (
        <EmptyState title="No commands yet" />
      ) : (
        <Table
          caption="Recent commands"
          headers={[
            "Type",
            "IP",
            "Status",
            "Time",
            "Source",
            "Result",
            "Action",
          ]}
        >
          {query.data.items.map((command) => (
            <tr key={command._id} className="border-b border-slate-800">
              <td className="p-3">
                {command.type === "block_ip" ? "Block IP" : "Unblock IP"}
              </td>
              <td className="p-3">
                <IpAddress value={command.payload.ip} />
              </td>
              <td className="p-3">
                <span
                  className={`rounded px-2 py-1 text-xs ${colors[command.status]}`}
                >
                  {command.status}
                </span>
              </td>
              <td className="p-3">
                <RelativeTime value={command.createdAt} />
              </td>
              <td className="p-3">{command.source}</td>
              <td className="max-w-xs break-words p-3">
                {command.resultMessage || "—"}
              </td>
              <td className="p-3">
                {command.type === "block_ip" && command.status === "done" && (
                  <Button
                    disabled={unblock.isPending}
                    onClick={() => {
                      setNotice("");
                      unblock.mutate(
                        { ip: command.payload.ip },
                        {
                          onSuccess: () =>
                            setNotice(
                              "Unblock command queued for the next heartbeat.",
                            ),
                        },
                      );
                    }}
                  >
                    Unblock
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
      {open && (
        <BlockIpModal serverId={serverId} onClose={() => setOpen(false)} />
      )}
    </Card>
  );
}
