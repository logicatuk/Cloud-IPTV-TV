import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
export interface Channel {
  id: number;
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
        styles.container,
        {
          backgroundColor: isActive ? colors.primary + "22" : colors.surface,
          borderColor: isActive ? colors.primary : colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={[styles.logo, { backgroundColor: colors.surfaceHigh, borderRadius: colors.radius - 2 }]}>
        {channel.icon ? (
          <Image
            source={{ uri: channel.icon }}
            style={styles.logoImg}
            contentFit="contain"
            transition={150}
          />
        ) : (
          <Text style={styles.logoFallback}>{channel.name.charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: isActive ? colors.primary : colors.text }]} numberOfLines={1}>
          {channel.name}
        </Text>
        {channel.current_epg?.title ? (
          <Text style={[styles.epg, { color: colors.textSecondary }]} numberOfLines={1}>
            {channel.current_epg.title}
          </Text>
        ) : null}
      </View>
      {isActive && (
        <View style={[styles.playDot, { backgroundColor: colors.primary }]} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderWidth: 1,
    gap: 10,
    marginBottom: 4,
  },
  logo: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImg: {
    width: 44,
    height: 44,
  },
  logoFallback: {
    color: "#9A9A9A",
    fontSize: 18,
    fontWeight: "700",
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
  },
  epg: {
    fontSize: 12,
  },
  playDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
