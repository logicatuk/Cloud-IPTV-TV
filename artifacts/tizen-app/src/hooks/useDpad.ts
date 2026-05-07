import { useEffect, useCallback } from "react";

export type DpadDirection = "up" | "down" | "left" | "right" | "enter" | "back" | "play" | "pause";

// Tizen TV key codes
const KEY_CODES: Record<number, DpadDirection> = {
  38: "up",       // Arrow Up
  40: "down",     // Arrow Down
  37: "left",     // Arrow Left
  39: "right",    // Arrow Right
  13: "enter",    // Enter / OK
  10009: "back",  // Tizen Back
  461: "back",    // LG Back (webOS)
  8: "back",      // Backspace (browser fallback)
  415: "play",    // Play
  19: "pause",    // Pause
  10252: "play",  // Tizen Play/Pause toggle
};

// Register Tizen remote keys if available
function registerTizenKeys() {
  try {
    // @ts-ignore
    if (typeof tizen !== "undefined" && tizen?.tvinputdevice?.registerKey) {
      const keys = ["MediaPlay", "MediaPause", "MediaStop", "MediaFastForward", "MediaRewind", "Return"];
      keys.forEach((key) => {
        try {
          // @ts-ignore
          tizen.tvinputdevice.registerKey(key);
        } catch {
          // Key may not be supported on this device
        }
      });
    }
  } catch {
    // Not a Tizen environment
  }
}

export function useDpad(
  callback: (dir: DpadDirection) => void,
  enabled = true
) {
  const stableCallback = useCallback(callback, [callback]);

  useEffect(() => {
    registerTizenKeys();
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const dir = KEY_CODES[e.keyCode];
      if (dir) {
        e.preventDefault();
        e.stopPropagation();
        stableCallback(dir);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [stableCallback, enabled]);
}

export function useFocusGrid(
  cols: number,
  rows: number,
  onSelect: (row: number, col: number) => void,
  onBack?: () => void,
  enabled = true
) {
  const total = cols * rows;
  return { cols, rows, total, onSelect, onBack, enabled };
}
