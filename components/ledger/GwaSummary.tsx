import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import DonutChart from './DonutChart';
import { getTheme, Radius, Shadows } from '../../constants/Theme';
import { getGradeQuote } from '../../utils/quotes';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface GwaSummaryProps {
    semGwa: number;
    yearGwa: number;
    cumGwa: number;
    semPercent: number;
    yearPercent: number;
    cumPercent: number;
    system: string;
}

export default function GwaSummary({ semGwa, yearGwa, cumGwa, semPercent, yearPercent, cumPercent, system }: GwaSummaryProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);

    const [heroHeight, setHeroHeight] = React.useState(160);
    const cumDisplayVal = (system === 'PERCENT') ? `${cumPercent.toFixed(1)}%` : Number(cumGwa || 0).toFixed(3);

    const getIndicatorText = (gwa: number, percent: number) => {
        if (!gwa && !percent) return 'No Grades';
        if (percent >= 90) return 'Outstanding';
        if (percent >= 75) return 'On Track';
        if (percent >= 60) return 'Passing';
        return 'Needs Work';
    };

    // Ring chart values for the hero card
    const R = 42;
    const C = 2 * Math.PI * R;
    let p = cumPercent ?? 0;
    if (isNaN(p)) p = 0;
    p = Math.max(0, Math.min(100, p));
    const targetOffset = C - (p / 100) * C;

    const animatedOffset = useSharedValue(C);
    React.useEffect(() => {
        animatedOffset.value = withTiming(targetOffset, {
            duration: 1200,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
        });
    }, [targetOffset]);

    const animatedProps = useAnimatedProps(() => ({
        strokeDashoffset: animatedOffset.value,
    }));

    const defaultColor = isDark ? '#94a3b8' : '#cbd5e1';
    let ringColor = defaultColor;
    if (p >= 90) { ringColor = '#22c55e'; }
    else if (p >= 75) { ringColor = '#3b82f6'; }
    else if (p >= 60) { ringColor = '#eab308'; }
    else if (p > 0) { ringColor = '#ef4444'; }

    const trackColor = isDark ? '#334155' : '#e2e8f0';

    return (
        <View style={{ width: '100%', marginBottom: 16 }}>
            {/* R1: Hero Card for Overall/Cumulative GWA */}
            <View
                onLayout={(e) => setHeroHeight(e.nativeEvent.layout.height)}
                style={{
                    borderRadius: Radius['3xl'],
                    overflow: 'hidden',
                    marginBottom: 16,
                    position: 'relative',
                    backgroundColor: isDark ? '#1e1b4b' : '#6366f1',
                    borderWidth: 0,
                    ...(!isDark ? Shadows.lg : {}),
                }}
            >
                {/* Gradient Background */}
                <Svg height={heroHeight} width="100%" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                    <Defs>
                        <LinearGradient id="heroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor={isDark ? '#312e81' : '#4f46e5'} />
                            <Stop offset="100%" stopColor={isDark ? '#1e1b4b' : '#6366f1'} />
                        </LinearGradient>
                    </Defs>
                    <Rect width="100%" height="100%" fill="url(#heroGrad)" />
                    <Circle cx="100%" cy="0%" r="80" fill="rgba(255,255,255,0.06)" />
                    <Circle cx="0%" cy="100%" r="60" fill="rgba(255,255,255,0.04)" />
                </Svg>

                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20 }}>
                    {/* Animated Ring */}
                    <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center', position: 'relative', marginRight: 20 }}>
                        <Svg width="96" height="96" viewBox="0 0 96 96" style={{ position: 'absolute' }}>
                            <Circle
                                cx="48" cy="48" r={R}
                                stroke="rgba(255,255,255,0.2)"
                                strokeWidth="6"
                                fill="transparent"
                            />
                            <AnimatedCircle
                                cx="48" cy="48" r={R}
                                stroke="#ffffff"
                                strokeWidth="6"
                                fill="transparent"
                                strokeDasharray={C}
                                animatedProps={animatedProps}
                                strokeLinecap="round"
                                transform="rotate(-90 48 48)"
                            />
                        </Svg>
                        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                            <Text
                                adjustsFontSizeToFit
                                numberOfLines={1}
                                style={{
                                    fontSize: 22,
                                    fontFamily: 'Nunito_900Black',
                                    color: '#ffffff',
                                    letterSpacing: -0.5,
                                }}
                            >
                                {cumDisplayVal}
                            </Text>
                            <Text style={{
                                fontSize: 9,
                                fontFamily: 'Nunito_800Bold',
                                letterSpacing: 1,
                                color: 'rgba(255,255,255,0.85)',
                                textTransform: 'uppercase',
                                marginTop: 2,
                            }}>
                                GWA
                            </Text>
                        </View>
                    </View>

                    {/* Right side: Label, indicator, quote */}
                    <View style={{ flex: 1 }}>
                        <Text style={{
                            fontSize: 12,
                            fontFamily: 'Nunito_800Bold',
                            textTransform: 'uppercase',
                            letterSpacing: 1.2,
                            color: '#e0e7ff',
                            marginBottom: 6,
                        }}>
                            Overall GWA
                        </Text>

                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginBottom: 8,
                        }}>
                            <View style={{
                                width: 10, height: 10, borderRadius: 5, marginRight: 8,
                                backgroundColor: (!cumGwa && !cumPercent) ? 'rgba(255,255,255,0.4)' : (cumPercent >= 90 ? '#4ade80' : cumPercent >= 75 ? '#60a5fa' : cumPercent >= 60 ? '#fbbf24' : '#fb7185')
                            }} />
                            <Text style={{
                                fontSize: 16,
                                fontFamily: 'Nunito_800Bold',
                                color: '#ffffff',
                            }}>
                                {getIndicatorText(cumGwa, cumPercent)}
                            </Text>
                        </View>

                        <Text style={{
                            fontSize: 13,
                            fontFamily: 'Nunito_700Bold',
                            color: '#ffffff',
                            opacity: 0.9,
                            lineHeight: 18,
                        }}>
                            {getGradeQuote(cumPercent, (cumGwa > 0 || cumPercent > 0))}
                        </Text>
                    </View>
                </View>
            </View>

            {/* R2: Side-by-side Condensed GWA Cards for Semester & Year */}
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                <DonutChart
                    label="SEMESTER"
                    value={semGwa}
                    percent={semPercent}
                    system={system}
                    indicatorText={getIndicatorText(semGwa, semPercent)}
                />
                <DonutChart
                    label="YEAR"
                    value={yearGwa}
                    percent={yearPercent}
                    system={system}
                    indicatorText={getIndicatorText(yearGwa, yearPercent)}
                />
            </View>
        </View>
    );
}
