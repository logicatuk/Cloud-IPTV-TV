import { useEffect, useState } from "react";

/**
 * Returns the current Unix timestamp in seconds, updated every `intervalMs`.
 * Defaults to 60 seconds — suitable for EPG progress bars.
 * The interval is cleared on unmount.
 */
export function useNowTick(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
