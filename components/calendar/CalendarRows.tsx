import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { getTheme, getTints, getClassColor, Radius } from '@/constants/Theme';
import {
    formatHour,
    formatMinutes,
    type CalendarItem,
    type ClassOccurrence,
} from '@/utils/calendarModel';
import { getEventIcon, getEventLabel, getEventTint } from './calendarTheme';

/**
 * The row shapes the calendar's lists are built from.
 *
 * Every one is a **time label plus a tinted block**: the clock sits in a fixed
 * 52pt gutter and the content is a rounded, washed card with a solid left edge
 * in the item's own colour. That is the shape a calendar app has, and it is the
 * same anatomy as the app's timetable blocks, so a class reads the same here as
 * it does on the Schedule tab.
 *
 * The first pass drew these as hairline-divided rows inside one bordered card,
 * which made a day look like a settings screen rather than a schedule.
 */

const GUTTER_WIDTH = 52;

interface TimelineRowProps {
    /** Clock face, e.g. "7:30". */
    railTop: string;
    /** "AM" / "PM", or a second line of context. */
    railBottom?: string;
    fill: string;
    line: string;
    edge: string;
    title: React.ReactNode;
    meta?: string;
    trailing?: React.ReactNode;
    onPress?: () => void;
    onLongPress?: () => void;
    dimmed?: boolean;
    accessibilityLabel?: string;
    accessibilityHint?: string;
    selectable?: boolean;
    selected?: boolean;
}

function TimelineRow({
    railTop,
    railBottom,
    fill,
    line,
    edge,
    title,
    meta,
    trailing,
    onPress,
    onLongPress,
    dimmed,
    accessibilityLabel,
    accessibilityHint,
    selectable,
    selected,
}: TimelineRowProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);

    const body = (
        <View style={{ flexDirection: 'row', alignItems: 'stretch', marginBottom: 6, opacity: dimmed ? 0.55 : 1 }}>
            {selectable && (
                <View style={{ justifyContent: 'center', paddingRight: 8 }}>
                    <View
                        style={{
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            borderWidth: 2,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderColor: selected ? theme.primary : theme.cardBorder,
                            backgroundColor: selected ? theme.primary : 'transparent',
                        }}
                    >
                        {selected && <Ionicons name="checkmark" size={13} color="#ffffff" />}
                    </View>
                </View>
            )}

            <View style={{ width: GUTTER_WIDTH, paddingTop: 9, paddingRight: 9, alignItems: 'flex-end' }}>
                <Text
                    numberOfLines={1}
                    allowFontScaling={false}
                    style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textSecondary }}
                >
                    {railTop}
                </Text>
                {railBottom ? (
                    <Text
                        numberOfLines={1}
                        allowFontScaling={false}
                        style={{ fontFamily: 'Nunito_400Regular', fontSize: 9.5, color: theme.textTertiary, marginTop: 1 }}
                    >
                        {railBottom}
                    </Text>
                ) : null}
            </View>

            <View
                style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 9,
                    paddingRight: 8,
                    paddingLeft: 11,
                    borderRadius: Radius.md,
                    backgroundColor: fill,
                    borderWidth: 1,
                    borderColor: line,
                    borderLeftWidth: 3,
                    borderLeftColor: edge,
                }}
            >
                <View style={{ flex: 1, marginRight: trailing ? 6 : 0 }}>
                    {title}
                    {meta ? (
                        <Text
                            numberOfLines={1}
                            style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary, marginTop: 1 }}
                        >
                            {meta}
                        </Text>
                    ) : null}
                </View>
                {trailing}
            </View>
        </View>
    );

    if (!onPress && !onLongPress) return body;

    // `TouchableOpacity` + `activeOpacity`, never a function `style`: this
    // project patches react-native-css-interop, whose wrapper drops a
    // `({ pressed }) => ({...})` callback, and a dropped style takes the
    // element's layout with it.
    return (
        <TouchableOpacity
            onPress={onPress}
            onLongPress={onLongPress}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={accessibilityHint}
            accessibilityState={selectable ? { selected: !!selected } : undefined}
        >
            {body}
        </TouchableOpacity>
    );
}

/** Splits "1:30 PM" into the two lines the time gutter shows. */
function splitTime(label: string): [string, string] {
    const [clock, suffix] = label.split(' ');
    return [clock, suffix || ''];
}

// ─── Class ────────────────────────────────────────────────────────────────────

