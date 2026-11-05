export const eventLabels: Record<string, string> = {
  ssh_failed_login: "Failed SSH login",
  ssh_login_success: "Successful SSH login",
  root_login: "Root login",
  port_scan: "Port scan",
  ping_scan: "Ping scan",
  file_modified: "File modified",
  file_deleted: "File deleted",
  permission_changed: "Permissions changed",
  system_log: "System log",
  ip_blocked: "IP blocked",
  ip_unblocked: "IP unblocked",
  file_protection_triggered: "File protection triggered",
};
export function readableLabel(value: string) {
  const text = value.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
export function eventLabel(type: string) {
  return eventLabels[type] ?? readableLabel(type);
}
export const severityLabel = readableLabel;
