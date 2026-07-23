import React from 'react';
import { View, Text, Image, ImageSourcePropType, ViewStyle, StyleProp } from 'react-native';
import { useColorScheme } from 'nativewind';
import { getTheme, Typography, Radius } from '@/constants/Theme';
import AnimatedPressable from './AnimatedPressable';

interface EmptyStateProps {
  image?: ImageSourcePropType;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: string;
  style?: StyleProp<ViewStyle>;
}

export default function EmptyState({
  image,
  title,
  subtitle,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark);

  return (
    <View
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          borderRadius: Radius['4xl'],
          borderWidth: 2,
          borderColor: isDark ? theme.cardBorder : '#f1f5f9',
          backgroundColor: isDark ? theme.surface : theme.surface,
          ...(!isDark ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 } : {}),
        },
        style,
      ]}
    >
      {image && (
        <Image
          source={image}
          style={{ width: 80, height: 80, marginBottom: 20 }}
          resizeMode="contain"
        />
      )}
      <Text style={[Typography.subtitle, { color: theme.text, textAlign: 'center', marginBottom: 8 }]}>
        {title}
      </Text>
      {subtitle && (
        <Text style={[Typography.caption, { color: theme.textTertiary, textAlign: 'center', lineHeight: 20, marginBottom: actionLabel ? 24 : 0 }]}>
          {subtitle}
        </Text>
      )}
      {actionLabel && onAction && (
        <AnimatedPressable
          onPress={onAction}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.primary,
            paddingVertical: 14,
            paddingHorizontal: 28,
            borderRadius: Radius.full,
            ...(!isDark ? { shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 } : {}),
          }}
        >
          <Text style={{ ...Typography.bodyBold, color: '#ffffff' }}>{actionLabel}</Text>
        </AnimatedPressable>
      )}
    </View>
  );
}
