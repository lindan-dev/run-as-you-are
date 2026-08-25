/** Formats an edition's official start time plus a runner's jaktstart
 * offset into a Swedish 24h clock string, e.g. "09:24:26". */
export function formatStartClock(editionStartTimeIso: string, offsetSec: number): string {
  const start = new Date(editionStartTimeIso);
  const withOffset = new Date(start.getTime() + offsetSec * 1000);
  return withOffset.toLocaleTimeString("sv-SE", {
    timeZone: "Europe/Stockholm",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Formats an edition's start_time into "9 augusti 2027". */
export function formatEditionDate(editionStartTimeIso: string): string {
  const start = new Date(editionStartTimeIso);
  return start.toLocaleDateString("sv-SE", {
    timeZone: "Europe/Stockholm",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
