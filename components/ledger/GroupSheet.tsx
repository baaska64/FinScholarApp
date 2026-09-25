import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import KeyboardSheet from '@/components/ui/KeyboardSheet';
import AnimatedPressable from '@/components/ui/AnimatedPressable';
import { getTheme, getTints, Radius } from '@/constants/Theme';
import { formatWeight, weightProblem, NodeDraft } from '@/utils/gradeEntry';

interface GroupSheetProps {
    visible: boolean;
    onClose: () => void;
    kind: 'period' | 'component';
    mode: 'create' | 'edit';
    initial: NodeDraft;
    /** "Prelim" for a component, the subject name for a period. */
    parentName: string;
    autoWeight: number;
    onSave: (draft: NodeDraft) => void;
    onDelete?: () => void;
}

const PRESETS: Record<'period' | 'component', string[]> = {
    period: ['Prelim', 'Midterm', 'Pre-final', 'Finals', 'Q1', 'Q2'],
    component: ['Quizzes', 'Exams', 'Assignments', 'Projects', 'Recitation', 'Laboratory', 'Attendance'],
};

/**
 * Name and weight for a period or a component — the two levels above a score.
 * They used to be edited in place in a header row that also held the grade, a
 * WT field and a delete button; here they get a form of their own, with the
 * names students actually type offered as one-tap presets.
 */
export default function GroupSheet({ visible, onClose, kind, mode, initial, parentName, autoWeight, onSave, onDelete }: GroupSheetProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const tints = getTints(isDark);

    const [name, setName] = useState('');
    const [weight, setWeight] = useState('');
    const [showErrors, setShowErrors] = useState(false);

    useEffect(() => {
        if (!visible) return;
        setName(initial.name ?? '');
        setWeight(initial.weight === undefined || initial.weight === null ? '' : String(initial.weight));
        setShowErrors(false);
    }, [visible]);

    const noun = kind === 'period' ? 'period' : 'component';
    const wProblem = weightProblem(weight);
    const nameMissing = !name.trim();

    const save = () => {
        if (wProblem || nameMissing) {
            setShowErrors(true);
            return;
        }
        onSave({ name: name.trim(), weight: weight.trim() });
    };

    const label = {
        fontFamily: 'Nunito_800ExtraBold' as const, fontSize: 10, letterSpacing: 0.8,
        textTransform: 'uppercase' as const, color: theme.textTertiary, marginBottom: 7,
    };
    const field = {
        borderRadius: Radius.lg, borderWidth: 1, borderColor: theme.inputBorder,
        backgroundColor: theme.inputBg, color: theme.text,
    };

    return (
        <KeyboardSheet
            visible={visible}
            onClose={onClose}
            title={`${mode === 'create' ? 'New' : 'Edit'} ${noun}`}
            subtitle={kind === 'period' ? 'A term split, like Prelim or Finals' : `Part of ${parentName}, like Quizzes or Exams`}
            icon={kind === 'period' ? 'layers-outline' : 'albums-outline'}
            tint={tints.grades}
            footer={
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    {mode === 'edit' && onDelete && (
                        <TouchableOpacity
                            onPress={onDelete}
                            activeOpacity={0.75}
                            accessibilityRole="button"
                            accessibilityLabel={`Delete this ${noun}`}
                            style={{
                                width: 50, height: 50, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center',
                                backgroundColor: tints.danger.fill, borderWidth: 1, borderColor: tints.danger.line,
                            }}
                        >
                            <Ionicons name="trash-outline" size={19} color={tints.danger.ink} />
                        </TouchableOpacity>
                    )}
                    <AnimatedPressable
                        onPress={save}
                        accessibilityRole="button"
                        accessibilityLabel={mode === 'create' ? `Add ${noun}` : 'Save'}
                        style={{
                            flex: 1, height: 50, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center',
                            backgroundColor: theme.primary, borderBottomWidth: 3, borderBottomColor: theme.primaryDark,
                        }}
                    >
                        <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 15, color: '#ffffff' }}>
                            {mode === 'create' ? `Add ${noun}` : 'Save'}
                        </Text>
                    </AnimatedPressable>
                </View>
            }
        >
            <Text style={label}>Name</Text>
            <TextInput
                value={name}
                onChangeText={setName}
                selectTextOnFocus
                autoFocus={mode === 'create'}
                placeholder={kind === 'period' ? 'e.g. Midterm' : 'e.g. Quizzes'}
                placeholderTextColor={theme.textTertiary}
                accessibilityLabel={`${noun} name`}
                style={{ ...field, height: 48, paddingHorizontal: 14, fontFamily: 'Nunito_700Bold', fontSize: 15 }}
            />
            {showErrors && nameMissing && (
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: tints.danger.ink, marginTop: 6 }}>Give it a name.</Text>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 10, marginBottom: 18 }} contentContainerStyle={{ gap: 6 }}>
                {PRESETS[kind].map((p) => {
                    const active = p === name.trim();
                    return (
                        <TouchableOpacity
                            key={p}
                            onPress={() => setName(p)}
                            activeOpacity={0.75}
                            accessibilityRole="button"
                            accessibilityLabel={`Name it ${p}`}
                            style={{
                                paddingHorizontal: 12, height: 30, borderRadius: Radius.full, justifyContent: 'center',
                                backgroundColor: active ? tints.grades.fill : theme.surfaceSecondary,
                                borderWidth: 1, borderColor: active ? tints.grades.line : theme.cardBorder,
                            }}
                        >
                            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: active ? tints.grades.ink : theme.textSecondary }}>{p}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <Text style={label}>Weight within {parentName}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ ...field, flexDirection: 'row', alignItems: 'center', width: 120, height: 48, paddingHorizontal: 14 }}>
                    <TextInput
                        value={weight}
                        onChangeText={setWeight}
                        keyboardType="decimal-pad"
                        placeholder={formatWeight(autoWeight)}
                        placeholderTextColor={theme.textTertiary}
                        accessibilityLabel="Weight, percent. Blank splits evenly."
                        style={{ flex: 1, minWidth: 0, padding: 0, fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: theme.text }}
                    />
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: theme.textTertiary }}>%</Text>
                </View>
                <Text style={{ flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 11.5, lineHeight: 16, color: theme.textTertiary }}>
                    Leave blank to split evenly with the other {noun}s.
                </Text>
            </View>
            {showErrors && wProblem && (
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: tints.danger.ink, marginTop: 6 }}>{wProblem}</Text>
            )}
        </KeyboardSheet>
    );
}
