import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import { clearPin, getPin, getPinEnabled, setPin as storageSetPin } from "@/lib/storage";

const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes

interface PinContextType {
  pinEnabled: boolean;
  isLoading: boolean;
  getIsSessionUnlocked: () => boolean;
  verifyPin: (pin: string) => boolean;
  setNewPin: (pin: string) => Promise<void>;
  disablePin: () => Promise<void>;
  unlockSession: () => void;
  lockSession: () => void;
}

const PinContext = createContext<PinContextType | null>(null);

export function PinProvider({ children }: { children: React.ReactNode }) {
  const [pinEnabled, setPinEnabled] = useState(false);
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // session unlock timestamp stored in a ref so reads are always fresh
  const unlockedAtRef = useRef<number | null>(null);

  // ── Load from SecureStore on mount ───────────────────────────────────────────
  useEffect(() => {
    Promise.all([getPinEnabled(), getPin()])
      .then(([enabled, pin]) => {
        setPinEnabled(enabled);
        setStoredPin(pin);
      })
      .catch(() => {
        // On storage read failure default to disabled so the app is usable.
        // The feature will re-initialize correctly on next launch.
        setPinEnabled(false);
        setStoredPin(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // ── Clear session when app goes to background ────────────────────────────────
  useEffect(() => {
    const handleChange = (next: AppStateStatus) => {
      if (next === "background" || next === "inactive") {
        unlockedAtRef.current = null;
      }
    };
    const sub = AppState.addEventListener("change", handleChange);
    return () => sub.remove();
  }, []);

  // ── Session helpers ──────────────────────────────────────────────────────────
  const getIsSessionUnlocked = useCallback((): boolean => {
    if (unlockedAtRef.current === null) return false;
    return Date.now() - unlockedAtRef.current < SESSION_DURATION_MS;
  }, []);

  const unlockSession = useCallback(() => {
    unlockedAtRef.current = Date.now();
  }, []);

  const lockSession = useCallback(() => {
    unlockedAtRef.current = null;
  }, []);

  // ── PIN operations ───────────────────────────────────────────────────────────
  const verifyPin = useCallback(
    (pin: string): boolean => storedPin === pin,
    [storedPin]
  );

  const setNewPin = useCallback(async (pin: string) => {
    await storageSetPin(pin);
    setStoredPin(pin);
    setPinEnabled(true);
  }, []);

  const disablePin = useCallback(async () => {
    await clearPin();
    setStoredPin(null);
    setPinEnabled(false);
    unlockedAtRef.current = null;
  }, []);

  return (
    <PinContext.Provider
      value={{
        pinEnabled,
        isLoading,
        getIsSessionUnlocked,
        verifyPin,
        setNewPin,
        disablePin,
        unlockSession,
        lockSession,
      }}
    >
      {children}
    </PinContext.Provider>
  );
}

export function usePinContext(): PinContextType {
  const ctx = useContext(PinContext);
  if (!ctx) throw new Error("usePinContext must be used within PinProvider");
  return ctx;
}
