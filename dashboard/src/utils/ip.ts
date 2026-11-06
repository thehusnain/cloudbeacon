export function isIp(value: string): boolean {
  const ipv4 = (ip: string) =>
    ip.split(".").length === 4 &&
    ip
      .split(".")
      .every((part) => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255);
  if (!value.includes(":")) return ipv4(value);
  if (!/^[\da-fA-F:.]+$/.test(value)) return false;
  let ip = value;
  if (ip.includes(".")) {
    const tail = ip.slice(ip.lastIndexOf(":") + 1);
    if (!ipv4(tail)) return false;
    ip = ip.slice(0, ip.lastIndexOf(":") + 1) + "0:0";
  }
  const halves = ip.split("::");
  if (halves.length > 2) return false;
  const parts = halves.flatMap((half) => (half ? half.split(":") : []));
  if (!parts.every((part) => /^[\da-fA-F]{1,4}$/.test(part))) return false;
  return halves.length === 2 ? parts.length < 8 : parts.length === 8;
}
