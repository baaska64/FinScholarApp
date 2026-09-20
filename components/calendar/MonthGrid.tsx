import React, { useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, PanResponder } from 'react-native';
import { useColorScheme } from 'nativewind';
import { getTheme, getTints, Radius } from '@/constants/Theme';
import {
    buildDayChips,
    buildMonthMatrix,
    chunkWeeks,
    formatDateKeyLong,
    trimTrailingWeeks,
    WEEKDAY_LABELS,
    type CalendarItem,
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
    /**
     * Total height for the lattice, excluding the weekday rail. The screen
     * hands over most of the viewport so the grid fills the first screen the
     * way a calendar app's month view does.
     */
    height?: number;
    onSelectDate: (dateKey: string) => void;
    onChangeMonth: (delta: number) => void;
}

const RAIL_HEIGHT = 24;
/** Chip bar height plus its gap — the unit a cell divides its spare space by. */
const CHIP_UNIT = 15;
const MIN_ROW = 54;

/**
 * The month, as a full-bleed calendar grid.
 *
 * **Tall ruled cells, edge to edge.** The grid is the page: it takes most of
 * the viewport, its hairlines run to both screen edges, and each cell has room
 * for the day number plus up to four named chips. A compact grid in a rounded
 * card reads as a date picker bolted above a list; a full-bleed lattice reads
 * as a calendar, which is the whole point of the screen.
 *
 * ## Two layout rules that are load-bearing
 *
 * 1. **Seven `flex: 1` children per explicit week row — never `flexWrap`.**
 *    The grid was once a single wrap container whose cells carried a measured
 *    width with a percentage `flexBasis` fallback. The percentage never
 *    resolved, cells collapsed to their content, and *eleven* of them wrapped
 *    onto a row sitting under seven weekday headers.
 * 2. **No function `style` on a pressable — the style must be a plain object.**
 *    This project patches `react-native-css-interop` (NativeWind v4), which
 *    wraps every RN component and remaps `style`; a `({ pressed }) => ({...})`
 *    callback does not survive that wrapper, so the cells silently lost both
 *    their `flex` and their `height` and shrank to fit their digits. Press
 *    feedback comes from `TouchableOpacity`'s `activeOpacity`, which is what
 *    the rest of this codebase uses. Every other `Pressable` in the repo passes
 *    a static object; do not be the exception.
 *
 * Other decisions:
 * - **Monday first**, because `class.day` is Monday-indexed everywhere else in
 *   the app and a Sunday-first grid put the week's classes in the wrong column.
 * - **Today is a filled circle**, the one convention every user already knows;
 *   the selection is a wash across the whole cell, so the two never collide.
 * - **The term is drawn by subtraction** — days outside `startDate`–`endDate`
 *   fade. Colouring 30 in-term cells spends a colour to say "normal".
 * - **Trailing empty weeks are trimmed**, so most months are five rows.
 */
export default function MonthGrid({
    month,
    today,
    selectedKey,
    itemsByDate,
    termStartKey,
    termEndKey,
    height,
    onSelectDate,
    onChangeMonth,
}: MonthGridProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const tints = getTints(isDark);

    const slide = useRef(new Animated.Value(0)).current;

    const weeks = useMemo(
        () => chunkWeeks(trimTrailingWeeks(buildMonthMatrix(month.getFullYear(), month.getMonth(), today))),
        [month, today],
    );

    /**
     * Horizontal paging. `PanResponder` rather than a gesture-handler pager:
     * the repo has no `react-native-gesture-handler`, and a month step is a
     * one-shot commit, not a tracked drag. The 1.6 ratio guard is what stops it
     * stealing the page's vertical scroll.
     */
    const pan = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_evt, g) =>
                Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
            onPanResponderRelease: (_evt, g) => {
                if (Math.abs(g.dx) < 45) return;
                const delta = g.dx > 0 ? -1 : 1;
                slide.setValue(g.dx > 0 ? -20 : 20);
                onChangeMonth(delta);
                Animated.spring(slide, { toValue: 0, useNativeDriver: true, friction: 7, tension: 90 }).start();
            },
        }),
    ).current;

    const rowHeight = height ? Math.max(MIN_ROW, height / weeks.length) : 62;
    // A taller row earns another chip slot rather than more blank space.
    const chipSlots = Math.max(1, Math.min(4, Math.floor((rowHeight - 26) / CHIP_UNIT)));

    const knowsTerm = !!termStartKey && !!termEndKey;
    const gridLine = theme.cardBorder;

    return (
        <Animated.View style={{ transform: [{ translateX: slide }] }} {...pan.panHandlers}>
            {/* Weekday rail sits on the page, above the lattice. */}
            <View style={{ flexDirection: 'row', height: RAIL_HEIGHT, alignItems: 'center' }}>
                {WEEKDAY_LABELS.map((label, i) => (
                    <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                        <Text
                            allowFontScaling={false}
                            style={{
                                fontFamily: 'Nunito_700Bold',
                                fontSize: 10.5,
                                letterSpacing: 0.8,
                                color: theme.textTertiary,
                            }}
                        >
                            {label}
                        </Text>
                    </View>
                ))}
            </View>

            <View style={{ borderTopWidth: 1, borderTopColor: gridLine, backgroundColor: theme.surface }}>
                {weeks.map((week, wi) => (
                    <View key={week[0].key} style={{ flexDirection: 'row' }}>
                        {week.map((cell, ci) => (
                            <DayCell
                                key={cell.key}
                                cell={cell}
                                items={itemsByDate[cell.key]}
                                rowHeight={rowHeight}
                                chipSlots={chipSlots}
                                isSelected={cell.key === selectedKey}
                                outsideTerm={knowsTerm && (cell.key < termStartKey! || cell.key > termEndKey!)}
                                isLastColumn={ci === 6}
                                gridLine={gridLine}
                                selectionWash={isDark ? 'rgba(129,140,248,0.16)' : '#e9ebfa'}
                                taskFill={tints.tasks.fill}
                                taskInk={tints.tasks.ink}
                                isDark={isDark}
                                theme={theme}
                                onSelectDate={onSelectDate}
                            />
                        ))}
                    </View>
                ))}
            </View>
        </Animated.View>
    );
}

