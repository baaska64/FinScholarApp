import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useColorScheme } from 'nativewind';
import { getTheme, Radius } from '@/constants/Theme';
import { addMonths } from '@/utils/calendarModel';

interface MonthStripProps {
    /** First of the month currently shown. */
    anchor: Date;
    today: Date;
    onSelect: (month: Date) => void;
}

/** Months either side of the anchor. Five pills fit a phone without scrolling. */
const SPAN = 2;

/**
 * The month pills.
 *
 * Always regenerated around the anchor, so the active month is permanently the
 * middle pill and the strip never needs to scroll itself into position — five
 * pills fit a 360dp screen outright. That is the whole reason for the fixed
 * window: an infinite scrolling strip would need a measured `scrollTo` on every
 * month change, which is a lot of fragility for a control that exists to move
 * one or two months at a time.
 *
 * The year is shown only when the month is not in the current calendar year, so
 * the common case stays three letters wide.
 */
export default function MonthStrip({ anchor, today, onSelect }: MonthStripProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);

    const months = Array.from({ length: SPAN * 2 + 1 }, (_, i) => addMonths(anchor, i - SPAN));

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {months.map(month => {
                const active =
                    month.getMonth() === anchor.getMonth() && month.getFullYear() === anchor.getFullYear();
                const label = month.toLocaleDateString('en-US', { month: 'short' });
                const showYear = month.getFullYear() !== today.getFullYear();

                return (
                    <TouchableOpacity
                        key={`${month.getFullYear()}-${month.getMonth()}`}
                        onPress={() => onSelect(month)}
                        activeOpacity={0.7}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        style={{
                            flex: 1,
                            height: 30,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: Radius.full,
                            borderWidth: 1,
                            backgroundColor: active ? theme.primary : 'transparent',
                            borderColor: active ? theme.primary : theme.cardBorder,
                        }}
                    >
                        <Text
                            numberOfLines={1}
                            allowFontScaling={false}
                            style={{
                                fontFamily: active ? 'Nunito_800ExtraBold' : 'Nunito_700Bold',
                                fontSize: 11.5,
                                color: active ? '#ffffff' : theme.textSecondary,
                            }}
                        >
                            {showYear ? `${label} '${String(month.getFullYear()).slice(2)}` : label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}
