import React, { useEffect, useRef } from 'react';
import { View, Animated, ViewStyle, StyleProp } from 'react-native';
import { useColorScheme } from 'nativewind';
import { getTheme, Radius } from '@/constants/Theme';

interface LoadingSkeletonProps {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

function SkeletonBone({ width = '100%', height = 16, radius = 8, style }: LoadingSkeletonProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark);
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius: radius,
          backgroundColor: isDark ? theme.skeleton : theme.skeleton,
          opacity,
        },
        style,
      ]}
    />
  );
}

interface DashboardSkeletonProps {
  style?: StyleProp<ViewStyle>;
}

export function DashboardSkeleton({ style }: DashboardSkeletonProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark);

  return (
    <View style={[{ flex: 1, backgroundColor: theme.background, padding: 24, paddingTop: 60 }, style]}>
      {/* Header skeleton */}
      <SkeletonBone width={140} height={28} radius={8} style={{ marginBottom: 24 }} />
      
      {/* Term selector */}
      <SkeletonBone width="100%" height={52} radius={16} style={{ marginBottom: 20 }} />
      
      {/* Quote bubble */}
      <SkeletonBone width="100%" height={72} radius={24} style={{ marginBottom: 20 }} />
      
      {/* Mascot card */}
      <SkeletonBone width="100%" height={160} radius={32} style={{ marginBottom: 28 }} />
      
      {/* Section header */}
      <SkeletonBone width={120} height={32} radius={16} style={{ marginBottom: 16 }} />
      
      {/* Cards */}
      <SkeletonBone width="100%" height={80} radius={24} style={{ marginBottom: 12 }} />
      <SkeletonBone width="100%" height={80} radius={24} style={{ marginBottom: 12 }} />
      <SkeletonBone width="100%" height={80} radius={24} />
    </View>
  );
}

interface ListSkeletonProps {
  count?: number;
  cardHeight?: number;
  style?: StyleProp<ViewStyle>;
}

export function ListSkeleton({ count = 4, cardHeight = 80, style }: ListSkeletonProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark);

  return (
    <View style={[{ flex: 1, backgroundColor: theme.background, padding: 24, paddingTop: 60 }, style]}>
      <SkeletonBone width={160} height={28} radius={8} style={{ marginBottom: 24 }} />
      <SkeletonBone width="100%" height={52} radius={16} style={{ marginBottom: 24 }} />
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBone key={i} width="100%" height={cardHeight} radius={24} style={{ marginBottom: 12 }} />
      ))}
    </View>
  );
}

export default SkeletonBone;
