import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { usePlaylist } from "@/context/PlaylistContext";
import { useColors } from "@/hooks/useColors";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { macAddress, status, expiresAt, licenseTier } = useAuth();
  const { credentials, hasCredentials, removeCredentials } = usePlaylist();
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

  const handleRemovePlaylist = () => {
    Alert.alert(
      "Remove Playlist",
      "This will remove your IPTV credentials. You will need to add them again to watch content.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeCredentials(),
        },
      ]
    );
  };

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

      <SectionTitle title="Playlist" colors={colors} />
      {hasCredentials && credentials ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <InfoRow label="Name" value={credentials.name || "My Playlist"} colors={colors} />
          <Divider colors={colors} />
          <InfoRow label="Server" value={credentials.host} mono colors={colors} />
          <Divider colors={colors} />
          <InfoRow label="Username" value={credentials.username} colors={colors} />
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <InfoRow label="Status" value="No playlist added" valueColor={colors.warning} colors={colors} />
        </View>
      )}

      <Pressable
        onPress={() => router.push("/add-playlist")}
        style={({ pressed }) => [
          styles.actionRow,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Feather name="plus-circle" size={18} color={colors.primary} />
        <Text style={[styles.actionText, { color: colors.text }]}>
          {hasCredentials ? "Change Playlist" : "Add Playlist"}
        </Text>
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      </Pressable>

      {hasCredentials && (
        <Pressable
          onPress={handleRemovePlaylist}
          style={({ pressed }) => [
            styles.actionRow,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="trash-2" size={18} color={colors.destructive} />
          <Text style={[styles.actionText, { color: colors.destructive }]}>Remove Playlist</Text>
        </Pressable>
      )}

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

function SectionTitle({
  title,
  colors,
}: {
  title: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
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
            flexShrink: 1,
          },
        ]}
        numberOfLines={1}
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
  card: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 8,
  },
  infoLabel: { fontSize: 15 },
  infoValue: { fontSize: 15, fontWeight: "500", textAlign: "right" },
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
