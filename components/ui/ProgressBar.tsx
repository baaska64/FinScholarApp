import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleProp, ViewStyle } from 'react-native';
import { useColorScheme } from 'nativewind';
import { getTheme, Radius } from '@/constants/Theme';

interface ProgressBarProps {
    /** 0–1. Values outside the range are clamped. */
    progress: number;
    height?: number;
    color?: string;
    trackColor?: string;
    /** Skips the fill animation — use for bars inside a horizontal list. */
    animate?: boolean;
    style?: StyleProp<ViewStyle>;
    accessibilityLabel?: string;
}

/**
 * The one progress bar in the app. Every place that shows completion — the
 * semester timeline, a subject's task progress, the getting-started checklist —
 * uses this so the weight, radius and motion read as one component.
 */
export default function ProgressBar({
    progress,
    height = 6,
    color,
    trackColor,
    animate = true,
    style,
    accessibilityLabel,
}: ProgressBarProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);

    const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
    const anim = useRef(new Animated.Value(animate ? 0 : clamped)).current;

    useEffect(() => {
        if (!animate) {
            anim.setValue(clamped);
            return;
        }
        Animated.timing(anim, {
            toValue: clamped,
            duration: 420,
            // Width cannot run on the native driver.
            useNativeDriver: false,
        }).start();
    }, [clamped, animate]);

    return (
        <View
            accessibilityRole="progressbar"
            accessibilityLabel={accessibilityLabel}
            accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
            style={[
                {
                    height,
                    borderRadius: Radius.full,
                    backgroundColor: trackColor || (isDark ? 'rgba(148,163,184,0.18)' : theme.surfaceSecondary),
                    overflow: 'hidden',
                },
                style,
            ]}
        >
            <Animated.View
                style={{
                    height: '100%',
                    borderRadius: Radius.full,
                    backgroundColor: color || theme.primary,
                    width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }}
            />
        </View>
    );
}
