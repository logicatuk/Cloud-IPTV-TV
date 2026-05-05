import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
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

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { macAddress, status, expiresAt, licenseTier, logout } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const statusColor =
    status === "active"
      ? colors.success
      : status === "suspended" || status === "expired"
      ? colors.destructive
      : colors.warning;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: topPad, paddingBottom: insets.bottom + 84 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>

      <SectionTitle title="Device" colors={colors} />
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <InfoRow label="MAC Address" value={macAddress ?? "—"} mono colors={colors} />
        <Divider colors={colors} />
        <InfoRow
          label="Status"
          value={status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown"}
          valueColor={statusColor}
          colors={colors}
        />
        <Divider colors={colors} />
        <InfoRow label="License" value={licenseTier ?? "—"} colors={colors} />
        <Divider colors={colors} />
        <InfoRow label="Expires" value={fmtDate(expiresAt)} colors={colors} />
      </View>

      <SectionTitle title="Activation" colors={colors} />
      <Pressable
        onPress={() => router.push("/activation")}
        style={({ pressed }) => [
          styles.actionRow,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Feather name="monitor" size={18} color={colors.primary} />
        <Text style={[styles.actionText, { color: colors.text }]}>Activation Details</Text>
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      </Pressable>

      <SectionTitle title="Content" colors={colors} />
      <Pressable
        onPress={() => router.push("/search")}
        style={({ pressed }) => [
          styles.actionRow,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Feather name="search" size={18} color={colors.primary} />
        <Text style={[styles.actionText, { color: colors.text }]}>Search</Text>
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      </Pressable>

      <SectionTitle title="About" colors={colors} />
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <InfoRow label="App" value="MaxPlayer IPTV" colors={colors} />
        <Divider colors={colors} />
        <InfoRow label="Version" value="1.0.0" colors={colors} />
        <Divider colors={colors} />
        <InfoRow label="Platform" value={Platform.OS} colors={colors} />
      </View>
    </ScrollView>
  );
}

function SectionTitle({ title, colors }: { title: string; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  return (
    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
  );
}

function InfoRow({
  label,
  value,
  mono,
  valueColor,
  colors,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueColor?: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text
        style={[
          styles.infoValue,
          {
            color: valueColor ?? colors.text,
            fontFamily: mono ? (Platform.OS === "ios" ? "Menlo" : "monospace") : undefined,
          },
        ]}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

function Divider({ colors }: { colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, gap: 8 },
  headerTitle: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5, marginBottom: 8 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 4,
    marginLeft: 4,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  infoLabel: { fontSize: 15 },
  infoValue: { fontSize: 15, fontWeight: "500" },
  divider: { height: 1, marginLeft: 16 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionText: { flex: 1, fontSize: 15 },
});
