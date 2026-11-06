import { useEffect } from "react";
import { Link } from "react-router-dom";
import type { Severity } from "../types/activity";
import { Badge } from "./ui";
export interface ToastMessage {
  id: number;
  title: string;
  description: string;
  href: string;
  severity?: Severity;
}
export function Toast({
  message,
  dismiss,
}: {
  message: ToastMessage;
  dismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => dismiss(message.id), 6000);
    return () => clearTimeout(timer);
  }, [message.id, dismiss]);
  return (
    <div
      role="status"
      aria-atomic="true"
      className="rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl"
    >
      <div className="mb-2 flex justify-between gap-3">
        {message.severity && <Badge severity={message.severity} />}
        <button
          className="ml-auto text-sm text-slate-400"
          aria-label={"Dismiss " + message.title}
          onClick={() => dismiss(message.id)}
        >
          Dismiss
        </button>
      </div>
      <Link
        className="block space-y-1"
        to={message.href}
        onClick={() => dismiss(message.id)}
      >
        <span className="block font-semibold text-teal-200">
          {message.title}
        </span>
        <span className="block text-sm text-slate-300">
          {message.description}
        </span>
      </Link>
    </div>
  );
}
