import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PlayerScreen() {
  const { url, title } = useLocalSearchParams<{ url: string; title: string }>();
  const insets = useSafeAreaInsets();
  const [showControls, setShowControls] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  const player = useVideoPlayer(url ?? "", (p) => {
    p.play();
  });

  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3500);
  }, []);

  useEffect(() => {
    scheduleHide();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [scheduleHide]);

  useEffect(() => {
    if (!player) return;
    const statusSub = player.addListener("statusChange", (status) => {
      setIsBuffering(status.status === "loading");
      setIsPlaying(player.playing);
    });
    const playingSub = player.addListener("playingChange", (p) => {
      setIsPlaying(p.isPlaying);
    });

    const interval = setInterval(() => {
      if (player) {
        setPositionMs((player.currentTime ?? 0) * 1000);
        setDurationMs((player.duration ?? 0) * 1000);
      }
    }, 500);

    return () => {
      statusSub.remove();
      playingSub.remove();
      clearInterval(interval);
    };
  }, [player]);

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0)
      return `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  };

  const toggleControls = () => {
    setShowControls((v) => {
      if (!v) scheduleHide();
      return !v;
    });
  };

  const togglePlay = async () => {
    Haptics.selectionAsync();
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
    scheduleHide();
  };

  const seek = (deltaMs: number) => {
    if (!player) return;
    Haptics.selectionAsync();
    const newTime = Math.max(0, (player.currentTime ?? 0) + deltaMs / 1000);
    player.currentTime = newTime;
    scheduleHide();
  };

  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={false}
      />

      {isBuffering && (
        <View style={styles.bufferOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}

      <Pressable style={StyleSheet.absoluteFill} onPress={toggleControls} />

      {showControls && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <Pressable
              onPress={() => {
                player.pause();
                router.back();
              }}
              style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Feather name="chevron-down" size={28} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.titleText} numberOfLines={1}>
              {title ?? ""}
            </Text>
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.centerControls}>
            <Pressable
              onPress={() => seek(-10000)}
              style={({ pressed }) => [styles.ctrlBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Feather name="rotate-ccw" size={28} color="#FFFFFF" />
              <Text style={styles.ctrlLabel}>10</Text>
            </Pressable>
            <Pressable
              onPress={togglePlay}
              style={({ pressed }) => [
                styles.playBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name={isPlaying ? "pause" : "play"} size={36} color="#FFFFFF" />
            </Pressable>
            <Pressable
              onPress={() => seek(10000)}
              style={({ pressed }) => [styles.ctrlBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Feather name="rotate-cw" size={28} color="#FFFFFF" />
              <Text style={styles.ctrlLabel}>10</Text>
            </Pressable>
          </View>

          {durationMs > 0 && (
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
              <Text style={styles.timeText}>{fmt(positionMs)}</Text>
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { width: `${progress * 100}%` as any }]}
                />
              </View>
              <Text style={styles.timeText}>{fmt(durationMs)}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  bufferOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  titleText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  centerControls: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 40,
  },
  ctrlBtn: {
    alignItems: "center",
    gap: 4,
  },
  ctrlLabel: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  timeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "500",
    minWidth: 40,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#0A84FF",
    borderRadius: 2,
  },
});
