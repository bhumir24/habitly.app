/**
 * Curated short list of common IANA timezones for settings.
 * Values are stored; labels are for display.
 */
const BASIC: { value: string; label: string }[] = [
  { value: "UTC", label: "UTC" },
  { value: "America/Halifax", label: "Atlantic (Halifax)" },
  { value: "America/New_York", label: "Eastern US (New York)" },
  { value: "America/Chicago", label: "Central US (Chicago)" },
  { value: "America/Denver", label: "Mountain US (Denver)" },
  { value: "America/Phoenix", label: "Arizona (Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacific US (Los Angeles)" },
  { value: "America/Anchorage", label: "Alaska (Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
  { value: "America/Toronto", label: "Eastern Canada (Toronto)" },
  { value: "America/Vancouver", label: "Pacific Canada (Vancouver)" },
  { value: "America/Mexico_City", label: "Mexico City" },
  { value: "America/Sao_Paulo", label: "Brazil (São Paulo)" },
  { value: "Europe/London", label: "UK (London)" },
  { value: "Europe/Paris", label: "Central Europe (Paris)" },
  { value: "Europe/Berlin", label: "Germany (Berlin)" },
  { value: "Africa/Johannesburg", label: "South Africa (Johannesburg)" },
  { value: "Asia/Dubai", label: "Gulf (Dubai)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Hong_Kong", label: "Hong Kong" },
  { value: "Asia/Shanghai", label: "China (Shanghai)" },
  { value: "Asia/Tokyo", label: "Japan (Tokyo)" },
  { value: "Asia/Seoul", label: "Korea (Seoul)" },
  { value: "Australia/Sydney", label: "Australia — Sydney" },
  { value: "Australia/Melbourne", label: "Australia — Melbourne" },
  { value: "Pacific/Auckland", label: "New Zealand (Auckland)" },
];

export function getTimezoneSelectOptions(): { value: string; label: string }[] {
  return BASIC;
}
