import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import DateTimePicker from '@react-native-community/datetimepicker';
import KeyboardSheet from '@/components/ui/KeyboardSheet';
import ProgressBar from '@/components/ui/ProgressBar';
import { getTheme, getTints, Radius } from '@/constants/Theme';
import { formatDateKeyLong, parseDateKey, toDateKey, type TermProgress } from '@/utils/calendarModel';

interface TermSheetProps {
    visible: boolean;
    onClose: () => void;
    termLabel: string;
    progress: TermProgress;
    onSetDate: (field: 'startDate' | 'endDate', dateKey: string) => void;
}

/**
 * Term dates, and what they mean.
 *
 * These used to be a permanent card above the calendar showing two raw dates
 * and nothing else — a control a student touches twice a semester, occupying
 * the space the calendar needed. It moved behind the term strip, and gained the
 * arithmetic that makes the dates worth setting: which week of the term today
 * is, and how many days are left.
 */
export default function TermSheet({ visible, onClose, termLabel, progress, onSetDate }: TermSheetProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const tints = getTints(isDark);

    const [picker, setPicker] = useState<null | 'startDate' | 'endDate'>(null);

    const rows: { field: 'startDate' | 'endDate'; label: string; key: string | null; icon: keyof typeof Ionicons.glyphMap }[] = [
        { field: 'startDate', label: 'First day of term', key: progress.startKey, icon: 'play-circle-outline' },
        { field: 'endDate', label: 'Last day of term', key: progress.endKey, icon: 'flag-outline' },
    ];

    const summary =
        progress.state === 'active'
            ? `Week ${progress.weekNumber} of ${progress.totalWeeks} · ${progress.daysLeft} ${progress.daysLeft === 1 ? 'day' : 'days'} left`
            : progress.state === 'upcoming'
                ? `Starts in ${progress.daysUntilStart} ${progress.daysUntilStart === 1 ? 'day' : 'days'}`
                : progress.state === 'ended'
                    ? 'This term has ended'
                    : 'Set both dates to see how much term is left';

    return (
        <KeyboardSheet
            visible={visible}
            onClose={onClose}
            title="Term dates"
            subtitle={termLabel}
            icon="calendar-number-outline"
            tint={tints.schedule}
            maxHeightRatio={0.75}
        >
            <View
                style={{
                    padding: 14,
                    borderRadius: Radius['2xl'],
                    backgroundColor: tints.schedule.fill,
                    borderWidth: 1,
                    borderColor: tints.schedule.line,
                    marginBottom: 16,
                }}
            >
                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: tints.schedule.ink }}>
                    {summary}
                </Text>
                {progress.state === 'active' && (
                    <View style={{ marginTop: 10 }}>
                        <ProgressBar
                            progress={progress.percent}
                            color={tints.schedule.solid}
                            accessibilityLabel={`Term progress, ${Math.round(progress.percent * 100)} percent`}
                        />
                        <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: tints.schedule.ink, marginTop: 6 }}>
                            {`Day ${progress.dayNumber} of ${progress.totalDays}`}
                        </Text>
                    </View>
                )}
            </View>

            {rows.map(row => (
                <TouchableOpacity
                    key={row.field}
                    onPress={() => setPicker(row.field)}
                    accessibilityRole="button"
                    accessibilityLabel={`${row.label}: ${row.key ? formatDateKeyLong(row.key) : 'not set'}. Tap to change.`}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 13,
                        borderRadius: Radius.xl,
                        borderWidth: 1,
                        borderColor: theme.cardBorder,
                        borderBottomWidth: 2,
                        borderBottomColor: theme.lip,
                        backgroundColor: theme.surface,
                        marginBottom: 10,
                    }}
                >
                    <Ionicons name={row.icon} size={19} color={theme.textSecondary} style={{ marginRight: 11 }} />
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textTertiary, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                            {row.label}
                        </Text>
                        <Text
                            style={{
                                fontFamily: 'Nunito_800ExtraBold',
                                fontSize: 14.5,
                                marginTop: 2,
                                color: row.key ? theme.text : theme.primary,
                            }}
                        >
                            {row.key ? formatDateKeyLong(row.key) : 'Tap to set'}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
                </TouchableOpacity>
            ))}

            <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textTertiary, lineHeight: 18, marginTop: 4 }}>
                Term dates shade the calendar and stop your weekly classes from showing up outside the semester.
            </Text>

            {picker && (
                <DateTimePicker
                    value={
                        (picker === 'startDate' ? parseDateKey(progress.startKey || '') : parseDateKey(progress.endKey || '')) ||
                        new Date()
                    }
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    onChange={(_event, picked) => {
                        const field = picker;
                        setPicker(Platform.OS === 'ios' ? picker : null);
                        if (picked && field) {
                            onSetDate(field, toDateKey(picked));
                            if (Platform.OS === 'ios') setPicker(null);
                        }
                    }}
                />
            )}
            <View style={{ height: 8 }} />
        </KeyboardSheet>
    );
}
