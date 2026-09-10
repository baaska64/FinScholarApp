import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import DateTimePicker from '@react-native-community/datetimepicker';
import KeyboardSheet from '@/components/ui/KeyboardSheet';
import { getTheme, getTints, Radius } from '@/constants/Theme';
import {
    EVENT_TYPE_ORDER,
    addDays,
    parseDateKey,
    toDateKey,
    type EventTypeKey,
} from '@/utils/calendarModel';
import { getEventIcon, getEventLabel, getEventTint } from './calendarTheme';

export interface EventDraft {
    title: string;
    dateKey: string;
    type: EventTypeKey;
    note: string;
}

interface EventSheetProps {
    visible: boolean;
    onClose: () => void;
    onSave: (draft: EventDraft) => void;
    onDelete?: () => void;
    /** Prefills the form; null means a new event. */
    editing: EventDraft | null;
    /** Date the form opens on for a new event. */
    defaultDateKey: string;
    /** Named so the sheet can say which term the event will land in. */
    termLabel?: string;
}

/**
 * Add or edit one event.
 *
 * It runs on `KeyboardSheet` rather than a bare `Modal`, which is what the old
 * form was: a fixed `h-[70%]` sheet with the Save button pinned at the bottom
 * and no keyboard handling at all, so on a short phone the keyboard covered
 * both the note field and Save.
 */
