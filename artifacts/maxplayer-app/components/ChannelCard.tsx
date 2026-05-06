import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { EpgEntry } from "@/lib/xtream";
import { cleanIptvName } from "@/lib/utils";

export interface Channel {
  id: string;
  name: string;
  icon: string;
  category_id?: string;
  epg_channel_id?: string;
  current_epg?: { title?: string; description?: string } | null;
}

interface ChannelCardProps {
  channel: Channel;
  onPress: () => void;
  isActive?: boolean;
  epgNow?: EpgEntry | null;
  onGuidePress?: () => void;
}

export function ChannelCard({ channel, onPress, isActive, epgNow, onGuidePress }: ChannelCardProps) {
  const colors = useColors();
  const displayName = cleanIptvName(channel.name);

  const now = Math.floor(Date.now() / 1000);
  const epgProgress =
    epgNow && now >= epgNow.startTimestamp && now < epgNow.endTimestamp
      ? Math.min(1, (now - epgNow.startTimestamp) / (epgNow.endTimestamp - epgNow.startTimestamp))
      : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: isActive
            ? colors.primary + "14"
            : pressed
            ? colors.surface
            : "transparent",
        },
      ]}
    >
      {isActive && (
        <View style={[styles.activeBar, { backgroundColor: colors.primary }]} />
      )}

      <View style={[styles.logoWrap, { backgroundColor: colors.surface }]}>
        <Image
          source={{ uri: channel.icon }}
          style={styles.logo}
          contentFit="contain"
          transition={200}
        />
      </View>

      <View style={styles.info}>
        <Text
          style={[styles.name, { color: isActive ? colors.primary : colors.text }]}
          numberOfLines={1}
        >
          {displayName}
        </Text>

        {epgNow ? (
          <View style={styles.epgWrap}>
            <Text style={[styles.epgTitle, { color: colors.textMuted }]} numberOfLines={1}>
              {epgNow.title}
            </Text>
            {epgProgress !== null && (
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: isActive ? colors.primary : colors.textMuted,
                      width: `${Math.round(epgProgress * 100)}%`,
                    },
                  ]}
                />
              </View>
            )}
          </View>
        ) : channel.current_epg?.title ? (
          <Text style={[styles.epgTitle, { color: colors.textMuted }]} numberOfLines={1}>
            {channel.current_epg.title}
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        {isActive && (
          <View style={[styles.liveChip, { backgroundColor: colors.primary }]}>
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
        {onGuidePress && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onGuidePress();
            }}
            hitSlop={8}
            style={[styles.guideBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Feather name="list" size={13} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    minHeight: 64,
  },
  activeBar: {
    position: "absolute",
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 2,
  },
  logoWrap: {
    width: 64,
    height: 44,
    borderRadius: 8,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 60, height: 40 },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 14, fontWeight: "600", letterSpacing: -0.1 },
  epgWrap: { gap: 4 },
  epgTitle: { fontSize: 12, lineHeight: 16 },
  progressTrack: {
    height: 2,
    borderRadius: 1,
    overflow: "hidden",
  },
  progressFill: { height: 2, borderRadius: 1 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  guideBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
