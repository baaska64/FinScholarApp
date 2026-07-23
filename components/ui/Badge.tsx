import React from 'react';
import { View, Text, ViewStyle, StyleProp } from 'react-native';
import { useColorScheme } from 'nativewind';
import { getTheme } from '@/constants/Theme';

type BadgeVariant = 'high' | 'medium' | 'low' | 'success' | 'info' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: StyleProp<ViewStyle>;
}

const VARIANT_COLORS: Record<BadgeVariant, { light: { bg: string; border: string; text: string }; dark: { bg: string; border: string; text: string } }> = {
  high: {
    light: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
    dark: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', text: '#f87171' },
  },
  medium: {
    light: { bg: '#fff7ed', border: '#fed7aa', text: '#ea580c' },
    dark: { bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.4)', text: '#fb923c' },
  },
  low: {
    light: { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a' },
    dark: { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.4)', text: '#4ade80' },
  },
  success: {
    light: { bg: '#ecfdf5', border: '#a7f3d0', text: '#059669' },
    dark: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', text: '#34d399' },
  },
  info: {
    light: { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb' },
    dark: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', text: '#60a5fa' },
  },
  neutral: {
    light: { bg: '#f8fafc', border: '#e2e8f0', text: '#64748b' },
    dark: { bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.4)', text: '#94a3b8' },
  },
};

export default function Badge({ label, variant = 'neutral', style }: BadgeProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = VARIANT_COLORS[variant][isDark ? 'dark' : 'light'];

  return (
    <View
      style={[
        {
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 6,
          backgroundColor: colors.bg,
          borderWidth: 1,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: 10,
          fontFamily: 'Nunito_700Bold',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color: colors.text,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