interface DayCellProps {
    cell: MonthCell;
    items: CalendarItem[] | undefined;
    rowHeight: number;
    chipSlots: number;
    isSelected: boolean;
    outsideTerm: boolean;
    isLastColumn: boolean;
    gridLine: string;
    selectionWash: string;
    taskFill: string;
    taskInk: string;
    isDark: boolean;
    theme: ReturnType<typeof getTheme>;
    onSelectDate: (dateKey: string) => void;
}

const EMPTY: CalendarItem[] = [];

const DayCell = React.memo(function DayCell({
    cell,
    items,
    rowHeight,
    chipSlots,
    isSelected,
    outsideTerm,
    isLastColumn,
    gridLine,
    selectionWash,
    taskFill,
    taskInk,
    isDark,
    theme,
    onSelectDate,
}: DayCellProps) {
    const dayItems = items || EMPTY;
    const { chips, overflow } = buildDayChips(dayItems, chipSlots);

    const a11yParts = [formatDateKeyLong(cell.key)];
    if (cell.isToday) a11yParts.push('today');
    if (dayItems.length === 0) a11yParts.push('nothing scheduled');
    else a11yParts.push(dayItems.map(i => i.title).join(', '));

    return (
        <TouchableOpacity
            onPress={() => onSelectDate(cell.key)}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={a11yParts.join(', ')}
            // Plain object, never a callback — see the note on this file.
            style={{
                flex: 1,
                height: rowHeight,
                paddingTop: 4,
                paddingHorizontal: 3,
                borderRightWidth: isLastColumn ? 0 : 1,
                borderBottomWidth: 1,
                borderColor: gridLine,
                backgroundColor: isSelected ? selectionWash : 'transparent',
            }}
        >
            {/* The content fades, not the cell — the lattice has to keep an
                even weight right across the month. */}
            <View style={{ flex: 1, opacity: (cell.inMonth ? 1 : 0.45) * (outsideTerm ? 0.4 : 1) }}>
                <View style={{ height: 20, alignItems: 'center', justifyContent: 'center' }}>
                    <View
                        style={{
                            minWidth: 20,
                            height: 20,
                            paddingHorizontal: 4,
                            borderRadius: Radius.full,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: cell.isToday ? theme.primary : 'transparent',
                        }}
                    >
                        <Text
                            allowFontScaling={false}
                            style={{
                                fontFamily: cell.isToday ? 'Nunito_800ExtraBold' : 'Nunito_400Regular',
                                fontSize: 13,
                                color: cell.isToday ? '#ffffff' : theme.text,
                            }}
                        >
                            {cell.day}
                        </Text>
                    </View>
                </View>

                {chips.map(item => {
                    const tint = item.kind === 'task'
                        ? { fill: taskFill, ink: taskInk }
                        : getEventTint(item.type, isDark);
                    return (
                        <View
                            key={`${item.kind}-${item.id}`}
                            style={{
                                height: 13,
                                borderRadius: 3,
                                marginTop: 2,
                                paddingHorizontal: 3,
                                justifyContent: 'center',
                                backgroundColor: tint.fill,
                            }}
                        >
                            <Text
                                numberOfLines={1}
                                allowFontScaling={false}
                                style={{ fontFamily: 'Nunito_700Bold', fontSize: 8.5, color: tint.ink }}
                            >
                                {item.title}
                            </Text>
                        </View>
                    );
                })}

                {overflow > 0 && (
                    <View style={{ height: 13, marginTop: 2, justifyContent: 'center', paddingHorizontal: 3 }}>
                        <Text
                            numberOfLines={1}
                            allowFontScaling={false}
                            style={{ fontFamily: 'Nunito_700Bold', fontSize: 8.5, color: theme.textTertiary }}
                        >
                            {`+${overflow}`}
                        </Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
});
