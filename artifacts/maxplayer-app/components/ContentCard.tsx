import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

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
        placeholder={{ thumbhash: undefined }}
      />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.9)"]}
        style={[StyleSheet.absoluteFill, { borderRadius: colors.radius }]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 0, y: 1 }}
      />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
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
    padding: 8,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  meta: {
    color: "#9A9A9A",
    fontSize: 11,
    marginTop: 2,
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
        <Text style={wideStyles.title} numberOfLines={2}>
          {title}
        </Text>
        {meta ? <Text style={wideStyles.meta}>{meta}</Text> : null}
        {meta2 ? <Text style={wideStyles.meta}>{meta2}</Text> : null}
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
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  meta: {
    color: "#9A9A9A",
    fontSize: 12,
  },
});
