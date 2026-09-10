import React, { useMemo } from 'react';
import { View, Text, SectionList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { getTheme, Radius } from '@/constants/Theme';
import {
    groupByDateKey,
    parseDateKey,
    relativeDayLabel,
    toDateKey,
    type CalendarItem,
} from '@/utils/calendarModel';
import { AllDayChip, EventRow, TaskRow } from './CalendarRows';

interface AgendaListProps {
    /** Already filtered and sorted by the screen. */
    items: CalendarItem[];
    today: Date;
    /** True when the list is showing past items, which reverses the ordering. */
    reversed?: boolean;
    showTerm?: boolean;
    selectMode?: boolean;
    selectedIds?: Set<string>;
    onToggleSelect?: (item: CalendarItem) => void;
    onPressEvent?: (item: CalendarItem) => void;
    onEditEvent?: (item: CalendarItem) => void;
    onDeleteEvent?: (item: CalendarItem) => void;
    onPressTask?: (item: CalendarItem) => void;
    bottomPadding: number;
    ListHeaderComponent?: React.ReactElement | null;
    ListEmptyComponent?: React.ReactElement | null;
}

/**
 * The agenda lens: every dated item as one continuous, date-grouped list.
 *
 * The screen previously had no such view — the only list was the active
 * semester's events, unsectioned, so "what is coming up" meant reading a month
 * grid one square at a time. Section headers stick, so the date a row belongs
 * to stays on screen while scrolling through a long term. Rows use the same
 * time-gutter-plus-block anatomy as the day panel, so the two lenses read as
 * one product.
 */
export default function AgendaList({
    items,
    today,
    reversed = false,
    showTerm,
    selectMode,
    selectedIds,
    onToggleSelect,
    onPressEvent,
    onEditEvent,
    onDeleteEvent,
    onPressTask,
    bottomPadding,
    ListHeaderComponent,
    ListEmptyComponent,
}: AgendaListProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const todayKey = toDateKey(today);

    const sections = useMemo(() => {
        const grouped = groupByDateKey(items);
        const keys = Object.keys(grouped).sort();
        if (reversed) keys.reverse();
        return keys.map(key => ({ key, title: key, data: grouped[key] }));
    }, [items, reversed]);

    return (
        <SectionList
            sections={sections}
            keyExtractor={item => `${item.kind}-${item.id}-${item.dateKey}`}
            stickySectionHeadersEnabled
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: bottomPadding, paddingHorizontal: 14 }}
            ListHeaderComponent={ListHeaderComponent}
            ListEmptyComponent={ListEmptyComponent}
            renderSectionHeader={({ section }) => {
                const isToday = section.key === todayKey;
                const date = parseDateKey(section.key);
                return (
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingTop: 12,
                            paddingBottom: 7,
                            backgroundColor: theme.background,
                        }}
                    >
                        {/* Date pip in the same 52pt gutter the rows use, so the
                            day and its times share one vertical line. */}
                        <View style={{ width: 52, paddingRight: 9, alignItems: 'flex-end' }}>
                            <Text
                                allowFontScaling={false}
                                style={{
                                    fontFamily: 'Nunito_800ExtraBold',
                                    fontSize: 17,
                                    color: isToday ? theme.primary : theme.text,
                                }}
                            >
                                {date ? date.getDate() : ''}
                            </Text>
                            <Text
                                allowFontScaling={false}
                                style={{
                                    fontFamily: 'Nunito_700Bold',
                                    fontSize: 9.5,
                                    letterSpacing: 0.4,
                                    textTransform: 'uppercase',
                                    color: isToday ? theme.primary : theme.textTertiary,
                                }}
                            >
                                {date ? date.toLocaleDateString('en-US', { weekday: 'short' }) : ''}
                            </Text>
                        </View>

                        <Text
                            style={{
                                fontFamily: 'Nunito_700Bold',
                                fontSize: 12,
                                color: isToday ? theme.primary : theme.textTertiary,
                            }}
                        >
                            {date ? date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''}
                            {'  ·  '}
                            {relativeDayLabel(section.key, today)}
                        </Text>
                    </View>
                );
            }}
            renderItem={({ item }) =>
                item.kind === 'task' ? (
                    item.minutes === null ? (
                        <AllDayChip item={item} showTerm={showTerm} onPress={() => onPressTask?.(item)} />
                    ) : (
                        <TaskRow item={item} onPress={() => onPressTask?.(item)} />
                    )
                ) : (
                    <EventRow
                        item={item}
                        showTerm={showTerm && !item.isCurrentTerm}
                        selectable={selectMode}
                        selected={selectedIds?.has(item.id)}
                        onToggleSelect={onToggleSelect ? () => onToggleSelect(item) : undefined}
                        onPress={() => onPressEvent?.(item)}
                        onEdit={onEditEvent ? () => onEditEvent(item) : undefined}
                        onDelete={onDeleteEvent ? () => onDeleteEvent(item) : undefined}
                    />
                )
            }
        />
    );
}

/** Shown when a filter or an empty term leaves the agenda with nothing in it. */
export function AgendaEmpty({
    icon = 'calendar-clear-outline',
    title,
    body,
}: {
    icon?: keyof typeof Ionicons.glyphMap;
    title: string;
    body: string;
}) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);

    return (
        <View
            style={{
                alignItems: 'center',
                paddingVertical: 34,
                paddingHorizontal: 24,
                borderRadius: Radius['3xl'],
                backgroundColor: isDark ? 'rgba(0,0,0,0.18)' : theme.surfaceSecondary,
                marginTop: 16,
            }}
        >
            <Ionicons name={icon} size={34} color={theme.textTertiary} />
            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 15, color: theme.textSecondary, marginTop: 12 }}>
                {title}
            </Text>
            <Text
                style={{
                    fontFamily: 'Nunito_400Regular',
                    fontSize: 12.5,
                    color: theme.textTertiary,
                    textAlign: 'center',
                    lineHeight: 18,
                    marginTop: 5,
                }}
            >
                {body}
            </Text>
        </View>
    );
}
