import type { ParsedInterval } from "./types.js";

/**
 * Parses interval strings in several formats.
 * Supported: 5m, 1h, 5분, 1시간, 5분마다, 1시간마다
 *
 * @returns { ms, label }, or null if parsing fails.
 */

const INTERVAL_RE = /^(\d+(?:\.\d+)?)\s*(?:(m|h|분|시간)(?:마다)?)\s*$/i;

export function parseInterval(raw: string): ParsedInterval | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const match = trimmed.match(INTERVAL_RE);
  if (!match) return null;

  const amount = Number(match[1]);
  const unitRaw = (match[2] ?? "").toLowerCase();

  if (!Number.isFinite(amount) || amount <= 0) return null;

  switch (unitRaw) {
    case "m":
    case "분":
      return { ms: amount * 60 * 1000, label: `${amount}분` };
    case "h":
    case "시간":
      return { ms: amount * 60 * 60 * 1000, label: `${amount}시간` };
    default:
      return null;
  }
}
