import React, { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, PanResponder, LayoutChangeEvent } from 'react-native';
import { useColorScheme } from 'nativewind';
import { getTheme, Radius } from '@/constants/Theme';
import {
    buildDayMark,
    buildMonthMatrix,
    formatDateKeyLong,
    trimTrailingWeeks,
    WEEKDAY_LABELS,
    type CalendarItem,
    type DayMark,
    type MonthCell,
} from '@/utils/calendarModel';
import { getEventTint } from './calendarTheme';

interface MonthGridProps {
    /** First of the month being shown. */
    month: Date;
    today: Date;
    selectedKey: string | null;
    /** Items already filtered by the screen, grouped by `YYYY-MM-DD`. */
    itemsByDate: Record<string, CalendarItem[]>;
    /** Inclusive term span. Days outside it are dimmed. */
    termStartKey?: string | null;
    termEndKey?: string | null;
    onSelectDate: (dateKey: string) => void;
    onChangeMonth: (delta: number) => void;
}

/** Weekday rail height. */
const RAIL_HEIGHT = 24;
/** The circle behind a day number. Also the tap target's visual size. */
const PIP = 30;

/**
 * The month.
 *
 * **Flat by design.** The first pass gave every day a filled, rounded, bordered
 * box and washed every in-term day in indigo, which turned a calendar into a
 * grid of 42 buttons — the screen read as blocky and muddy, and the day numbers
 * had to compete with their own containers. Nothing is painted now except the
 * two days that mean something: today's number is tinted, and the selected day
 * gets a solid circle. Everything else is type on the page.
 *
 * The term is drawn by **subtraction** rather than colour: days outside
 * `startDate`–`endDate` drop to 38% opacity, so the semester's shape is legible
 * without spending a colour on 30 cells that all mean "normal".
 *
 * Other decisions:
 * - **Monday first**, because `class.day` is Monday-indexed everywhere else in
 *   the app and a Sunday-first grid put the week's classes in the wrong column.
 * - **It measures itself** (`onLayout`). Cell width used to come from
 *   `Dimensions.get('window')` minus a hand-tallied constant read once at
 *   module scope, so rotation and tablets desynced the grid from its own header.
 * - **Trailing empty weeks are trimmed**, so most months are five rows.
 */
export default function MonthGrid({
    month,
    today,
    selectedKey,
    itemsByDate,
    termStartKey,
    termEndKey,
    onSelectDate,
    onChangeMonth,
}: MonthGridProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);

    const [gridWidth, setGridWidth] = useState(0);
    const slide = useRef(new Animated.Value(0)).current;

    const cells = useMemo(
        () => trimTrailingWeeks(buildMonthMatrix(month.getFullYear(), month.getMonth(), today)),
        [month, today],
    );

    /**
     * Horizontal paging. `PanResponder` rather than a gesture-handler pager:
     * the repo has no `react-native-gesture-handler`, and a month step is a
     * one-shot commit, not a tracked drag. The 1.6 ratio guard is what keeps
     * the page's vertical scroll from being stolen by this.
     */
    const pan = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_evt, g) =>
                Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
            onPanResponderRelease: (_evt, g) => {
                if (Math.abs(g.dx) < 45) return;
                const delta = g.dx > 0 ? -1 : 1;
                // Nudge the grid the way the finger went, then settle as the new
                // month paints, so the change reads as a page turn not a redraw.
                slide.setValue(g.dx > 0 ? -16 : 16);
                onChangeMonth(delta);
                Animated.spring(slide, { toValue: 0, useNativeDriver: true, friction: 7, tension: 90 }).start();
            },
        }),
    ).current;

    const onLayout = (e: LayoutChangeEvent) => {
        const w = e.nativeEvent.layout.width;
        if (Math.abs(w - gridWidth) > 0.5) setGridWidth(w);
    };

    const cellWidth = gridWidth > 0 ? gridWidth / 7 : 0;
    const cellHeight = Math.max(42, Math.min(52, cellWidth * 0.96));
    const knowsTerm = !!termStartKey && !!termEndKey;

    return (
        <View onLayout={onLayout} {...pan.panHandlers}>
            {/* Weekday rail */}
            <View style={{ flexDirection: 'row', height: RAIL_HEIGHT, alignItems: 'center' }}>
                {WEEKDAY_LABELS.map((label, i) => (
                    <View key={i} style={{ width: cellWidth || undefined, flex: cellWidth ? undefined : 1, alignItems: 'center' }}>
                        <Text
                            allowFontScaling={false}
                            style={{
                                fontFamily: 'Nunito_700Bold',
                                fontSize: 11,
                                letterSpacing: 0.8,
                                color: theme.textTertiary,
                            }}
                        >
                            {label}
                        </Text>
                    </View>
                ))}
            </View>

            <Animated.View style={{ flexDirection: 'row', flexWrap: 'wrap', transform: [{ translateX: slide }] }}>
                {cells.map(cell => (
                    <DayCell
                        key={cell.key}
                        cell={cell}
                        width={cellWidth}
                        height={cellHeight}
                        isSelected={cell.key === selectedKey}
                        mark={buildDayMark(itemsByDate[cell.key] || [])}
                        // Only dim for the term once both dates are known;
                        // otherwise an unconfigured term greys out the year.
                        outsideTerm={
                            knowsTerm && (cell.key < termStartKey! || cell.key > termEndKey!)
                        }
                        isDark={isDark}
                        theme={theme}
                        onPress={() => onSelectDate(cell.key)}
                    />
                ))}
            </Animated.View>
        </View>
    );
}

