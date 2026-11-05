import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Copy, Terminal } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  fetchServer,
  serverKeys,
  useCreateServer,
  useDeleteServer,
  useServer,
} from "../api/servers";
import { errorMessage } from "../api/client";
import type { Enrollment } from "../types/server";
import { Button, ErrorState, Input, Modal, Spinner } from "./ui";

export function AddServerModal({ onClose }: { onClose: () => void }) {
  const create = useCreateServer();
  const remove = useDeleteServer();
  const query = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [now, setNow] = useState(Date.now);
  const [copied, setCopied] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const remaining = enrollment
    ? Math.max(0, Math.ceil((Date.parse(enrollment.expiresAt) - now) / 1000))
    : 0;
  const server = useServer(enrollment?.server.id ?? "", {
    enabled: !!enrollment && remaining > 0,
    enrollment: true,
  });
  const online = server.data?.status === "online";
  useEffect(() => {
    if (!enrollment) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [enrollment]);
  useEffect(() => {
    if (online) void query.invalidateQueries({ queryKey: serverKeys.all });
  }, [online, query]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (name.trim().length < 2 || name.trim().length > 60) {
      setError("Use 2–60 characters for the server name.");
      return;
    }
    try {
      const result = await create.mutateAsync(name.trim());
      setNow(Date.now());
      setEnrollment(result);
      create.reset();
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(enrollment!.enrollmentKey);
      setCopied(true);
    } catch {
      setError(
        "Could not access the clipboard. Select and copy the key manually.",
      );
    }
  }
  async function restart() {
    if (!enrollment) return;
    setRestarting(true);
    setError("");
    try {
      const latest = await fetchServer(enrollment.server.id);
      query.setQueryData(serverKeys.detail(latest.id), latest);
      if (latest.status !== "pending") {
        setError(
          "This server is no longer pending. Open its detail page to review it.",
        );
        return;
      }
      await remove.mutateAsync(latest.id);
      setEnrollment(null);
      setName("");
      setCopied(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRestarting(false);
    }
  }
  return (
    <Modal
      open
      title={
        online
          ? "Connection Successful"
          : enrollment
            ? "Connect your agent"
            : "Add Server"
      }
      onClose={() => {
        if (!create.isPending && !restarting) onClose();
      }}
    >
      {online && enrollment ? (
        <div className="space-y-5 text-center">
          <CheckCircle2 size={48} className="mx-auto text-green-300" />
          <p>
            Your agent is connected. Cloud Beacon is ready to receive security
            events.
          </p>
          <Link
            to={`/servers/${enrollment.server.id}`}
            onClick={onClose}
            className="inline-block rounded-lg bg-teal-300 px-4 py-3 font-semibold text-slate-950"
          >
            View server
          </Link>
        </div>
      ) : !enrollment ? (
        <form onSubmit={submit} className="space-y-5">
          <p className="text-sm text-slate-400">
            Give your server a recognizable name. Next, connect its Linux agent.
          </p>
          <Input
            label="Server name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={create.isPending}
            error={error}
          />
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create server"}
          </Button>
        </form>
      ) : remaining === 0 ? (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-yellow-300">Key expired</h3>
          <p className="text-sm text-slate-400">
            This enrollment key is no longer valid. Delete the pending server
            and create a fresh key.
          </p>
          {error && <ErrorState message={error} />}
          <Button disabled={restarting} onClick={() => void restart()}>
            {restarting
              ? "Checking server…"
              : "Delete pending server and start again"}
          </Button>
          <Link
            className="block text-teal-300"
            to={`/servers/${enrollment.server.id}`}
            onClick={onClose}
          >
            View server
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-yellow-200">
            This key is shown only once. Copy it now; closing this dialog hides
            it permanently. Your pending server stays in the list.
          </p>
          <div className="rounded-lg border border-slate-700 bg-slate-950 p-4">
            <p className="mb-2 text-xs uppercase tracking-widest text-slate-400">
              Enrollment key
            </p>
            <code className="block break-all select-all text-sm text-teal-200">
              {enrollment.enrollmentKey}
            </code>
            <button
              onClick={() => void copy()}
              className="mt-3 flex items-center gap-2 text-sm text-teal-300"
            >
              <Copy size={15} />
              {copied ? "Copied" : "Copy key"}
            </button>
          </div>
          <p className="text-sm text-slate-300">
            Expires in{" "}
            <strong>
              {Math.floor(remaining / 60)}:
              {String(remaining % 60).padStart(2, "0")}
            </strong>
          </p>
          <div className="rounded-lg bg-slate-950 p-4">
            <p className="mb-2 flex items-center gap-2 text-sm text-slate-400">
              <Terminal size={16} />
              Run on your Linux server
            </p>
            <code className="block break-all select-all text-sm">
              sudo cloudbeacon-agent install --key {enrollment.enrollmentKey}
            </code>
          </div>
          {server.isError ? (
            <ErrorState
              message={errorMessage(server.error)}
              retry={() => void server.refetch()}
            />
          ) : (
            <Spinner label="Waiting for your agent to connect" />
          )}
          {error && <ErrorState message={error} />}
        </div>
      )}
    </Modal>
  );
}
