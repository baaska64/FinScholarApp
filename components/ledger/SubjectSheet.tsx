import React, { useEffect, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useColorScheme } from 'nativewind';
import KeyboardSheet from '@/components/ui/KeyboardSheet';
import AnimatedPressable from '@/components/ui/AnimatedPressable';
import { getTheme, getTints, Radius } from '@/constants/Theme';

export interface SubjectDraft {
    name: string;
    units: string;
    passingPercent: string;
    targetValue: string;
}

interface SubjectSheetProps {
    visible: boolean;
    onClose: () => void;
    initial: SubjectDraft;
    onSave: (draft: SubjectDraft) => void;
}

const pctProblem = (v: string, what: string) => {
    if (!v.trim()) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0 || n > 100) return `${what} must be between 1 and 100`;
    return null;
};

/**
 * The four numbers that define a subject. They were three always-live fields
 * under the grade plus a name typed straight into the headline, so a stray tap
 * on the title started renaming the subject; now they are one form, reached
 * from the chips under the name.
 */
export default function SubjectSheet({ visible, onClose, initial, onSave }: SubjectSheetProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const tints = getTints(isDark);

    const [d, setD] = useState<SubjectDraft>(initial);
    const [showErrors, setShowErrors] = useState(false);

    useEffect(() => {
        if (!visible) return;
        setD(initial);
        setShowErrors(false);
    }, [visible]);

    const unitsN = Number(d.units);
    const problems = [
        !d.name.trim() ? 'Give the subject a name' : null,
        d.units.trim() && (!Number.isFinite(unitsN) || unitsN < 0) ? 'Units must be 0 or more' : null,
        pctProblem(d.passingPercent, 'Pass mark'),
        pctProblem(d.targetValue, 'Target'),
    ].filter(Boolean) as string[];

    const save = () => {
        if (problems.length) {
            setShowErrors(true);
            return;
        }
        onSave({ ...d, name: d.name.trim(), units: d.units.trim(), passingPercent: d.passingPercent.trim(), targetValue: d.targetValue.trim() });
    };

    const label = {
        fontFamily: 'Nunito_800ExtraBold' as const, fontSize: 10, letterSpacing: 0.8,
        textTransform: 'uppercase' as const, color: theme.textTertiary, marginBottom: 7,
    };
    const field = {
        borderRadius: Radius.lg, borderWidth: 1, borderColor: theme.inputBorder,
        backgroundColor: theme.inputBg, color: theme.text,
    };

    const numberField = (key: 'units' | 'passingPercent' | 'targetValue', title: string, placeholder: string, hint: string, suffix?: string) => (
        <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={label}>{title}</Text>
            <View style={{ ...field, flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 12 }}>
                <TextInput
                    value={d[key]}
                    onChangeText={(t) => setD((x) => ({ ...x, [key]: t }))}
                    keyboardType="decimal-pad"
                    placeholder={placeholder}
                    placeholderTextColor={theme.textTertiary}
                    accessibilityLabel={`${title}. ${hint}`}
                    style={{ flex: 1, minWidth: 0, padding: 0, fontFamily: 'Nunito_900Black', fontSize: 22, color: theme.text, letterSpacing: -0.4 }}
                />
                {suffix ? <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: theme.textTertiary }}>{suffix}</Text> : null}
            </View>
            <Text numberOfLines={2} style={{ fontFamily: 'Nunito_400Regular', fontSize: 11, lineHeight: 15, color: theme.textTertiary, marginTop: 5 }}>{hint}</Text>
        </View>
    );

    return (
        <KeyboardSheet
            visible={visible}
            onClose={onClose}
            title="Subject details"
            subtitle="Name, units and the marks you are measured against"
            icon="school-outline"
            tint={tints.grades}
            footer={
                <AnimatedPressable
                    onPress={save}
                    accessibilityRole="button"
                    accessibilityLabel="Save subject details"
                    style={{
                        height: 50, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: theme.primary, borderBottomWidth: 3, borderBottomColor: theme.primaryDark,
                    }}
                >
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 15, color: '#ffffff' }}>Save</Text>
                </AnimatedPressable>
            }
        >
            <Text style={label}>Name</Text>
            <TextInput
                value={d.name}
                onChangeText={(t) => setD((x) => ({ ...x, name: t }))}
                autoCapitalize="characters"
                placeholder="e.g. MATH101"
                placeholderTextColor={theme.textTertiary}
                accessibilityLabel="Subject name"
                style={{ ...field, height: 48, paddingHorizontal: 14, fontFamily: 'Nunito_800ExtraBold', fontSize: 15, marginBottom: 6 }}
            />
            <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11, color: theme.textTertiary, marginBottom: 18 }}>
                Renaming also renames its classes in your schedule.
            </Text>

            <View style={{ flexDirection: 'row', gap: 10 }}>
                {numberField('units', 'Units', '3', 'How much it weighs in your GWA')}
                {numberField('passingPercent', 'Pass mark', '60', 'Lowest passing score', '%')}
                {numberField('targetValue', 'Target', d.passingPercent.trim() || '60', 'What you are aiming for', '%')}
            </View>

            {showErrors && problems.length > 0 && (
                <View style={{ marginTop: 14, padding: 11, borderRadius: Radius.md, backgroundColor: tints.danger.fill, borderWidth: 1, borderColor: tints.danger.line }}>
                    {problems.map((p) => (
                        <Text key={p} style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: tints.danger.ink }}>{p}</Text>
                    ))}
                </View>
            )}
        </KeyboardSheet>
    );
}
