import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing } from 'react-native-reanimated';
import { useColorScheme } from 'nativewind';
import { getTheme, Radius, Shadows } from '../../constants/Theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface DonutChartProps {
    label: string;
    value: number;
    percent: number;
    system: string;
    indicatorText?: string;
}

export default function DonutChart({ label, value, percent, system, indicatorText }: DonutChartProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);

    const R = 28;
    const C = 2 * Math.PI * R;
    
    let p = percent ?? 0;
    if (isNaN(p)) p = 0;
    p = Math.max(0, Math.min(100, p));
    
    const defaultColor = isDark ? '#94a3b8' : '#cbd5e1';
    let color = defaultColor;
    
    if (p >= 90) { color = '#22c55e'; } 
    else if (p >= 75) { color = '#3b82f6'; } 
    else if (p >= 60) { color = '#eab308'; } 
    else if (p > 0) { color = '#ef4444'; } 

    const displayVal = (system === 'PERCENT') ? `${p.toFixed(1)}%` : Number(value || 0).toFixed(3);
    const targetOffset = C - (p / 100) * C;

    const animatedOffset = useSharedValue(C);

    useEffect(() => {
        animatedOffset.value = withTiming(targetOffset, {
            duration: 1000,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
        });
    }, [targetOffset]);

    const animatedProps = useAnimatedProps(() => {
        return {
            strokeDashoffset: animatedOffset.value,
        };
    });

    const trackColor = isDark ? "#334155" : "#e2e8f0";

    return (
        <View 
            style={{
                flex: 1,
                padding: 16,
                borderRadius: Radius['3xl'],
                backgroundColor: theme.card,
                borderWidth: 1,
                borderColor: theme.cardBorder,
                alignItems: 'center',
                ...(!isDark ? Shadows.md : {}),
            }}
        >
            <Text 
                style={{
                    fontSize: 11,
                    fontFamily: 'Nunito_800Bold',
                    textTransform: 'uppercase',
                    letterSpacing: 1.2,
                    marginBottom: 12,
                    color: isDark ? '#94a3b8' : theme.primary,
                }}
            >
                {label}
            </Text>
            
            <View style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center', position: 'relative', marginBottom: 12 }}>
                <Svg width="72" height="72" viewBox="0 0 72 72" style={{ position: 'absolute' }}>
                    <Circle 
                        cx="36" cy="36" r={R} 
                        stroke={trackColor}
                        strokeWidth="6" 
                        fill="transparent" 
                    />
                    <AnimatedCircle 
                        cx="36" cy="36" r={R} 
                        stroke={color} 
                        strokeWidth="6" 
                        fill="transparent"
                        strokeDasharray={C}
                        animatedProps={animatedProps}
                        strokeLinecap="round"
                        transform="rotate(-90 36 36)"
                    />
                </Svg>
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <Text 
                        adjustsFontSizeToFit
                        numberOfLines={1}
                        style={{
                            fontSize: 14,
                            fontFamily: 'Nunito_900Black',
                            color: theme.text,
                        }}
                    >
                        {displayVal}
                    </Text>
                    <Text 
                        style={{
                            fontSize: 8,
                            fontFamily: 'Nunito_800Bold',
                            letterSpacing: 0.8,
                            color: theme.textTertiary,
                            textTransform: 'uppercase',
                        }}
                    >
                        GWA
                    </Text>
                </View>
            </View>

            {indicatorText && (
                <View 
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: Radius.full,
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
                        borderWidth: 1,
                        borderColor: isDark ? '#334155' : '#f1f5f9',
                    }}
                >
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginRight: 6 }} />
                    <Text style={{ fontSize: 11, fontFamily: 'Nunito_700Bold', color: theme.textSecondary }}>
                        {indicatorText}
                    </Text>
                </View>
            )}
        </View>
    );
}

