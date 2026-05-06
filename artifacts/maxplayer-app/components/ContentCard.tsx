import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { splitTitleYear } from "@/lib/utils";

interface ContentCardProps {
  title: string;
  poster: string;
  meta?: string;
  onPress: () => void;
  width?: number;
  height?: number;
  isFavorite?: boolean;
}

export function ContentCard({
  title,
  poster,
  meta,
  onPress,
  width = 120,
  height = 180,
}: ContentCardProps) {
  const colors = useColors();
  const { title: cleanTitle, year } = splitTitleYear(title);
  const displayMeta = meta ?? year ?? null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { width, height, borderRadius: colors.radius, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <Image
        source={{ uri: poster }}
        style={[StyleSheet.absoluteFill, { borderRadius: colors.radius }]}
        contentFit="cover"
        transition={200}
      />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.92)"]}
        style={[StyleSheet.absoluteFill, { borderRadius: colors.radius }]}
        start={{ x: 0, y: 0.45 }}
        end={{ x: 0, y: 1 }}
      />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {cleanTitle}
        </Text>
        {displayMeta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {displayMeta}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: "#1A1A1A",
  },
  info: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 9,
    gap: 2,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    letterSpacing: -0.1,
  },
  meta: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    fontWeight: "500",
  },
});

interface WideContentCardProps {
  title: string;
  poster: string;
  meta?: string;
  meta2?: string;
  onPress: () => void;
}

export function WideContentCard({ title, poster, meta, meta2, onPress }: WideContentCardProps) {
  const colors = useColors();
  const { title: cleanTitle } = splitTitleYear(title);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        wideStyles.container,
        { borderRadius: colors.radius, opacity: pressed ? 0.75 : 1, borderColor: colors.border },
      ]}
    >
      <Image
        source={{ uri: poster }}
        style={[wideStyles.poster, { borderRadius: colors.radius }]}
        contentFit="cover"
        transition={200}
      />
      <View style={wideStyles.info}>
        <Text style={[wideStyles.title, { color: colors.text }]} numberOfLines={2}>
          {cleanTitle}
        </Text>
        {meta ? <Text style={[wideStyles.meta, { color: colors.textSecondary }]}>{meta}</Text> : null}
        {meta2 ? <Text style={[wideStyles.meta, { color: colors.textMuted }]}>{meta2}</Text> : null}
      </View>
    </Pressable>
  );
}

const wideStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    padding: 10,
    gap: 12,
  },
  poster: {
    width: 60,
    height: 90,
    backgroundColor: "#252525",
  },
  info: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
  },
  meta: {
    fontSize: 12,
  },
});
