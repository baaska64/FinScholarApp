import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { getTheme, Radius } from '@/constants/Theme';

interface SectionHeaderProps {
  title: string;
  /** Optional count rendered as a quiet pill next to the title. */
  count?: number | string;
  /** One line of context under the title. */
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  /**
   * Domain colour for the leading rail. Section headings carry the same code as
   * the cards beneath them, so the eye can find a section by colour alone.
   */
  railColor?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Section heading for the dashboard. It is deliberately plain type rather than
 * a chip: the cards below it carry the surface, so the heading only has to
 * label them and offer one way out to the full screen.
 */
export default function SectionHeader({
  title,
  count,
  subtitle,
  actionLabel,
  onAction,
  actionIcon,
  railColor,
  style,
}: SectionHeaderProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark);

  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingLeft: 1 },
        style,
      ]}
    >
      {railColor && (
        <View style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: railColor, marginRight: 9 }} />
      )}

      <View style={{ flex: 1, marginRight: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: theme.text, letterSpacing: -0.2 }}
          >
            {title}
          </Text>
          {count !== undefined && count !== null && (
            <View
              style={{
                marginLeft: 8,
                minWidth: 22,
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: Radius.full,
                alignItems: 'center',
                backgroundColor: theme.surfaceSecondary,
              }}
            >
              <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textSecondary }}>
                {count}
              </Text>
            </View>
          )}
        </View>
        {subtitle ? (
          <Text numberOfLines={1} style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textTertiary, marginTop: 1 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {onAction && (
        <TouchableOpacity
          onPress={onAction}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={actionLabel || `Open ${title}`}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 2 }}
        >
          {actionIcon && (
            <Ionicons name={actionIcon} size={14} color={theme.primary} style={{ marginRight: 3 }} />
          )}
          <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 13, color: theme.primary }}>
            {actionLabel || 'View all'}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={theme.primary} style={{ marginLeft: 1 }} />
        </TouchableOpacity>
      )}
    </View>
  );
}
