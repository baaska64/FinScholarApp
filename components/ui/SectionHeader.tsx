import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { getTheme, Typography } from '@/constants/Theme';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}

export default function SectionHeader({
  title,
  actionLabel,
  onAction,
  actionIcon = 'arrow-forward-circle',
  style,
}: SectionHeaderProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark);

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingHorizontal: 4 }, style]}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 7,
          borderRadius: 9999,
          backgroundColor: isDark ? theme.surface : theme.surface,
          ...(!isDark ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 } : {}),
          borderWidth: 1,
          borderColor: isDark ? theme.cardBorder : 'transparent',
        }}
      >
        <Text
          style={[
            Typography.label,
            { textTransform: 'uppercase', letterSpacing: 1.2, color: isDark ? theme.textSecondary : theme.textSecondary },
          ]}
        >
          {title}
        </Text>
      </View>

      {onAction && (
        <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          {actionLabel ? (
            <Text style={{ ...Typography.captionBold, color: theme.primary }}>{actionLabel}</Text>
          ) : (
            <Ionicons name={actionIcon} size={28} color={isDark ? theme.textSecondary : theme.textTertiary} />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}
