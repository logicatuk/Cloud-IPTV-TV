import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

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
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: isActive ? colors.primary + "18" : colors.surface,
          borderColor: isActive ? colors.primary : colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Image
        source={{ uri: channel.icon }}
        style={styles.logo}
        contentFit="contain"
        transition={200}
      />
      <View style={styles.info}>
        <Text
          style={[styles.name, { color: isActive ? colors.primary : colors.text }]}
          numberOfLines={1}
        >
          {channel.name}
        </Text>
        {channel.current_epg?.title ? (
          <Text style={[styles.epg, { color: colors.textMuted }]} numberOfLines={1}>
            {channel.current_epg.title}
          </Text>
        ) : null}
      </View>
      {isActive && (
        <View style={[styles.liveDot, { backgroundColor: colors.primary }]} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  logo: { width: 48, height: 36, borderRadius: 6 },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: "600" },
  epg: { fontSize: 12 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
});
