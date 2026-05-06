import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
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
}

export function ChannelCard({ channel, onPress, isActive }: ChannelCardProps) {
  const colors = useColors();
  const displayName = cleanIptvName(channel.name);

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
        {channel.current_epg?.title ? (
          <Text style={[styles.epg, { color: colors.textMuted }]} numberOfLines={1}>
            {channel.current_epg.title}
          </Text>
        ) : null}
      </View>

      {isActive && (
        <View style={[styles.liveChip, { backgroundColor: colors.primary }]}>
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      )}
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
  epg: { fontSize: 12, lineHeight: 16 },
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
});