interface DayCellProps {
    cell: MonthCell;
    width: number;
    height: number;
    isSelected: boolean;
    mark: DayMark;
    outsideTerm: boolean;
    isDark: boolean;
    theme: ReturnType<typeof getTheme>;
    onPress: () => void;
}

const DayCell = React.memo(function DayCell({
    cell,
    width,
    height,
    isSelected,
    mark,
    outsideTerm,
    isDark,
    theme,
    onPress,
}: DayCellProps) {
    const total = mark.eventCount + mark.taskCount;

    const numberColor = isSelected
        ? '#ffffff'
        : cell.isToday
            ? theme.primary
            : cell.inMonth
                ? theme.text
                : theme.textTertiary;

    const a11yParts = [formatDateKeyLong(cell.key)];
    if (cell.isToday) a11yParts.push('today');
    if (mark.eventCount > 0) a11yParts.push(`${mark.eventCount} event${mark.eventCount === 1 ? '' : 's'}`);
    if (mark.taskCount > 0) a11yParts.push(`${mark.taskCount} task${mark.taskCount === 1 ? '' : 's'} due`);
    if (total === 0) a11yParts.push('nothing scheduled');

    // Dots stand for distinct event types; a fourth kind of thing on the day
    // becomes "+n" rather than a fourth dot, which a 30pt pip cannot hold.
    const dots: string[] = mark.types.map(t => getEventTint(t, isDark).solid);
    if (mark.taskCount > 0) dots.push(isDark ? '#e89b2a' : '#e08b12');

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={a11yParts.join(', ')}
            style={({ pressed }) => ({
                width: width || undefined,
                flexBasis: width ? undefined : '14.28%',
                height,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: (cell.inMonth ? 1 : 0.55) * (outsideTerm ? 0.38 : 1) * (pressed ? 0.5 : 1),
            })}
        >
            <View
                style={{
                    width: PIP,
                    height: PIP,
                    borderRadius: Radius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSelected ? theme.primary : 'transparent',
                }}
            >
                <Text
                    allowFontScaling={false}
                    style={{
                        fontFamily: cell.isToday || isSelected ? 'Nunito_800ExtraBold' : 'Nunito_400Regular',
                        fontSize: 14.5,
                        color: numberColor,
                    }}
                >
                    {cell.day}
                </Text>
            </View>

            {/* Dot rail. Height is reserved either way so rows stay even. */}
            <View style={{ height: 6, marginTop: 1, flexDirection: 'row', alignItems: 'center' }}>
                {dots.slice(0, 3).map((colour, i) => (
                    <View
                        key={i}
                        style={{
                            width: 4.5,
                            height: 4.5,
                            borderRadius: 2.5,
                            marginHorizontal: 1.5,
                            backgroundColor: isSelected ? theme.primary : colour,
                        }}
                    />
                ))}
                {mark.overflow > 0 && dots.length <= 3 && (
                    <Text
                        allowFontScaling={false}
                        style={{
                            fontFamily: 'Nunito_700Bold',
                            fontSize: 8,
                            marginLeft: 1,
                            color: theme.textTertiary,
                        }}
                    >
                        +{mark.overflow}
                    </Text>
                )}
            </View>
        </Pressable>
    );
});