export function ClassRow({ occurrence, onPress }: { occurrence: ClassOccurrence; onPress?: () => void }) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const colour = getClassColor(occurrence.colorIdx, isDark);

    const start = formatHour(occurrence.startHour);
    const end = formatHour(occurrence.startHour + occurrence.duration);
    const [clock, suffix] = splitTime(start);

    return (
        <TimelineRow
            railTop={clock}
            railBottom={suffix}
            // A wash of the block's own colour, not the solid fill the timetable
            // uses: a list of six solid blocks is a paint chart, and the text
            // here has to sit beside a time gutter rather than on the block.
            fill={isDark ? 'rgba(255,255,255,0.04)' : '#ffffff'}
            line={theme.cardBorder}
            edge={colour.solid}
            onPress={onPress}
            accessibilityLabel={`${occurrence.name}, ${start} to ${end}${occurrence.room ? `, room ${occurrence.room}` : ''}`}
            accessibilityHint="Opens your schedule"
            title={
                <Text numberOfLines={1} style={{ fontFamily: 'Nunito_700Bold', fontSize: 14, color: theme.text }}>
                    {occurrence.name}
                </Text>
            }
            meta={`until ${end}${occurrence.room ? ` · ${occurrence.room}` : ''}`}
            trailing={<Ionicons name="chevron-forward" size={14} color={theme.textTertiary} />}
        />
    );
}

// ─── Task deadline ────────────────────────────────────────────────────────────

export function TaskRow({ item, onPress }: { item: CalendarItem; onPress?: () => void }) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const tints = getTints(isDark);

    const done = item.status === 'submitted' || item.status === 'graded';
    const tint = done ? tints.attendance : tints.tasks;

    const [clock, suffix] = item.minutes !== null ? splitTime(formatMinutes(item.minutes)) : ['Due', ''];

    const meta = [
        item.subjectCode || item.subjectName || 'Task',
        done ? (item.status === 'graded' ? 'Graded' : 'Submitted') : 'Due',
    ].filter(Boolean).join(' · ');

    return (
        <TimelineRow
            railTop={clock}
            railBottom={suffix || undefined}
            fill={tint.fill}
            line={tint.line}
            edge={tint.solid}
            dimmed={done}
            onPress={onPress}
            accessibilityLabel={`Task due: ${item.title}, ${meta}`}
            accessibilityHint="Opens this task"
            title={
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons
                        name={done ? 'checkmark-circle' : 'ellipse-outline'}
                        size={13}
                        color={tint.ink}
                        style={{ marginRight: 5 }}
                    />
                    <Text
                        numberOfLines={1}
                        style={{
                            flex: 1,
                            fontFamily: 'Nunito_700Bold',
                            fontSize: 14,
                            color: theme.text,
                            textDecorationLine: done ? 'line-through' : 'none',
                        }}
                    >
                        {item.title}
                    </Text>
                </View>
            }
            meta={meta}
            trailing={<Ionicons name="chevron-forward" size={14} color={theme.textTertiary} />}
        />
    );
}

// ─── Event ────────────────────────────────────────────────────────────────────

interface EventRowProps {
    item: CalendarItem;
    /** Shown when the item belongs to a term other than the active one. */
    showTerm?: boolean;
    onPress?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    selectable?: boolean;
    selected?: boolean;
    onToggleSelect?: () => void;
}

export function EventRow({
    item,
    showTerm,
    onPress,
    onEdit,
    onDelete,
    selectable,
    selected,
    onToggleSelect,
}: EventRowProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const tint = getEventTint(item.type, isDark);

    const [clock, suffix] =
        item.minutes !== null ? splitTime(formatMinutes(item.minutes)) : ['All', 'day'];

    const meta = [
        getEventLabel(item.type),
        showTerm && item.semName ? `${item.yearName} · ${item.semName}` : null,
        item.note || null,
    ].filter(Boolean).join(' · ');

    return (
        <TimelineRow
            railTop={clock}
            railBottom={suffix}
            fill={tint.fill}
            line={tint.line}
            edge={tint.solid}
            selectable={selectable}
            selected={selected}
            onPress={selectable ? onToggleSelect : onPress}
            onLongPress={!selectable && onToggleSelect ? onToggleSelect : undefined}
            accessibilityLabel={`${item.title}, ${meta}`}
            accessibilityHint={selectable ? 'Toggles selection' : 'Opens this event'}
            title={
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name={getEventIcon(item.type)} size={12} color={tint.ink} style={{ marginRight: 5 }} />
                    <Text numberOfLines={1} style={{ flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 14, color: theme.text }}>
                        {item.title}
                    </Text>
                </View>
            }
            meta={meta}
            trailing={
                selectable ? undefined : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {onEdit && (
                            <TouchableOpacity
                                onPress={onEdit}
                                hitSlop={{ top: 12, bottom: 12, left: 8, right: 6 }}
                                accessibilityRole="button"
                                accessibilityLabel={`Edit ${item.title}`}
                                style={{ padding: 3 }}
                            >
                                <Ionicons name="create-outline" size={16} color={theme.textSecondary} />
                            </TouchableOpacity>
                        )}
                        {onDelete && (
                            <TouchableOpacity
                                onPress={onDelete}
                                hitSlop={{ top: 12, bottom: 12, left: 6, right: 8 }}
                                accessibilityRole="button"
                                accessibilityLabel={`Delete ${item.title}`}
                                style={{ padding: 3, marginLeft: 1 }}
                            >
                                <Ionicons name="trash-outline" size={16} color={theme.error} />
                            </TouchableOpacity>
                        )}
                    </View>
                )
            }
        />
    );
}

