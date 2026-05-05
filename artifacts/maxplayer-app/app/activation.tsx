import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function ActivationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { macAddress, status, hasPlaylist, pollStatus } = useAuth();
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  useEffect(() => {
    if (status === "active" && hasPlaylist) {
      router.replace("/(tabs)");
      return;
    }

    setPolling(true);
    const interval = setInterval(async () => {
      const newStatus = await pollStatus();
      if (newStatus === "active") {
        clearInterval(interval);
        setPolling(false);
        router.replace("/(tabs)");
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      setPolling(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const copyMac = async () => {
    if (!macAddress) return;
    await Clipboard.setStringAsync(macAddress);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusLabel =
    status === "suspended"
      ? "Device Suspended"
      : status === "expired"
      ? "License Expired"
      : "Waiting for Activation";

  const statusColor =
    status === "suspended" || status === "expired" ? colors.destructive : colors.warning;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: topPad + 32, paddingBottom: bottomPad + 32 },
      ]}
      style={{ backgroundColor: colors.background }}
    >
      <Animated.View style={[styles.logoRing, { transform: [{ scale: pulse }] }]}>
        <View style={[styles.logoInner, { backgroundColor: colors.primary + "22" }]}>
          <Feather name="tv" size={40} color={colors.primary} />
        </View>
      </Animated.View>

      <Text style={[styles.appName, { color: colors.text }]}>MaxPlayer</Text>

      <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
      </View>

      <View style={[styles.macCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.macLabel, { color: colors.textSecondary }]}>Device MAC Address</Text>
        <Text style={[styles.macValue, { color: colors.text }]} selectable>
          {macAddress ?? "Generating…"}
        </Text>
        <Pressable
          onPress={copyMac}
          style={({ pressed }) => [
            styles.copyBtn,
            {
              backgroundColor: copied ? colors.success + "22" : colors.surfaceHigh,
              borderRadius: colors.radius,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather
            name={copied ? "check" : "copy"}
            size={16}
            color={copied ? colors.success : colors.textSecondary}
          />
          <Text style={[styles.copyText, { color: copied ? colors.success : colors.textSecondary }]}>
            {copied ? "Copied!" : "Copy"}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.instructionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.instructionTitle, { color: colors.text }]}>
          How to activate
        </Text>
        {[
          "Copy your MAC address above",
          "Contact your IPTV provider",
          "Give them your MAC address",
          "This screen updates automatically",
        ].map((step, i) => (
          <View key={i} style={styles.step}>
            <View style={[styles.stepNum, { backgroundColor: colors.primary }]}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            <Text style={[styles.stepText, { color: colors.textSecondary }]}>{step}</Text>
          </View>
        ))}
      </View>

      {polling && (
        <View style={styles.pollingRow}>
          <View style={[styles.pollingDot, { backgroundColor: colors.success }]} />
          <Text style={[styles.pollingText, { color: colors.textMuted }]}>
            Checking activation status…
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 24,
    paddingHorizontal: 24,
    minHeight: "100%",
  },
  logoRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A84FF11",
  },
  logoInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  macCard: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    gap: 12,
  },
  macLabel: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  macValue: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 2,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  copyText: {
    fontSize: 14,
    fontWeight: "500",
  },
  instructionCard: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
    gap: 14,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  stepText: {
    flex: 1,
    fontSize: 14,
  },
  pollingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pollingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pollingText: {
    fontSize: 13,
  },
});
