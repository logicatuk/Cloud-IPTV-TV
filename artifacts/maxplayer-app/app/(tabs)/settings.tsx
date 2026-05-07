import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
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
import { useWatchHistory } from "@/context/WatchHistoryContext";
import { useColors } from "@/hooks/useColors";
import type { AnyPlaylist, XtreamPlaylist } from "@/lib/playlist-types";
import { clearWatchHistory } from "@/lib/storage";
import { getAccountInfo } from "@/lib/xtream";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { macAddress, status, expiresAt, licenseTier } = useAuth();
  const { playlists, activePlaylist, credentials, connectPlaylist, deletePlaylist } = usePlaylist();
  const { clearAll: clearVodHistory } = useWatchHistory();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [clearing, setClearing] = useState(false);

  const { data: accountInfo } = useQuery({
    queryKey: ["xtream-account-info", credentials?.host, credentials?.username],
    queryFn: () => getAccountInfo(credentials!),
    enabled: !!credentials && activePlaylist?.type === "xtream",
    staleTime: 1000 * 60 * 10,
  });

  const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const fmtTimestamp = (ts: number | null) => {
    if (!ts) return "—";
    return new Date(ts * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const daysRemaining = accountInfo?.expDate
    ? Math.ceil((accountInfo.expDate * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const statusColor =
    status === "active"
      ? colors.success
      : status === "suspended" || status === "expired"
      ? colors.destructive
      : colors.warning;

  const acctStatusColor =
    accountInfo?.status === "Active"
      ? colors.success
      : accountInfo?.status === "Expired" || accountInfo?.status === "Banned"
      ? colors.destructive
      : colors.warning;

  const handleClearHistory = () => {
    if (!activePlaylist) return;
    Alert.alert(
      "Clear Watch History",
      "Remove all recently watched channels for this playlist?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setClearing(true);
            try {
              await Promise.all([
                clearWatchHistory(activePlaylist.id),
                clearVodHistory(),
              ]);
              Alert.alert("Done", "Watch history cleared.");
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  };

  const handleDeletePlaylist = (pl: AnyPlaylist) => {
    Alert.alert(
      "Remove Playlist",
      `Remove "${pl.name}"? You can always add it again.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => deletePlaylist(pl.id),
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
      <Text style={[styles.pageTitle, { color: colors.text }]}>Settings</Text>

      <SectionTitle title="My Playlists" colors={colors} />
      {playlists.length === 0 ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <InfoRow label="Status" value="No playlists added" valueColor={colors.warning} colors={colors} />
        </View>
      ) : (
        playlists.map((pl, idx) => {
          const isActive = pl.id === activePlaylist?.id;
          return (
            <View
              key={pl.id}
              style={[
                styles.playlistCard,
                {
                  backgroundColor: isActive ? colors.primary + "12" : colors.surface,
                  borderColor: isActive ? colors.primary : colors.border,
                },
              ]}
            >
              <View style={styles.playlistHeader}>
                <View style={styles.playlistTitleRow}>
                  {isActive && (
                    <View style={[styles.activeDot, { backgroundColor: colors.primary }]} />
                  )}
                  <Text style={[styles.playlistName, { color: colors.text }]} numberOfLines={1}>
                    {pl.name}
                  </Text>
                  <View
                    style={[
                      styles.typeBadge,
                      { backgroundColor: pl.type === "xtream" ? colors.primary + "22" : colors.success + "22" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeBadgeText,
                        { color: pl.type === "xtream" ? colors.primary : colors.success },
                      ]}
                    >
                      {pl.type === "xtream" ? "Xtream" : "M3U"}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.playlistSub, { color: colors.textMuted }]} numberOfLines={1}>
                  {pl.type === "xtream" ? `${pl.host} · ${pl.username}` : pl.url}
                </Text>
              </View>

              <View style={[styles.playlistActions, { borderTopColor: colors.border }]}>
                {!isActive && (
                  <Pressable
                    onPress={() => connectPlaylist(pl.id)}
                    style={({ pressed }) => [
                      styles.plAction,
                      { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1, borderRadius: 8 },
                    ]}
                  >
                    <Feather name="play" size={13} color="#FFF" />
                    <Text style={[styles.plActionText, { color: "#FFF" }]}>Connect</Text>
                  </Pressable>
                )}
                {isActive && (
                  <View style={[styles.plAction, { backgroundColor: colors.primary + "20", borderRadius: 8 }]}>
                    <Feather name="check" size={13} color={colors.primary} />
                    <Text style={[styles.plActionText, { color: colors.primary }]}>Connected</Text>
                  </View>
                )}
                <Pressable
                  onPress={() => router.push(`/add-playlist?editId=${pl.id}`)}
                  style={({ pressed }) => [
                    styles.plIconBtn,
                    { backgroundColor: colors.surfaceHigh, opacity: pressed ? 0.6 : 1, borderRadius: 8 },
                  ]}
                >
                  <Feather name="edit-2" size={14} color={colors.textSecondary} />
                </Pressable>
                <Pressable
                  onPress={() => handleDeletePlaylist(pl)}
                  style={({ pressed }) => [
                    styles.plIconBtn,
                    { backgroundColor: colors.destructive + "18", opacity: pressed ? 0.6 : 1, borderRadius: 8 },
                  ]}
                >
                  <Feather name="trash-2" size={14} color={colors.destructive} />
                </Pressable>
              </View>
            </View>
          );
        })
      )}

      <Pressable
        onPress={() => router.push("/add-playlist")}
        style={({ pressed }) => [
          styles.addBtn,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Feather name="plus-circle" size={18} color={colors.primary} />
        <Text style={[styles.addBtnText, { color: colors.primary }]}>Add Playlist</Text>
      </Pressable>

      {accountInfo && activePlaylist?.type === "xtream" && (
        <>
          <SectionTitle title="IPTV Account" colors={colors} />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <InfoRow
              label="Status"
              value={accountInfo.isTrial ? `Trial (${accountInfo.status})` : accountInfo.status}
              valueColor={acctStatusColor}
              colors={colors}
            />
            <Divider colors={colors} />
            <InfoRow
              label="Expires"
              value={
                accountInfo.expDate
                  ? `${fmtTimestamp(accountInfo.expDate)}${
                      daysRemaining !== null
                        ? daysRemaining > 0
                          ? ` · ${daysRemaining}d left`
                          : ` · Expired ${Math.abs(daysRemaining)}d ago`
                        : ""
                    }`
                  : "Never"
              }
              valueColor={
                daysRemaining !== null && daysRemaining <= 7
                  ? daysRemaining <= 0
                    ? colors.destructive
                    : colors.warning
                  : undefined
              }
              colors={colors}
            />
            <Divider colors={colors} />
            <InfoRow
              label="Connections"
              value={`${accountInfo.activeConnections} / ${accountInfo.maxConnections}`}
              colors={colors}
            />
          </View>
        </>
      )}

      <SectionTitle title="Device License" colors={colors} />
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

      {activePlaylist && (
        <>
          <SectionTitle title="Privacy" colors={colors} />
          <Pressable
            onPress={handleClearHistory}
            disabled={clearing}
            style={({ pressed }) => [
              styles.actionRow,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed || clearing ? 0.6 : 1,
              },
            ]}
          >
            <Feather name="clock" size={18} color={colors.destructive} />
            <Text style={[styles.actionText, { color: colors.destructive }]}>
              {clearing ? "Clearing…" : "Clear Watch History"}
            </Text>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </Pressable>
        </>
      )}

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
  return <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>;
}

function InfoRow({
  label, value, mono, valueColor, colors,
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
  pageTitle: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5, marginBottom: 4 },
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
  playlistCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  playlistHeader: { padding: 14, gap: 4 },
  playlistTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  activeDot: { width: 8, height: 8, borderRadius: 4 },
  playlistName: { fontSize: 15, fontWeight: "600", flex: 1 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeBadgeText: { fontSize: 11, fontWeight: "700" },
  playlistSub: { fontSize: 12 },
  playlistActions: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
  },
  plAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
  },
  plActionText: { fontSize: 13, fontWeight: "600" },
  plIconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  addBtnText: { fontSize: 15, fontWeight: "600" },
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