// ─── All-day strip ────────────────────────────────────────────────────────────

/**
 * An event with no clock time, drawn as a full-width chip above the timeline —
 * the way every calendar app separates "on this day" from "at this time".
 */
export function AllDayChip({
    item,
    showTerm,
    onPress,
    onEdit,
    onDelete,
    selectable,
    selected,
    onToggleSelect,
}: EventRowProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);

    const isTask = item.kind === 'task';
    const tints = getTints(isDark);
    const tint = isTask ? tints.tasks : getEventTint(item.type, isDark);

    const meta = [
        isTask ? item.subjectCode || item.subjectName || 'Task' : getEventLabel(item.type),
        showTerm && item.semName ? `${item.yearName} · ${item.semName}` : null,
    ].filter(Boolean).join(' · ');

    return (
        <TouchableOpacity
            onPress={selectable ? onToggleSelect : onPress}
            onLongPress={!selectable && onToggleSelect ? onToggleSelect : undefined}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel={`All day: ${item.title}, ${meta}`}
            accessibilityState={selectable ? { selected: !!selected } : undefined}
            style={{ marginBottom: 6 }}
        >
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 8,
                    paddingHorizontal: 11,
                    borderRadius: Radius.md,
                    backgroundColor: tint.fill,
                    borderWidth: 1,
                    borderColor: tint.line,
                    borderLeftWidth: 3,
                    borderLeftColor: tint.solid,
                }}
            >
                {selectable && (
                    <View
                        style={{
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            marginRight: 8,
                            borderWidth: 2,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderColor: selected ? theme.primary : theme.cardBorder,
                            backgroundColor: selected ? theme.primary : 'transparent',
                        }}
                    >
                        {selected && <Ionicons name="checkmark" size={12} color="#ffffff" />}
                    </View>
                )}

                <Ionicons
                    name={isTask ? 'ellipse-outline' : getEventIcon(item.type)}
                    size={12}
                    color={tint.ink}
                    style={{ marginRight: 6 }}
                />

                <View style={{ flex: 1, marginRight: 6 }}>
                    <Text numberOfLines={1} style={{ fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: theme.text }}>
                        {item.title}
                    </Text>
                    {meta ? (
                        <Text numberOfLines={1} style={{ fontFamily: 'Nunito_400Regular', fontSize: 11, color: theme.textTertiary, marginTop: 1 }}>
                            {meta}
                        </Text>
                    ) : null}
                </View>

                {!selectable && onEdit && (
                    <TouchableOpacity
                        onPress={onEdit}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 6 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${item.title}`}
                        style={{ padding: 3 }}
                    >
                        <Ionicons name="create-outline" size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                )}
                {!selectable && onDelete && (
                    <TouchableOpacity
                        onPress={onDelete}
                        hitSlop={{ top: 12, bottom: 12, left: 6, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${item.title}`}
                        style={{ padding: 3, marginLeft: 1 }}
                    >
                        <Ionicons name="trash-outline" size={16} color={theme.error} />
                    </TouchableOpacity>
                )}
            </View>
        </TouchableOpacity>
    );
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

/** A low-contrast strip for an empty section. An empty state should recede. */
export function QuietState({
    icon,
    text,
    actionLabel,
    onAction,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    text: string;
    actionLabel?: string;
    onAction?: () => void;
}) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);

    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                paddingHorizontal: 14,
                borderRadius: Radius.xl,
                backgroundColor: isDark ? 'rgba(0,0,0,0.20)' : theme.surfaceSecondary,
            }}
        >
            <Ionicons name={icon} size={17} color={theme.textTertiary} style={{ marginRight: 10 }} />
            <Text style={{ flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: theme.textTertiary }}>
                {text}
            </Text>
            {actionLabel && onAction && (
                <TouchableOpacity
                    onPress={onAction}
                    accessibilityRole="button"
                    accessibilityLabel={actionLabel}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: theme.primary }}>
                        {actionLabel}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}
