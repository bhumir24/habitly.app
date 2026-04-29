// Returns all IANA timezones supported by the runtime, sorted by UTC offset.
// Labels include the UTC offset so users can find their zone easily.
// Falls back to a curated list if Intl.supportedValuesOf is unavailable (older Node).

function offsetLabel(tz: string): string {
  try {
    const now = new Date();
    // Use Intl to get the actual offset
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(now);
    const offsetStr = parts.find((p) => p.type === "timeZoneName")?.value ?? "UTC";
    const city = tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
    return `(${offsetStr}) ${city}`;
  } catch {
    return tz;
  }
}

function getAllTimezones(): { value: string; label: string }[] {
  let zones: string[];
  try {
    zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf?.("timeZone") ?? [];
  } catch {
    zones = [];
  }

  if (zones.length === 0) {
    // Fallback curated list for environments without supportedValuesOf
    zones = [
      "UTC",
      "America/Halifax","America/New_York","America/Chicago","America/Denver",
      "America/Phoenix","America/Los_Angeles","America/Anchorage","Pacific/Honolulu",
      "America/Toronto","America/Vancouver","America/Mexico_City","America/Sao_Paulo",
      "America/Argentina/Buenos_Aires","America/Lima","America/Bogota","America/Caracas",
      "Europe/London","Europe/Dublin","Europe/Lisbon","Europe/Paris","Europe/Berlin",
      "Europe/Amsterdam","Europe/Rome","Europe/Madrid","Europe/Zurich","Europe/Vienna",
      "Europe/Stockholm","Europe/Oslo","Europe/Copenhagen","Europe/Helsinki",
      "Europe/Warsaw","Europe/Prague","Europe/Budapest","Europe/Bucharest",
      "Europe/Athens","Europe/Istanbul","Europe/Moscow","Europe/Kiev",
      "Africa/Johannesburg","Africa/Cairo","Africa/Lagos","Africa/Nairobi",
      "Africa/Accra","Africa/Casablanca",
      "Asia/Dubai","Asia/Riyadh","Asia/Baghdad","Asia/Tehran","Asia/Karachi",
      "Asia/Kolkata","Asia/Colombo","Asia/Dhaka","Asia/Kathmandu","Asia/Yangon",
      "Asia/Bangkok","Asia/Ho_Chi_Minh","Asia/Jakarta","Asia/Singapore",
      "Asia/Hong_Kong","Asia/Shanghai","Asia/Taipei","Asia/Manila",
      "Asia/Seoul","Asia/Tokyo","Asia/Kuala_Lumpur",
      "Australia/Perth","Australia/Darwin","Australia/Adelaide",
      "Australia/Brisbane","Australia/Sydney","Australia/Melbourne",
      "Pacific/Auckland","Pacific/Fiji","Pacific/Guam","Pacific/Tahiti",
    ];
  }

  const result = zones.map((tz) => ({ value: tz, label: offsetLabel(tz) }));

  // Sort by UTC offset then alphabetically
  return result.sort((a, b) => {
    const offsetA = getOffsetMinutes(a.value);
    const offsetB = getOffsetMinutes(b.value);
    if (offsetA !== offsetB) return offsetA - offsetB;
    return a.label.localeCompare(b.label);
  });
}

function getOffsetMinutes(tz: string): number {
  try {
    const now = new Date();
    const utc = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
    const local = new Date(now.toLocaleString("en-US", { timeZone: tz }));
    return (local.getTime() - utc.getTime()) / 60000;
  } catch {
    return 0;
  }
}

let _cache: { value: string; label: string }[] | null = null;

export function getTimezoneSelectOptions(): { value: string; label: string }[] {
  if (!_cache) _cache = getAllTimezones();
  return _cache;
}
