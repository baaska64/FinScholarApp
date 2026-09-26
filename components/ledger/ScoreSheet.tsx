import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import KeyboardSheet from '@/components/ui/KeyboardSheet';
import AnimatedPressable from '@/components/ui/AnimatedPressable';
import { getTheme, getTints, Radius } from '@/constants/Theme';
import { getGradeTierColor, getGradeTierLabel } from '@/utils/gradeTiers';
import { formatWeight, scorePercent, scoreProblem, weightProblem, ItemDraft } from '@/utils/gradeEntry';

export interface ScoreSheetProps {
    visible: boolean;
    onClose: () => void;
    mode: 'create' | 'edit';
    /** Where the score lives, for the subtitle: "Quizzes · Prelim". */
    context: string;
    initial: ItemDraft;
    /** Bump to reload `initial` into the form while the sheet stays open. */
    resetKey: number;
    /** Share each blank-weighted sibling receives, for the weight placeholder. */
    autoWeight: number;
    /** "Quizzes" — what the weight is a share of. */
    weightScope: string;
    /** The node is worked out from its parts, so it has no score of its own. */
    partCount: number;
    canAddPart: boolean;
    onSave: (draft: ItemDraft, next: 'close' | 'another' | 'part') => void;
    onDelete?: () => void;
}

const MAX_PRESETS = [10, 20, 25, 50, 100];

/**
 * Entering one score.
 *
 * The old screen put every score in a 28pt-tall inline row: a name field, a
 * score and max squeezed into one box, a WT field, a +SUB button and a delete
 * cross — six targets across a phone width, all live, so each keystroke also
 * pushed the whole ledger to the cloud. This is one score at a time with big
 * fields, a live read of what the score means, and a draft that commits once.
 * "Save & add another" keeps bulk entry to one tap per score.
 */
