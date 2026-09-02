import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    Modal,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Pressable,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getTheme, Typography, Radius } from '@/constants/Theme';
import { SyncService } from '@/services/SyncService';
import { useSemesterContext } from '@/components/SemesterContext';
import { triggerHaptic } from '@/components/tasks/utils';
import { suggestSchoolYear, toLedgerDateString, createTermInLedger } from '@/utils/onboardingProgress';

const SEMESTER_PRESETS = ['1st Semester', '2nd Semester', 'Summer'];

interface TermSetupModalProps {
    visible: boolean;
    onClose: () => void;
    /** Fired after the term is created and made active. */
    onCreated?: (yearId: string, semId: string) => void;
}

/**
 * A one-screen shortcut for the most common setup: create a school year,
 * add the semester the student is in right now, and select it. The full
 * Academic Terms manager is still there for anything more involved.
 */
export default function TermSetupModal({ visible, onClose, onCreated }: TermSetupModalProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const { setYearAndSemester } = useSemesterContext();

    const [yearName, setYearName] = useState(suggestSchoolYear());
    const [semName, setSemName] = useState(SEMESTER_PRESETS[0]);
    const [customSem, setCustomSem] = useState(false);
    const [startDate, setStartDate] = useState<string | null>(null);
    const [endDate, setEndDate] = useState<string | null>(null);
    const [picker, setPicker] = useState<{ show: boolean; field: 'startDate' | 'endDate'; date: Date }>({
        show: false,
        field: 'startDate',
        date: new Date(),
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset to sensible defaults every time the sheet opens.
    useEffect(() => {
        if (visible) {
            setYearName(suggestSchoolYear());
            setSemName(SEMESTER_PRESETS[0]);
            setCustomSem(false);
            setStartDate(null);
            setEndDate(null);
            setError(null);
            setSaving(false);
        }
    }, [visible]);

    const handleCreate = useCallback(async () => {
        const trimmedYear = yearName.trim();
        const trimmedSem = semName.trim();
        if (!trimmedYear) {
            setError('Give your school year a name, like "2025 - 2026".');
            return;
        }
        if (!trimmedSem) {
            setError('Give your semester a name, like "1st Semester".');
            return;
        }
        if (startDate && endDate && startDate > endDate) {
            setError('The end date needs to come after the start date.');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            let data: any = { settings: {}, years: [] };
            try {
                const str = await AsyncStorage.getItem('grade_ledger_v2_data');
                if (str) data = JSON.parse(str);
            } catch {}

            const { data: newData, yearId, semId } = createTermInLedger(data, trimmedYear, trimmedSem, {
                startDate,
                endDate,
            });

            await SyncService.pushLocalChanges(newData);
            setYearAndSemester(yearId, semId);
            triggerHaptic('success');
            onCreated?.(yearId, semId);
            onClose();
        } catch (e) {
            console.error('Failed to create term', e);
            setError('Something went wrong saving your term. Please try again.');
        } finally {
            setSaving(false);
        }
    }, [yearName, semName, startDate, endDate, setYearAndSemester, onCreated, onClose]);

    const inputStyle = {
        borderWidth: 1,
        borderColor: theme.inputBorder,
        backgroundColor: isDark ? theme.surfaceSecondary : theme.inputBg,
        borderRadius: Radius.lg,
        paddingHorizontal: 14,
        height: 50,
        fontFamily: 'Nunito_700Bold',
        fontSize: 15,
        color: theme.text,
    } as const;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
                <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close term setup" />

                <View
                    style={{
                        backgroundColor: theme.surface,
                        borderTopLeftRadius: Radius['4xl'],
                        borderTopRightRadius: Radius['4xl'],
                        paddingHorizontal: 24,
                        paddingTop: 12,
                        paddingBottom: Platform.OS === 'ios' ? 34 : 24,
                        maxHeight: '88%',
                    }}
                >
                    {/* Grabber */}
                    <View style={{ alignItems: 'center', marginBottom: 16 }}>
                        <View style={{ width: 48, height: 5, borderRadius: 3, backgroundColor: theme.cardBorder }} />
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                            <View
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: Radius.md,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: isDark ? 'rgba(129,140,248,0.18)' : '#eef2ff',
                                    marginRight: 10,
                                }}
                            >
                                <Ionicons name="calendar" size={19} color={theme.primary} />
                            </View>
                            <Text style={{ ...Typography.title, color: theme.text, flex: 1 }}>Set up your term</Text>
                            <TouchableOpacity
                                onPress={onClose}
                                accessibilityRole="button"
                                accessibilityLabel="Close"
                                style={{
                                    width: 32, height: 32, borderRadius: 16,
                                    alignItems: 'center', justifyContent: 'center',
                                    backgroundColor: theme.surfaceSecondary,
                                }}
                            >
                                <Ionicons name="close" size={18} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ ...Typography.caption, color: theme.textSecondary, lineHeight: 19, marginBottom: 22 }}>
                            Your subjects, classes, grades and tasks all live inside a term. This takes about ten seconds.
                        </Text>

                        {/* School year */}
                        <Text style={{ ...Typography.label, textTransform: 'uppercase', letterSpacing: 1, color: theme.textTertiary, marginBottom: 8 }}>
                            School year
                        </Text>
                        <TextInput
                            value={yearName}
                            onChangeText={(t) => { setYearName(t); setError(null); }}
                            placeholder="e.g. 2025 - 2026"
                            placeholderTextColor={theme.textTertiary}
                            style={inputStyle}
                            accessibilityLabel="School year name"
                        />

                        {/* Semester */}
                        <Text style={{ ...Typography.label, textTransform: 'uppercase', letterSpacing: 1, color: theme.textTertiary, marginTop: 22, marginBottom: 8 }}>
                            Which term are you in?
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {SEMESTER_PRESETS.map((preset) => {
                                const active = !customSem && semName === preset;
                                return (
                                    <TouchableOpacity
                                        key={preset}
                                        onPress={() => { triggerHaptic('light'); setCustomSem(false); setSemName(preset); setError(null); }}
                                        activeOpacity={0.8}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: active }}
                                        style={{
                                            paddingHorizontal: 16,
                                            paddingVertical: 10,
                                            borderRadius: Radius.full,
                                            borderWidth: 1.5,
                                            borderColor: active ? theme.primary : theme.cardBorder,
                                            backgroundColor: active
                                                ? (isDark ? 'rgba(129,140,248,0.18)' : '#eef2ff')
                                                : 'transparent',
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontFamily: 'Nunito_700Bold',
                                                fontSize: 13,
                                                color: active ? theme.primary : theme.textSecondary,
                                            }}
                                        >
                                            {preset}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                            <TouchableOpacity
                                onPress={() => { triggerHaptic('light'); setCustomSem(true); setSemName(''); setError(null); }}
                                activeOpacity={0.8}
                                accessibilityRole="button"
                                accessibilityState={{ selected: customSem }}
                                style={{
                                    paddingHorizontal: 16,
                                    paddingVertical: 10,
                                    borderRadius: Radius.full,
                                    borderWidth: 1.5,
                                    borderColor: customSem ? theme.primary : theme.cardBorder,
                                    backgroundColor: customSem ? (isDark ? 'rgba(129,140,248,0.18)' : '#eef2ff') : 'transparent',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                }}
                            >
                                <Ionicons name="create-outline" size={14} color={customSem ? theme.primary : theme.textSecondary} />
                                <Text
                                    style={{
                                        fontFamily: 'Nunito_700Bold',
                                        fontSize: 13,
                                        marginLeft: 5,
                                        color: customSem ? theme.primary : theme.textSecondary,
                                    }}
                                >
                                    Custom
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {customSem && (
                            <TextInput
                                value={semName}
                                onChangeText={(t) => { setSemName(t); setError(null); }}
                                placeholder="e.g. Trimester 1"
                                placeholderTextColor={theme.textTertiary}
                                autoFocus
                                style={[inputStyle, { marginTop: 12 }]}
                                accessibilityLabel="Custom term name"
                            />
                        )}

                        {/* Dates */}
                        <Text style={{ ...Typography.label, textTransform: 'uppercase', letterSpacing: 1, color: theme.textTertiary, marginTop: 22, marginBottom: 8 }}>
                            Term dates (optional)
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            {([
                                { field: 'startDate' as const, label: 'Starts', value: startDate },
                                { field: 'endDate' as const, label: 'Ends', value: endDate },
                            ]).map(({ field, label, value }) => (
                                <TouchableOpacity
                                    key={field}
                                    onPress={() => setPicker({ show: true, field, date: value ? new Date(value) : new Date() })}
                                    activeOpacity={0.8}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${label} date`}
                                    style={{
                                        flex: 1,
                                        borderWidth: 1,
                                        borderColor: theme.inputBorder,
                                        backgroundColor: isDark ? theme.surfaceSecondary : theme.inputBg,
                                        borderRadius: Radius.lg,
                                        paddingHorizontal: 14,
                                        height: 50,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                    }}
                                >
                                    <Ionicons name="calendar-outline" size={16} color={theme.textTertiary} />
                                    <Text
                                        numberOfLines={1}
                                        style={{
                                            marginLeft: 8,
                                            flex: 1,
                                            fontFamily: 'Nunito_700Bold',
                                            fontSize: 13,
                                            color: value ? theme.text : theme.textTertiary,
                                        }}
                                    >
                                        {value || label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={{ ...Typography.caption, fontSize: 12, color: theme.textTertiary, marginTop: 8 }}>
                            Adding dates lets the dashboard show how far along the term is.
                        </Text>

                        {error && (
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    marginTop: 16,
                                    padding: 12,
                                    borderRadius: Radius.lg,
                                    backgroundColor: isDark ? 'rgba(248,113,113,0.12)' : theme.errorLight,
                                }}
                            >
                                <Ionicons name="alert-circle" size={16} color={theme.error} />
                                <Text style={{ marginLeft: 8, flex: 1, fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: theme.error }}>
                                    {error}
                                </Text>
                            </View>
                        )}

                        {/* Create */}
                        <TouchableOpacity
                            onPress={handleCreate}
                            disabled={saving}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            style={{
                                marginTop: 24,
                                height: 54,
                                borderRadius: Radius.full,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: theme.primary,
                                opacity: saving ? 0.7 : 1,
                            }}
                        >
                            {saving ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginRight: 8 }} />
                                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: '#fff' }}>
                                        Create term
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>

            {picker.show && (
                <DateTimePicker
                    value={picker.date}
                    mode="date"
                    display="default"
                    onChange={(event, selected) => {
                        setPicker((prev) => ({ ...prev, show: false }));
                        if (event.type === 'set' && selected) {
                            const formatted = toLedgerDateString(selected);
                            if (picker.field === 'startDate') setStartDate(formatted);
                            else setEndDate(formatted);
                            setError(null);
                        }
                    }}
                />
            )}
        </Modal>
    );
}
