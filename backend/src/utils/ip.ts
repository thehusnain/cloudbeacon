// URL parsing canonicalizes equivalent IPv6 spellings. Collapse IPv4-mapped
// addresses too, so address spelling cannot bypass own-IP/allowlist checks.
export function canonicalIp(ip: string): string {
  if (!ip.includes(':')) return ip;
  const normalized = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  const mapped = /^::ffff:([a-f0-9]+):([a-f0-9]+)$/i.exec(normalized);
  if (!mapped) return normalized;
  const high = parseInt(mapped[1], 16),
    low = parseInt(mapped[2], 16);
  return `${high >>> 8}.${high & 255}.${low >>> 8}.${low & 255}`;
}
