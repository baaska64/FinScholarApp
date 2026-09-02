import React from 'react';
import { View, StyleProp, ViewStyle, AccessibilityRole } from 'react-native';
import { useColorScheme } from 'nativewind';
import { getTheme, Radius } from '@/constants/Theme';
import AnimatedPressable from '@/components/ui/AnimatedPressable';

interface CardProps {
    children: React.ReactNode;
    onPress?: () => void;
    /** Inner padding. Pass 0 for panels that manage their own sections. */
    padding?: number;
    /** Radius token. Panels default to `xl`; only full-bleed sheets go larger. */
    radius?: number;
    /**
     * `raised` is the default object surface. `sunken` recesses into the page
     * for toolbelts and secondary shelves. `flat` drops the fill entirely and
     * keeps only the outline — for rows that should read as part of the page.
     */
    variant?: 'raised' | 'sunken' | 'flat';
    /** Overrides the fill — pass a domain tint for a card that carries meaning. */
    fill?: string;
    /** Overrides the outline to match a tinted fill. */
    border?: string;
    style?: StyleProp<ViewStyle>;
    accessibilityRole?: AccessibilityRole;
    accessibilityLabel?: string;
    accessibilityHint?: string;
}

/**
 * The one surface in the app.
 *
 * Deliberately has no drop shadow. Depth comes from the tonal step between the
 * page and the fill plus a slightly darker bottom edge, which reads as a solid
 * object resting on the page rather than a sheet of paper hovering above it.
 * That "lip" is the whole trick — a blurred shadow under every element is what
 * made the old screens feel like floating template cards.
 */
export default function Card({
    children,
    onPress,
    padding = 14,
    radius = Radius.xl,
    variant = 'raised',
    fill,
    border,
    style,
    accessibilityRole,
    accessibilityLabel,
    accessibilityHint,
}: CardProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);

    const surface =
        fill ??
        (variant === 'sunken'
            ? (isDark ? 'rgba(0,0,0,0.18)' : theme.surfaceSecondary)
            : variant === 'flat'
                ? 'transparent'
                : theme.surface);

    const outline = border ?? theme.cardBorder;

    const base: ViewStyle = {
        padding,
        borderRadius: radius,
        backgroundColor: surface,
        borderWidth: 1,
        borderColor: outline,
        // The lip: a heavier bottom edge instead of a cast shadow.
        borderBottomWidth: variant === 'sunken' ? 1 : 2,
        borderBottomColor: border ?? (theme.lip),
    };

    if (onPress) {
        return (
            <AnimatedPressable
                onPress={onPress}
                scaleTo={0.985}
                accessibilityRole={accessibilityRole || 'button'}
                accessibilityLabel={accessibilityLabel}
                accessibilityHint={accessibilityHint}
                style={[base, style]}
            >
                {children}
            </AnimatedPressable>
        );
    }

    return (
        <View
            accessibilityRole={accessibilityRole}
            accessibilityLabel={accessibilityLabel}
            style={[base, style]}
        >
            {children}
        </View>
    );
}
