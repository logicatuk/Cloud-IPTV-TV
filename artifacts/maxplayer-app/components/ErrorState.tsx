import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = "Something went wrong", onRetry }: ErrorStateProps) {
  const colors = useColors();
  return (
    <View style={styles.container}>
      <Feather name="wifi-off" size={40} color={colors.textMuted} />
      <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retry,
            { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
      )}
    </View>
  );
}

export function EmptyState({ message = "Nothing here yet", icon = "inbox" }: { message?: string; icon?: React.ComponentProps<typeof Feather>["name"] }) {
  const colors = useColors();
  return (
    <View style={styles.container}>
      <Feather name={icon} size={40} color={colors.textMuted} />
      <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 32,
  },
  message: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  retry: {
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
