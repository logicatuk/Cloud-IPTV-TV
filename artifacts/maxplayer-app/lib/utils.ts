const IPTV_PREFIX = /^[A-Z]{1,6}\s*[★✦•|]\s+/u;
const YEAR_SUFFIX = /\s*[-–]\s*\d{4}$/;

// ─── Adult category detection ─────────────────────────────────────────────────

const ADULT_PATTERN = /adult|xxx|18\+|\+18|erotic|sexy|x-rated|mature|explicit/i;

export function isAdultCategory(name: string): boolean {
  return ADULT_PATTERN.test(name);
}

export function cleanIptvName(name: string): string {
  return name.replace(IPTV_PREFIX, "").trim();
}

export function splitTitleYear(name: string): { title: string; year: string | null } {
  const clean = cleanIptvName(name);
  const yearMatch = clean.match(/\s*[-–]\s*(\d{4})$/);
  if (yearMatch) {
    return { title: clean.replace(YEAR_SUFFIX, "").trim(), year: yearMatch[1] };
  }
  return { title: clean, year: null };
}
