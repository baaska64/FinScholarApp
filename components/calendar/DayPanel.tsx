import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { getTheme, Radius } from '@/constants/Theme';
import {
    parseDateKey,
    relativeDayLabel,
    type CalendarItem,
    type ClassOccurrence,
} from '@/utils/calendarModel';
import { AllDayChip, ClassRow, EventRow, QuietState, TaskRow } from './CalendarRows';

interface DayPanelProps {
    dateKey: string;
    today: Date;
    items: CalendarItem[];
    classes: ClassOccurrence[];
    onAddEvent: () => void;
    onEditEvent: (item: CalendarItem) => void;
    onDeleteEvent: (item: CalendarItem) => void;
    onPressTask: (item: CalendarItem) => void;
    onPressClass: () => void;
}

/**
 * What is happening on the selected day.
 *
 * **One chronological timeline, not three lists.** The first pass grouped the
 * day into "Calendar", "Due" and "Classes" cards, which meant a student reading
 * their Wednesday had to interleave three sections in their head to find out
 * what came next. Untimed items sit in an all-day strip at the top — the split
 * every calendar app makes — and everything with a clock falls into one list in
 * time order, regardless of whether it is a class, a deadline or an exam.
 *
 * It renders as a plain `View`. The month view is a single scrolling page, so
 * this must not own a `ScrollView` of its own: nesting one inside the page is
 * what left the day's content pinned behind the tab bar with nowhere to go.
 */
export default function DayPanel({
    dateKey,
    today,
    items,
    classes,
    onAddEvent,
    onEditEvent,
    onDeleteEvent,
    onPressTask,
    onPressClass,
}: DayPanelProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);

    const date = parseDateKey(dateKey);
    const relative = relativeDayLabel(dateKey, today);

    const allDay = items.filter(i => i.minutes === null);
    const timedItems = items.filter(i => i.minutes !== null);
    const isEmpty = classes.length === 0 && items.length === 0;

    /**
     * Classes and timed items merged into one ordered sequence. Classes carry
     * a float hour (13.5), items carry minutes past midnight, so classes are
     * converted rather than the other way round — minutes is the finer unit.
     */
    const timeline: { key: string; at: number; node: React.ReactNode }[] = [
        ...classes.map(occurrence => ({
            key: `class-${occurrence.id}`,
            at: occurrence.startHour * 60,
            node: <ClassRow occurrence={occurrence} onPress={onPressClass} />,
        })),
        ...timedItems.map(item => ({
            key: `${item.kind}-${item.id}`,
            at: item.minutes as number,
            node:
                item.kind === 'task' ? (
                    <TaskRow item={item} onPress={() => onPressTask(item)} />
                ) : (
                    <EventRow
                        item={item}
                        showTerm={!item.isCurrentTerm}
                        onEdit={() => onEditEvent(item)}
                        onDelete={() => onDeleteEvent(item)}
                    />
                ),
        })),
    ].sort((a, b) => a.at - b.at);

    const summary = isEmpty
        ? 'Nothing scheduled'
        : [
            classes.length ? `${classes.length} class${classes.length === 1 ? '' : 'es'}` : null,
            items.filter(i => i.kind === 'task').length
                ? `${items.filter(i => i.kind === 'task').length} due`
                : null,
            items.filter(i => i.kind === 'event').length
                ? `${items.filter(i => i.kind === 'event').length} event${items.filter(i => i.kind === 'event').length === 1 ? '' : 's'}`
                : null,
        ].filter(Boolean).join(' · ');

    return (
        <View>
            {/* Day header — the one place the full date is spelled out. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: 10 }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                        <Text
                            accessibilityRole="header"
                            numberOfLines={1}
                            style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: theme.text, letterSpacing: -0.2 }}
                        >
                            {date ? date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : ''}
                        </Text>
                        {relative ? (
                            <Text
                                style={{
                                    fontFamily: 'Nunito_700Bold',
                                    fontSize: 11.5,
                                    marginLeft: 8,
                                    color: relative === 'Today' ? theme.primary : theme.textTertiary,
                                }}
                            >
                                {relative}
                            </Text>
                        ) : null}
                    </View>
                    <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary, marginTop: 1 }}>
                        {summary}
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={onAddEvent}
                    accessibilityRole="button"
                    accessibilityLabel="Add an event on this day"
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        height: 32,
                        paddingHorizontal: 12,
                        borderRadius: Radius.full,
                        backgroundColor: theme.primary,
                        borderBottomWidth: 2,
                        borderBottomColor: isDark ? '#5b62c9' : '#3730a3',
                    }}
                >
                    <Ionicons name="add" size={15} color="#ffffff" />
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: '#ffffff', marginLeft: 3 }}>
                        Event
                    </Text>
                </TouchableOpacity>
            </View>

            {isEmpty && (
                <QuietState
                    icon="partly-sunny-outline"
                    text="Nothing on this day — free time."
                    actionLabel="Add event"
                    onAction={onAddEvent}
                />
            )}

            {allDay.map(item => (
                <AllDayChip
                    key={`allday-${item.kind}-${item.id}`}
                    item={item}
                    showTerm={!item.isCurrentTerm}
                    onEdit={item.kind === 'event' ? () => onEditEvent(item) : undefined}
                    onDelete={item.kind === 'event' ? () => onDeleteEvent(item) : undefined}
                    onPress={item.kind === 'task' ? () => onPressTask(item) : () => onEditEvent(item)}
                />
            ))}

            {allDay.length > 0 && timeline.length > 0 && (
                <View style={{ height: 1, backgroundColor: theme.cardBorder, marginVertical: 6, marginLeft: 52 }} />
            )}

            {timeline.map(entry => (
                <View key={entry.key}>{entry.node}</View>
            ))}
        </View>
    );
}
