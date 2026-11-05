export function IpAddress({ value }: { value?: string }) {
  return value ? (
    <code className="break-all text-sm text-slate-300">{value}</code>
  ) : (
    <span className="text-slate-500">Not reported</span>
  );
}
