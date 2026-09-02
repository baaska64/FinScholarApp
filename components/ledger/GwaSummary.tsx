import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import Card from '@/components/ui/Card';
import { getTheme, getTints, Radius } from '../../constants/Theme';
import { getGradeTierColor, getGradeTierLabel } from '../../utils/gradeTiers';
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
    /** Human label for the active grading system, shown on the footer row. */
    systemLabel?: string;
    /** Opens the ledger settings sheet. The footer row is hidden without it. */
    onOpenSettings?: () => void;
}

/**
 * The standing panel: one card, three figures.
 *
 * This used to be a saturated indigo gradient hero plus two donut cards —
 * roughly 360pt of chart before a student reached a single subject, with the
 * one number that actually moves while they enter grades (the semester) given
 * the smallest ring of the three. Now the semester leads, the year and overall
 * figures sit under it as two quiet columns, and the whole thing is a normal
 * `Card` so it obeys the app's lip-not-shadow depth rule.
 */
export default function GwaSummary({
    semGwa,
    yearGwa,
    cumGwa,
    semPercent,
    yearPercent,
    cumPercent,
    system,
    systemLabel,
    onOpenSettings,
}: GwaSummaryProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const tints = getTints(isDark);

    const format = (gwa: number, percent: number) =>
        system === 'PERCENT' ? `${(Number(percent) || 0).toFixed(1)}%` : Number(gwa || 0).toFixed(3);

    const semHasData = Boolean(semGwa || semPercent);
    const yearHasData = Boolean(yearGwa || yearPercent);
    const cumHasData = Boolean(cumGwa || cumPercent);

    const semColor = getGradeTierColor(semPercent, isDark, semHasData);

    // ── Ring geometry for the semester figure
    const R = 36;
    const C = 2 * Math.PI * R;
    let p = Number(semPercent);
    if (!Number.isFinite(p)) p = 0;
    p = Math.max(0, Math.min(100, p));
    const targetOffset = C - (p / 100) * C;

    const animatedOffset = useSharedValue(C);
    React.useEffect(() => {
        animatedOffset.value = withTiming(targetOffset, {
            duration: 1000,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
        });
    }, [targetOffset]);

    const animatedProps = useAnimatedProps(() => ({
        strokeDashoffset: animatedOffset.value,
    }));

    const microLabel = {
        fontFamily: 'Nunito_800ExtraBold' as const,
        fontSize: 10,
        letterSpacing: 0.8,
        textTransform: 'uppercase' as const,
        color: theme.textTertiary,
    };

    const columns = [
        { key: 'year', label: 'This year', value: format(yearGwa, yearPercent), percent: yearPercent, hasData: yearHasData },
        { key: 'cum', label: 'Overall', value: format(cumGwa, cumPercent), percent: cumPercent, hasData: cumHasData },
    ];

    return (
        <Card padding={0} radius={Radius['2xl']} style={{ overflow: 'hidden', marginBottom: 16 }}>
            {/* ── Semester: the figure that moves while you enter grades ────── */}
            <View
                accessible
                accessibilityLabel={`This semester's GWA is ${semHasData ? format(semGwa, semPercent) : 'not calculated yet'}. ${getGradeTierLabel(semPercent, semHasData)}.`}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    backgroundColor: tints.grades.fill,
                    borderBottomWidth: 1,
                    borderBottomColor: tints.grades.line,
                }}
            >
                <View style={{ width: 84, height: 84, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                    <Svg width="84" height="84" viewBox="0 0 84 84" style={{ position: 'absolute' }}>
                        <Circle
                            cx="42" cy="42" r={R}
                            stroke={isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)'}
                            strokeWidth="7"
                            fill="transparent"
                        />
                        <AnimatedCircle
                            cx="42" cy="42" r={R}
                            stroke={semColor}
                            strokeWidth="7"
                            fill="transparent"
                            strokeDasharray={C}
                            animatedProps={animatedProps}
                            strokeLinecap="round"
                            transform="rotate(-90 42 42)"
                        />
                    </Svg>
                    <Text
                        adjustsFontSizeToFit
                        numberOfLines={1}
                        style={{
                            fontFamily: 'Nunito_900Black',
                            fontSize: 21,
                            color: theme.text,
                            letterSpacing: -0.6,
                            maxWidth: 58,
                        }}
                    >
                        {semHasData ? format(semGwa, semPercent) : '—'}
                    </Text>
                </View>

                <View style={{ flex: 1 }}>
                    <Text style={microLabel}>This semester</Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 5 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: semColor, marginRight: 7 }} />
                        <Text numberOfLines={1} style={{ flex: 1, fontFamily: 'Nunito_900Black', fontSize: 16, color: theme.text, letterSpacing: -0.3 }}>
                            {getGradeTierLabel(semPercent, semHasData)}
                        </Text>
                    </View>

                    <Text numberOfLines={2} style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textSecondary, lineHeight: 17 }}>
                        {getGradeQuote(semPercent, semHasData)}
                    </Text>
                </View>
            </View>

            {/* ── Year and overall: context, not the headline ────────────────── */}
            <View style={{ flexDirection: 'row' }}>
                {columns.map((col, i) => (
                    <View
                        key={col.key}
                        accessible
                        accessibilityLabel={`${col.label}: ${col.hasData ? col.value : 'no grades yet'}`}
                        style={{
                            flex: 1,
                            paddingHorizontal: 14,
                            paddingTop: 11,
                            paddingBottom: 12,
                            borderLeftWidth: i === 0 ? 0 : 1,
                            borderLeftColor: theme.cardBorder,
                        }}
                    >
                        <View style={{
                            height: 3, width: 22, borderRadius: 2, marginBottom: 8,
                            backgroundColor: getGradeTierColor(col.percent, isDark, col.hasData),
                        }} />
                        <Text numberOfLines={1} style={microLabel}>{col.label}</Text>
                        <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            style={{ fontFamily: 'Nunito_900Black', fontSize: 22, color: theme.text, letterSpacing: -0.7, marginTop: 3 }}
                        >
                            {col.hasData ? col.value : '—'}
                        </Text>
                        <Text numberOfLines={1} style={{ fontFamily: 'Nunito_700Bold', fontSize: 10.5, color: theme.textTertiary, marginTop: 2 }}>
                            {getGradeTierLabel(col.percent, col.hasData)}
                        </Text>
                    </View>
                ))}
            </View>

            {/* ── Grading system lives with the numbers it formats ───────────── */}
            {onOpenSettings && (
                <TouchableOpacity
                    onPress={onOpenSettings}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Ledger settings. Grading system is ${systemLabel || 'set'}.`}
                    style={{
                        flexDirection: 'row', alignItems: 'center',
                        paddingHorizontal: 14, paddingVertical: 11,
                        borderTopWidth: 1, borderTopColor: theme.cardBorder,
                        backgroundColor: isDark ? 'rgba(0,0,0,0.14)' : theme.surfaceSecondary,
                    }}
                >
                    <Ionicons name="options-outline" size={14} color={theme.textTertiary} style={{ marginRight: 7 }} />
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textSecondary }}>
                        Grading system
                    </Text>
                    <View style={{ flex: 1 }} />
                    <Text numberOfLines={1} style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: theme.text, marginRight: 3, flexShrink: 1 }}>
                        {systemLabel}
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={theme.textTertiary} />
                </TouchableOpacity>
            )}
        </Card>
    );
}
