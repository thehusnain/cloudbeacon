import { useState } from "react";
import { useCommand } from "../api/commands";
import { errorMessage } from "../api/client";
import { isIp } from "../utils/ip";
import { Button, Input, Modal, ErrorState } from "./ui";
export function BlockIpModal({
  serverId,
  initialIp = "",
  onClose,
}: {
  serverId: string;
  initialIp?: string;
  onClose: () => void;
}) {
  const [ip, setIp] = useState(initialIp);
  const [duration, setDuration] = useState(3600);
  const [error, setError] = useState("");
  const command = useCommand(serverId, "block-ip");
  return (
    <Modal
      open
      title="Block IP"
      onClose={() => {
        if (!command.isPending) onClose();
      }}
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!isIp(ip.trim())) {
            setError("Enter a valid IPv4 or IPv6 address.");
            return;
          }
          setError("");
          command.mutate(
            { ip: ip.trim(), durationSeconds: duration },
            { onSuccess: onClose },
          );
        }}
      >
        <Input
          label="IP address"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          error={error}
          disabled={command.isPending}
        />
        <label className="block text-sm">
          Block duration
          <select
            className="mt-2 block w-full rounded bg-slate-950 p-3"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            disabled={command.isPending}
          >
            <option value={3600}>1 hour</option>
            <option value={86400}>24 hours</option>
            <option value={604800}>7 days</option>
          </select>
        </label>
        <p className="text-sm text-slate-300">
          Confirm that you want to block this IP. The agent will receive the
          command at its next heartbeat and block connections from this address.
          If the server is offline, it will wait until the agent reconnects.
        </p>
        {command.isError && (
          <ErrorState message={errorMessage(command.error)} />
        )}
        <Button type="submit" disabled={command.isPending}>
          {command.isPending ? "Sending…" : "Confirm block"}
        </Button>
      </form>
    </Modal>
  );
}