export default function ScoreSheet({
    visible, onClose, mode, context, initial, resetKey, autoWeight, weightScope,
    partCount, canAddPart, onSave, onDelete,
}: ScoreSheetProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const tints = getTints(isDark);

    const [name, setName] = useState('');
    const [score, setScore] = useState('');
    const [max, setMax] = useState('100');
    const [weight, setWeight] = useState('');
    const [showErrors, setShowErrors] = useState(false);
    const scoreRef = useRef<TextInput>(null);

    useEffect(() => {
        if (!visible) return;
        setName(initial.name ?? '');
        setScore(initial.score === undefined || initial.score === null ? '' : String(initial.score));
        setMax(initial.max === undefined || initial.max === null || initial.max === '' ? '100' : String(initial.max));
        setWeight(initial.weight === undefined || initial.weight === null ? '' : String(initial.weight));
        setShowErrors(false);
        // A fresh "add another" lands the cursor back in the score field.
        if (mode === 'create' && partCount === 0) {
            const t = setTimeout(() => scoreRef.current?.focus(), 250);
            return () => clearTimeout(t);
        }
    }, [visible, resetKey]);

    const isParent = partCount > 0;
    const pct = isParent ? null : scorePercent(score, max);
    const problem = isParent ? null : scoreProblem(score, max);
    const wProblem = weightProblem(weight);
    const blocked = Boolean((problem && problem.blocking) || wProblem);

    const save = (next: 'close' | 'another' | 'part') => {
        if (blocked) {
            setShowErrors(true);
            return;
        }
        const draft: ItemDraft = { name: name.trim(), weight: weight.trim() };
        if (!isParent) {
            draft.score = score.trim();
            draft.max = max.trim();
        }
        onSave(draft, next);
    };

    const tierColor = pct === null ? theme.textTertiary : getGradeTierColor(pct, isDark, true);

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
            title={mode === 'create' ? (isParent ? 'Add part' : 'Add score') : isParent ? 'Edit group' : 'Edit score'}
            subtitle={context}
            icon={mode === 'create' ? 'add-circle-outline' : 'create-outline'}
            tint={tints.grades}
            footer={
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    {mode === 'edit' && onDelete ? (
                        <TouchableOpacity
                            onPress={onDelete}
                            activeOpacity={0.75}
                            accessibilityRole="button"
                            accessibilityLabel="Delete this score"
                            style={{
                                width: 50, height: 50, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center',
                                backgroundColor: tints.danger.fill, borderWidth: 1, borderColor: tints.danger.line,
                            }}
                        >
                            <Ionicons name="trash-outline" size={19} color={tints.danger.ink} />
                        </TouchableOpacity>
                    ) : mode === 'create' ? (
                        <TouchableOpacity
                            onPress={() => save('another')}
                            activeOpacity={0.75}
                            accessibilityRole="button"
                            accessibilityLabel="Save and add another score"
                            style={{
                                flex: 1, height: 50, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center',
                                backgroundColor: theme.surfaceSecondary, borderWidth: 1, borderColor: theme.cardBorder,
                                borderBottomWidth: 2, borderBottomColor: theme.lip,
                            }}
                        >
                            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: theme.text }}>Save & add another</Text>
                        </TouchableOpacity>
                    ) : null}
                    <AnimatedPressable
                        onPress={() => save('close')}
                        accessibilityRole="button"
                        accessibilityLabel="Save"
                        style={{
                            flex: 1, height: 50, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center',
                            backgroundColor: theme.primary, borderBottomWidth: 3, borderBottomColor: theme.primaryDark,
                        }}
                    >
                        <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 15, color: '#ffffff' }}>Save</Text>
                    </AnimatedPressable>
                </View>
            }
        >
            <Text style={label}>Name</Text>
            <TextInput
                value={name}
                onChangeText={setName}
                selectTextOnFocus
                placeholder="e.g. Quiz 1"
                placeholderTextColor={theme.textTertiary}
                accessibilityLabel="Score name"
                returnKeyType="next"
                onSubmitEditing={() => scoreRef.current?.focus()}
                style={{ ...field, height: 48, paddingHorizontal: 14, fontFamily: 'Nunito_700Bold', fontSize: 15, marginBottom: 18 }}
            />

            {isParent ? (
                <View style={{
                    flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: Radius.lg, marginBottom: 18,
                    backgroundColor: tints.grades.fill, borderWidth: 1, borderColor: tints.grades.line,
                }}>
                    <Ionicons name="git-branch-outline" size={16} color={tints.grades.ink} style={{ marginRight: 9 }} />
                    <Text style={{ flex: 1, fontFamily: 'Nunito_600SemiBold', fontSize: 12.5, lineHeight: 18, color: theme.textSecondary }}>
                        Worked out from its {partCount} part{partCount !== 1 ? 's' : ''}. Tap a part in the list to change its score.
                    </Text>
                </View>
            ) : (
                <>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={label}>Score</Text>
                            <TextInput
                                ref={scoreRef}
                                value={score}
                                onChangeText={setScore}
                                keyboardType="decimal-pad"
                                selectTextOnFocus
                                placeholder="—"
                                placeholderTextColor={theme.textTertiary}
                                accessibilityLabel="Score"
                                style={{ ...field, height: 64, textAlign: 'center', fontFamily: 'Nunito_900Black', fontSize: 28, letterSpacing: -0.6 }}
                            />
                        </View>
                        <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 26, color: theme.textTertiary, paddingBottom: 14 }}>/</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={label}>Out of</Text>
                            <TextInput
                                value={max}
                                onChangeText={setMax}
                                keyboardType="decimal-pad"
                                selectTextOnFocus
                                placeholder="100"
                                placeholderTextColor={theme.textTertiary}
                                accessibilityLabel="Maximum score"
                                style={{ ...field, height: 64, textAlign: 'center', fontFamily: 'Nunito_900Black', fontSize: 28, letterSpacing: -0.6, color: theme.textSecondary }}
                            />
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                        {MAX_PRESETS.map((m) => {
                            const active = String(m) === max.trim();
                            return (
                                <TouchableOpacity
                                    key={m}
                                    onPress={() => setMax(String(m))}
                                    activeOpacity={0.75}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Out of ${m}`}
                                    style={{
                                        flex: 1, height: 30, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center',
                                        backgroundColor: active ? tints.grades.fill : theme.surfaceSecondary,
                                        borderWidth: 1, borderColor: active ? tints.grades.line : theme.cardBorder,
                                    }}
                                >
                                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: active ? tints.grades.ink : theme.textSecondary }}>/{m}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* What the number means, as it is typed */}
                    <View style={{
                        flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, marginBottom: 18,
                        padding: 12, borderRadius: Radius.lg,
                        backgroundColor: problem ? (problem.blocking ? tints.danger.fill : tints.tasks.fill) : theme.surfaceSecondary,
                        borderWidth: 1, borderColor: problem ? (problem.blocking ? tints.danger.line : tints.tasks.line) : theme.cardBorder,
                    }}>
                        {problem ? (
                            <>
                                <Ionicons name={problem.blocking ? 'alert-circle' : 'information-circle'} size={17} color={problem.blocking ? tints.danger.ink : tints.tasks.ink} />
                                <Text style={{ flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: problem.blocking ? tints.danger.ink : tints.tasks.ink }}>
                                    {problem.message}
                                </Text>
                            </>
                        ) : null}
                        {!problem || !problem.blocking ? (
                            pct !== null ? (
                                <>
                                    {!problem && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tierColor }} />}
                                    <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 17, color: tierColor, letterSpacing: -0.4 }}>{pct.toFixed(1)}%</Text>
                                    {!problem && (
                                        <Text style={{ flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: theme.textSecondary }}>
                                            {getGradeTierLabel(pct, true)}
                                        </Text>
                                    )}
                                </>
                            ) : (
                                <Text style={{ flex: 1, fontFamily: 'Nunito_600SemiBold', fontSize: 12, lineHeight: 17, color: theme.textTertiary }}>
                                    Leave the score blank for work that isn't graded yet. It counts toward what you still need.
                                </Text>
                            )
                        ) : null}
                    </View>
                </>
            )}

            <Text style={label}>Weight within {weightScope || 'its group'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ ...field, flexDirection: 'row', alignItems: 'center', width: 120, height: 48, paddingHorizontal: 14 }}>
                    <TextInput
                        value={weight}
                        onChangeText={setWeight}
                        keyboardType="decimal-pad"
                        placeholder={formatWeight(autoWeight)}
                        placeholderTextColor={theme.textTertiary}
                        accessibilityLabel={`Weight within ${weightScope}, percent. Blank splits evenly.`}
                        style={{ flex: 1, minWidth: 0, padding: 0, fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: theme.text }}
                    />
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: theme.textTertiary }}>%</Text>
                </View>
                <Text style={{ flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 11.5, lineHeight: 16, color: theme.textTertiary }}>
                    Leave blank to split evenly with the others.
                </Text>
            </View>
            {showErrors && wProblem && (
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: tints.danger.ink, marginTop: 6 }}>{wProblem}</Text>
            )}

            {mode === 'edit' && canAddPart && (
                <TouchableOpacity
                    onPress={() => save('part')}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={isParent ? 'Add another part' : 'Split this score into parts'}
                    style={{
                        flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18,
                        paddingVertical: 12, paddingHorizontal: 12, borderRadius: Radius.lg,
                        borderWidth: 1, borderStyle: 'dashed', borderColor: isDark ? '#2c3444' : '#cbd5e1',
                    }}
                >
                    <Ionicons name="git-branch-outline" size={16} color={theme.textSecondary} />
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13, color: theme.text }}>
                            {isParent ? 'Add another part' : 'Split into parts'}
                        </Text>
                        <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary, marginTop: 1 }}>
                            {isParent ? 'Saves this, then adds a part.' : 'For a score made of pieces, like a lab with a report and a demo.'}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={15} color={theme.textTertiary} />
                </TouchableOpacity>
            )}
        </KeyboardSheet>
    );
}
