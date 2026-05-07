import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const PIN_LENGTH = 4;

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "back"],
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type PinModalMode = "verify" | "set";

interface PinModalProps {
  visible: boolean;
  mode: PinModalMode;
  title?: string;
  onSuccess: (pin: string) => void;
  onCancel: () => void;
  verifyFn?: (pin: string) => boolean;
}

// ─── Dot row ──────────────────────────────────────────────────────────────────

function PinDots({ count, error }: { count: number; error: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.dotRow}>
      {Array.from({ length: PIN_LENGTH }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor:
                i < count
                  ? error
                    ? colors.destructive
                    : colors.primary
                  : colors.surfaceHigh,
              borderColor:
                i < count
                  ? error
                    ? colors.destructive
                    : colors.primary
                  : colors.border,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Key button ───────────────────────────────────────────────────────────────

function KeyBtn({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  const isBack = label === "back";
  const isEmpty = label === "";
  return (
    <Pressable
      onPress={isEmpty ? undefined : onPress}
      disabled={isEmpty}
      style={({ pressed }) => [
        styles.key,
        {
          backgroundColor: isEmpty
            ? "transparent"
            : pressed
            ? colors.surfaceHigh
            : colors.surface,
          opacity: isEmpty ? 0 : 1,
        },
      ]}
    >
      {isBack ? (
        <Feather name="delete" size={22} color={colors.text} />
      ) : (
        <Text style={[styles.keyText, { color: colors.text }]}>{label}</Text>
      )}
    </Pressable>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PinModal({
  visible,
  mode,
  title,
  onSuccess,
  onCancel,
  verifyFn,
}: PinModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [pin, setPin] = useState("");
  const [step, setStep] = useState<"enter" | "confirm">("enter"); // for "set" mode
  const [firstPin, setFirstPin] = useState(""); // first entry in "set" mode
  const [error, setError] = useState("");
  const [hasError, setHasError] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Reset whenever the modal opens
  useEffect(() => {
    if (visible) {
      setPin("");
      setStep("enter");
      setFirstPin("");
      setError("");
      setHasError(false);
    }
  }, [visible]);

  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleWrong = useCallback((msg: string) => {
    setHasError(true);
    setError(msg);
    shake();
    setTimeout(() => {
      setPin("");
      setHasError(false);
      setError("");
    }, 700);
  }, [shake]);

  const handleKey = useCallback(
    (key: string) => {
      if (key === "back") {
        setPin((p) => p.slice(0, -1));
        return;
      }

      const next = pin + key;
      setPin(next);

      if (next.length < PIN_LENGTH) return;

      // PIN is complete — process based on mode + step
      if (mode === "verify") {
        if (!verifyFn) return;
        if (verifyFn(next)) {
          setPin("");
          onSuccess(next);
        } else {
          handleWrong("Incorrect PIN");
        }
        return;
      }

      // mode === "set"
      if (step === "enter") {
        setFirstPin(next);
        setPin("");
        setStep("confirm");
      } else {
        // confirm step
        if (next === firstPin) {
          setPin("");
          onSuccess(next);
        } else {
          handleWrong("PINs don't match");
          // reset back to first-entry step after shake
          setTimeout(() => {
            setStep("enter");
            setFirstPin("");
          }, 750);
        }
      }
    },
    [pin, mode, step, firstPin, verifyFn, onSuccess, handleWrong]
  );

  const heading =
    title ??
    (mode === "verify"
      ? "Enter PIN"
      : step === "enter"
      ? "Create PIN"
      : "Confirm PIN");

  const subtitle =
    mode === "set"
      ? step === "enter"
        ? "Choose a 4-digit PIN"
        : "Re-enter your PIN to confirm"
      : "Enter your parental PIN";

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={[styles.backdrop, { backgroundColor: "rgba(0,0,0,0.80)" }]}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: Math.max(insets.bottom, 24) + 16,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ width: 40 }} />
            <View style={styles.headerCenter}>
              <Text style={[styles.heading, { color: colors.text }]}>{heading}</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
            </View>
            <Pressable onPress={onCancel} hitSlop={12} style={styles.closeBtn}>
              <Feather name="x" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Dots */}
          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
            <PinDots count={pin.length} error={hasError} />
            <View style={styles.errorRow}>
              {error ? (
                <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
              ) : null}
            </View>
          </Animated.View>

          {/* Keypad */}
          <View style={styles.keypad}>
            {KEYS.map((row, ri) => (
              <View key={ri} style={styles.keyRow}>
                {row.map((k, ki) => (
                  <KeyBtn
                    key={ki}
                    label={k}
                    onPress={() => handleKey(k)}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 24,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerCenter: { flex: 1, alignItems: "center", gap: 4 },
  heading: { fontSize: 20, fontWeight: "700" },
  subtitle: { fontSize: 13 },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  dotRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginVertical: 8,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
  },
  errorRow: { height: 20, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: 13, fontWeight: "600" },
  keypad: { gap: 8 },
  keyRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  key: {
    width: 80,
    height: 64,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: { fontSize: 28, fontWeight: "400" },
});
