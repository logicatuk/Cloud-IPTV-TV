export interface M3UChannel {
  id: string;
  name: string;
  icon: string;
  group: string;
  url: string;
}

export interface M3UCategory {
  id: string;
  name: string;
}

export interface ParsedM3U {
  channels: M3UChannel[];
  categories: M3UCategory[];
}

function parseAttr(line: string, attr: string): string {
  const regex = new RegExp(`${attr}="([^"]*)"`, "i");
  const match = line.match(regex);
  return match ? match[1] : "";
}

export function parseM3UText(text: string): ParsedM3U {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const channels: M3UChannel[] = [];
  const categorySet = new Set<string>();
  let currentInfo: string | null = null;
  let idx = 0;

  for (const line of lines) {
    if (!line || line.startsWith("#EXTM3U")) continue;
    if (line.startsWith("#EXTINF")) {
      currentInfo = line;
    } else if (currentInfo && !line.startsWith("#")) {
      const commaIdx = currentInfo.lastIndexOf(",");
      const displayName = commaIdx >= 0 ? currentInfo.slice(commaIdx + 1).trim() : `Channel ${idx + 1}`;
      const icon = parseAttr(currentInfo, "tvg-logo");
      const group = parseAttr(currentInfo, "group-title") || "General";
      const tvgId = parseAttr(currentInfo, "tvg-id");

      categorySet.add(group);
      channels.push({
        id: tvgId ? `${tvgId}-${idx}` : `ch-${idx}`,
        name: displayName,
        icon,
        group,
        url: line,
      });
      idx++;
      currentInfo = null;
    }
  }

  const categories: M3UCategory[] = Array.from(categorySet).map((name) => ({
    id: name,
    name,
  }));

  return { channels, categories };
}

export async function fetchAndParseM3U(url: string): Promise<ParsedM3U> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return parseM3UText(text);
  } finally {
    clearTimeout(timer);
  }
}
