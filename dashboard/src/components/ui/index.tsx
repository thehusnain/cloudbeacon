import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
} from "react";
import { LoaderCircle, Inbox, AlertCircle, X } from "lucide-react";
export function Button({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded-lg bg-teal-300 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
export function Input({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const id = useId();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-slate-200">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-3 text-white outline-none focus:border-teal-300"
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-800 bg-slate-900/70 p-6 ${className}`}
    >
      {children}
    </section>
  );
}
export function Badge(
  props:
    | { severity: "low" | "medium" | "high" | "critical"; status?: never }
    | { status: "online" | "offline" | "pending"; severity?: never },
) {
  const label = props.status ?? props.severity;
  const colors = {
    low: "bg-blue-400/15 text-blue-300",
    medium: "bg-yellow-400/15 text-yellow-300",
    high: "bg-orange-400/15 text-orange-300",
    critical: "bg-red-400/15 text-red-300",
    online: "bg-green-400/15 text-green-300",
    offline: "bg-red-400/15 text-red-300",
    pending: "bg-yellow-400/15 text-yellow-300",
  };
  return (
    <span
      className={`rounded-md px-2 py-1 text-xs font-semibold uppercase ${colors[label]}`}
    >
      {label}
    </span>
  );
}
export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 p-4 text-slate-400"
    >
      <LoaderCircle className="animate-spin" size={18} />
      {label}
    </div>
  );
}
export function EmptyState({
  title = "Nothing here yet",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="py-16 text-center">
      <Inbox className="mx-auto mb-4 text-teal-300" size={32} />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-900 bg-red-950/30 p-4 text-sm text-red-200"
    >
      <AlertCircle className="mr-2 inline" size={16} />
      {message}
      {retry && (
        <button onClick={retry} className="ml-3 underline">
          Try again
        </button>
      )}
    </div>
  );
}
export function Table({
  headers,
  children,
  caption,
}: {
  headers: string[];
  children: ReactNode;
  caption: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-slate-700 text-slate-400">
          <tr>
            {headers.map((h) => (
              <th className="p-3" key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      aria-labelledby={id}
      className="m-auto w-[min(90vw,32rem)] rounded-2xl border border-slate-700 bg-slate-900 p-6 text-white backdrop:bg-black/70"
    >
      <div className="mb-5 flex justify-between">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        <button aria-label="Close dialog" onClick={onClose}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
