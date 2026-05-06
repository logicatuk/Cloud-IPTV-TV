import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

function SkeletonBox({
  width,
  height,
  borderRadius = 8,
}: {
  width: number | string;
  height: number;
  borderRadius?: number;
}) {
  const translate = useSharedValue(-300);

  useEffect(() => {
    translate.value = withRepeat(
      withTiming(300, { duration: 1100, easing: Easing.linear }),
      -1
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translate.value }],
  }));

  return (
    <View
      style={[
        styles.skeleton,
        { width: width as number, height, borderRadius, overflow: "hidden" },
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
        <LinearGradient
          colors={[
            "transparent",
            "rgba(255,255,255,0.07)",
            "rgba(255,255,255,0.12)",
            "rgba(255,255,255,0.07)",
            "transparent",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.shimmerGradient}
        />
      </Animated.View>
    </View>
  );
}

export function LoadingGrid({
  columns = 2,
  rows = 3,
  cardHeight = 180,
}: {
  columns?: number;
  rows?: number;
  cardHeight?: number;
}) {
  const cardWidth = `${Math.floor(100 / columns) - 2}%`;
  return (
    <View style={styles.grid}>
      {Array.from({ length: columns * rows }).map((_, i) => (
        <SkeletonBox key={i} width={cardWidth} height={cardHeight} />
      ))}
    </View>
  );
}

export function LoadingRow({
  count = 5,
  cardWidth = 120,
  cardHeight = 180,
}: {
  count?: number;
  cardWidth?: number;
  cardHeight?: number;
}) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBox key={i} width={cardWidth} height={cardHeight} />
      ))}
    </View>
  );
}

export function LoadingList({ count = 8 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.listItem}>
          <SkeletonBox width={44} height={44} borderRadius={8} />
          <View style={styles.listItemText}>
            <SkeletonBox width="70%" height={14} />
            <SkeletonBox width="45%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: "#2A2A2A",
  },
  shimmerGradient: {
    flex: 1,
    width: 200,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 12,
  },
  row: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
  },
  list: {
    gap: 4,
    padding: 12,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
  },
  listItemText: {
    flex: 1,
    gap: 6,
  },
});
