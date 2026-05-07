import React, { useEffect } from "react";
import type { ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

interface FadeViewProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  duration?: number;
  slideDistance?: number;
}

export function FadeView({
  children,
  style,
  duration = 220,
  slideDistance = 18,
}: FadeViewProps) {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(slideDistance);

  useEffect(() => {
    opacity.value = withTiming(1, { duration, easing: Easing.out(Easing.quad) });
    translateX.value = withTiming(0, { duration, easing: Easing.out(Easing.quad) });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={[{ flex: 1 }, animStyle, style]}>
      {children}
    </Animated.View>
  );
}