export default function EventSheet({
    visible,
    onClose,
    onSave,
    onDelete,
    editing,
    defaultDateKey,
    termLabel,
}: EventSheetProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const tints = getTints(isDark);

    const [title, setTitle] = useState('');
    const [type, setType] = useState<EventTypeKey>('custom');
    const [dateKey, setDateKey] = useState(defaultDateKey);
    const [note, setNote] = useState('');
    const [showPicker, setShowPicker] = useState(false);

    // Reset on every open so a cancelled edit never leaks into the next one.
    useEffect(() => {
        if (!visible) return;
        setTitle(editing?.title ?? '');
        setType(editing?.type ?? 'custom');
        setDateKey(editing?.dateKey ?? defaultDateKey);
        setNote(editing?.note ?? '');
        setShowPicker(false);
    }, [visible, editing, defaultDateKey]);

    const selectedDate = parseDateKey(dateKey) || new Date();
    const canSave = title.trim().length > 0;

    const inputStyle = {
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: theme.inputBorder,
        backgroundColor: theme.inputBg,
        color: theme.text,
        fontFamily: 'Nunito_400Regular',
        fontSize: 15,
    } as const;

    const label = (text: string) => (
        <Text
            style={{
                fontFamily: 'Nunito_800ExtraBold',
                fontSize: 11,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: theme.textTertiary,
                marginBottom: 7,
                marginTop: 16,
            }}
        >
            {text}
        </Text>
    );

    /** One tap for the three dates a student actually picks most of the time. */
    const quickDates: { label: string; key: string }[] = [
        { label: 'Today', key: toDateKey(new Date()) },
        { label: 'Tomorrow', key: toDateKey(addDays(new Date(), 1)) },
        { label: 'Next week', key: toDateKey(addDays(new Date(), 7)) },
    ];

    return (
        <KeyboardSheet
            visible={visible}
            onClose={onClose}
            title={editing ? 'Edit event' : 'New event'}
            subtitle={termLabel ? `Saves to ${termLabel}` : undefined}
            icon="calendar"
            tint={tints.schedule}
            headerRight={
                editing && onDelete ? (
                    <TouchableOpacity
                        onPress={onDelete}
                        accessibilityRole="button"
                        accessibilityLabel="Delete this event"
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: Radius.full,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: tints.danger.fill,
                            borderWidth: 1,
                            borderColor: tints.danger.line,
                        }}
                    >
                        <Ionicons name="trash-outline" size={16} color={tints.danger.ink} />
                    </TouchableOpacity>
                ) : undefined
            }
            footer={
                <TouchableOpacity
                    onPress={() => canSave && onSave({ title: title.trim(), dateKey, type, note: note.trim() })}
                    disabled={!canSave}
                    accessibilityRole="button"
                    accessibilityLabel={editing ? 'Update event' : 'Save event'}
                    accessibilityState={{ disabled: !canSave }}
                    style={{
                        paddingVertical: 14,
                        borderRadius: Radius.xl,
                        alignItems: 'center',
                        backgroundColor: canSave ? theme.primary : theme.surfaceSecondary,
                        borderBottomWidth: 2,
                        borderBottomColor: canSave ? (isDark ? '#5b62c9' : '#3730a3') : theme.cardBorder,
                    }}
                >
                    <Text
                        style={{
                            fontFamily: 'Nunito_800ExtraBold',
                            fontSize: 15,
                            color: canSave ? '#ffffff' : theme.textTertiary,
                        }}
                    >
                        {editing ? 'Update event' : 'Save event'}
                    </Text>
                </TouchableOpacity>
            }
        >
            {label('What is it?')}
            <TextInput
                style={inputStyle}
                placeholder="e.g. Midterm exams begin"
                placeholderTextColor={theme.textTertiary}
                value={title}
                onChangeText={setTitle}
                accessibilityLabel="Event title"
                returnKeyType="next"
            />

            {label('Type')}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {EVENT_TYPE_ORDER.map(key => {
                    const tint = getEventTint(key, isDark);
                    const active = type === key;
                    return (
                        <TouchableOpacity
                            key={key}
                            onPress={() => setType(key)}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={getEventLabel(key)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: 11,
                                paddingVertical: 8,
                                borderRadius: Radius.full,
                                borderWidth: 1,
                                backgroundColor: active ? tint.fill : theme.surfaceSecondary,
                                borderColor: active ? tint.solid : theme.cardBorder,
                            }}
                        >
                            <Ionicons
                                name={getEventIcon(key)}
                                size={13}
                                color={active ? tint.ink : theme.textTertiary}
                                style={{ marginRight: 5 }}
                            />
                            <Text
                                style={{
                                    fontFamily: 'Nunito_700Bold',
                                    fontSize: 12.5,
                                    color: active ? tint.ink : theme.textSecondary,
                                }}
                            >
                                {getEventLabel(key)}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {label('When')}
            <TouchableOpacity
                onPress={() => setShowPicker(true)}
                accessibilityRole="button"
                accessibilityLabel={`Date: ${selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}. Tap to change.`}
                style={{
                    ...inputStyle,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 15, color: theme.text }}>
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 7, marginTop: 8 }}>
                {quickDates.map(q => {
                    const active = dateKey === q.key;
                    return (
                        <TouchableOpacity
                            key={q.label}
                            onPress={() => setDateKey(q.key)}
                            accessibilityRole="button"
                            accessibilityLabel={`Set date to ${q.label}`}
                            style={{
                                paddingHorizontal: 11,
                                paddingVertical: 6,
                                borderRadius: Radius.full,
                                borderWidth: 1,
                                backgroundColor: active ? theme.primary : 'transparent',
                                borderColor: active ? theme.primary : theme.cardBorder,
                            }}
                        >
                            <Text
                                style={{
                                    fontFamily: 'Nunito_700Bold',
                                    fontSize: 12,
                                    color: active ? '#ffffff' : theme.textSecondary,
                                }}
                            >
                                {q.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {showPicker && (
                <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    onChange={(_event, picked) => {
                        setShowPicker(Platform.OS === 'ios');
                        if (picked) setDateKey(toDateKey(picked));
                    }}
                />
            )}

            {label('Note (optional)')}
            <TextInput
                style={{ ...inputStyle, minHeight: 80, textAlignVertical: 'top' }}
                placeholder="Room, requirements, who to ask…"
                placeholderTextColor={theme.textTertiary}
                value={note}
                onChangeText={setNote}
                multiline
                accessibilityLabel="Event note"
            />
            <View style={{ height: 8 }} />
        </KeyboardSheet>
    );
}
