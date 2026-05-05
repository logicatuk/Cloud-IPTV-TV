import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

function SkeletonBox({ width, height, borderRadius = 8 }: { width: number | string; height: number; borderRadius?: number }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.8, duration: 700, useNativeDriver: false }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: false }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width: width as number, height, borderRadius, opacity },
      ]}
    />
  );
}

export function LoadingGrid({ columns = 2, rows = 3, cardHeight = 180 }: { columns?: number; rows?: number; cardHeight?: number }) {
  const cardWidth = `${Math.floor(100 / columns) - 2}%`;
  return (
    <View style={styles.grid}>
      {Array.from({ length: columns * rows }).map((_, i) => (
        <SkeletonBox key={i} width={cardWidth} height={cardHeight} />
      ))}
    </View>
  );
}

export function LoadingRow({ count = 5, cardWidth = 120, cardHeight = 180 }: { count?: number; cardWidth?: number; cardHeight?: number }) {
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
