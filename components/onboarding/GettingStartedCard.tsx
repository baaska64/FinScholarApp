import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { router } from 'expo-router';
import { getTheme, getTints, Radius } from '@/constants/Theme';
import { triggerHaptic } from '@/components/tasks/utils';
import { deriveOnboardingProgress } from '@/utils/onboardingProgress';

export interface GettingStartedStep {
    key: string;
    label: string;
    hint: string;
    icon: keyof typeof Ionicons.glyphMap;
    done: boolean;
    onPress: () => void;
}

/**
 * Works out which first-run steps are still outstanding for the active term.
 * Exported so the dashboard can decide whether the card is worth rendering
 * before it mounts anything.
 */
export function buildGettingStartedSteps(
    data: any,
    activeYearId: string | null,
    activeSemId: string | null,
    onSetupTerm: () => void
): GettingStartedStep[] {
    const { hasTerm, hasSubjects, hasClasses, hasTasks } = deriveOnboardingProgress(
        data,
        activeYearId,
        activeSemId
    );

    return [
        {
            key: 'term',
            label: 'Create your term',
            hint: 'A school year and semester to hold everything.',
            icon: 'calendar',
            done: hasTerm,
            onPress: onSetupTerm,
        },
        {
            key: 'subjects',
            label: 'Add your subjects',
            hint: 'Units and passing marks power your GWA.',
            icon: 'school',
            done: hasSubjects,
            onPress: () => router.push('/(tabs)/grades'),
        },
        {
            key: 'schedule',
            label: 'Build your schedule',
            hint: 'Scan your timetable or add classes by hand.',
            icon: 'time',
            done: hasClasses,
            onPress: () => router.push('/(tabs)/schedule'),
        },
        {
            key: 'tasks',
            label: 'Add your first task',
            hint: 'Assignments and exams show up on your dashboard.',
            icon: 'list',
            done: hasTasks,
            onPress: () => router.push('/(tabs)/requirements'),
        },
    ];
}

interface GettingStartedCardProps {
    steps: GettingStartedStep[];
    onDismiss: () => void;
    /** Replays the guided walkthrough of the app. */
    onStartTour?: () => void;
}

/**
 * Setup progress, sized to its remaining value. Finished steps collapse into a
 * row of pips and a count; the one step still outstanding gets the whole
 * call-to-action. Everything stays reachable through "All steps", so a student
 * who wants to revisit a completed step still can.
 */
export default function GettingStartedCard({ steps, onDismiss, onStartTour }: GettingStartedCardProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const tints = getTints(isDark);
    const [expanded, setExpanded] = useState(false);

    const doneCount = useMemo(() => steps.filter((s) => s.done).length, [steps]);
    const nextStep = steps.find((s) => !s.done);

    return (
        <View
            style={{
                borderRadius: Radius.xl,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.cardBorder,
                borderBottomWidth: 2,
                borderBottomColor: theme.lip,
                overflow: 'hidden',
            }}
        >
            {/* Header: what this is, how far along, and the way to hide it */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 13, paddingBottom: 11 }}>
                <View
                    style={{
                        width: 28, height: 28, borderRadius: Radius.sm,
                        alignItems: 'center', justifyContent: 'center', marginRight: 10,
                        backgroundColor: tints.schedule.fill,
                        borderWidth: 1, borderColor: tints.schedule.line,
                    }}
                >
                    <Ionicons name="rocket" size={15} color={tints.schedule.ink} />
                </View>

                <Text style={{ flex: 1, fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: theme.text }}>
                    Getting started
                </Text>

                {/* Progress pips — one per step, filled as they complete */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: 8 }}>
                    {steps.map((s) => (
                        <View
                            key={s.key}
                            style={{
                                width: 14, height: 4, borderRadius: 2,
                                backgroundColor: s.done ? tints.attendance.solid : (isDark ? 'rgba(148,163,184,0.25)' : theme.cardBorder),
                            }}
                        />
                    ))}
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textSecondary, marginLeft: 5 }}>
                        {doneCount}/{steps.length}
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={() => { triggerHaptic('light'); onDismiss(); }}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel="Hide the getting started checklist"
                    style={{
                        width: 26, height: 26, borderRadius: 13,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: theme.surfaceSecondary,
                    }}
                >
                    <Ionicons name="close" size={14} color={theme.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* The one thing left to do, as the card's primary action */}
            {nextStep && (
                <TouchableOpacity
                    onPress={() => { triggerHaptic('light'); nextStep.onPress(); }}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`${nextStep.label}. ${nextStep.hint}`}
                    style={{
                        flexDirection: 'row', alignItems: 'center',
                        marginHorizontal: 12, marginBottom: 10,
                        paddingHorizontal: 12, paddingVertical: 11,
                        borderRadius: Radius.lg,
                        backgroundColor: theme.primary,
                        borderBottomWidth: 3,
                        borderBottomColor: isDark ? '#4338ca' : '#3730a3',
                    }}
                >
                    <View
                        style={{
                            width: 30, height: 30, borderRadius: 15, marginRight: 11,
                            alignItems: 'center', justifyContent: 'center',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                        }}
                    >
                        <Ionicons name={nextStep.icon} size={15} color="#ffffff" />
                    </View>
                    <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: '#ffffff' }} numberOfLines={1}>
                            {nextStep.label}
                        </Text>
                        <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: 'rgba(255,255,255,0.85)' }} numberOfLines={1}>
                            {nextStep.hint}
                        </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={16} color="#ffffff" />
                </TouchableOpacity>
            )}

            {/* Every step, including the finished ones, on request */}
            {expanded && (
                <View style={{ paddingHorizontal: 12, paddingBottom: 4 }}>
                    {steps.map((step) => (
                        <TouchableOpacity
                            key={step.key}
                            onPress={() => { triggerHaptic('light'); step.onPress(); }}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityState={{ checked: step.done }}
                            accessibilityLabel={`${step.label}${step.done ? ', done' : ''}`}
                            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 2 }}
                        >
                            <View
                                style={{
                                    width: 22, height: 22, borderRadius: 11, marginRight: 11,
                                    alignItems: 'center', justifyContent: 'center',
                                    backgroundColor: step.done ? tints.attendance.solid : 'transparent',
                                    borderWidth: step.done ? 0 : 1.5,
                                    borderColor: theme.cardBorder,
                                }}
                            >
                                {step.done
                                    ? <Ionicons name="checkmark" size={13} color="#fff" />
                                    : <Ionicons name={step.icon} size={12} color={theme.textTertiary} />}
                            </View>
                            <Text
                                numberOfLines={1}
                                style={{
                                    flex: 1,
                                    fontFamily: 'Nunito_700Bold',
                                    fontSize: 13,
                                    color: step.done ? theme.textTertiary : theme.text,
                                }}
                            >
                                {step.label}
                            </Text>
                            <Ionicons name="chevron-forward" size={14} color={theme.textTertiary} />
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Footer: expand the list, or replay the guided tour */}
            <View
                style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingHorizontal: 14, paddingVertical: 9,
                    borderTopWidth: 1, borderTopColor: theme.cardBorder,
                    backgroundColor: isDark ? 'rgba(148,163,184,0.05)' : theme.surfaceSecondary,
                }}
            >
                <TouchableOpacity
                    onPress={() => { triggerHaptic('light'); setExpanded((v) => !v); }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    accessibilityLabel={expanded ? 'Hide all setup steps' : 'Show all setup steps'}
                    hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textSecondary }}>
                        {expanded ? 'Hide steps' : 'All steps'}
                    </Text>
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color={theme.textSecondary} style={{ marginLeft: 3 }} />
                </TouchableOpacity>

                {onStartTour && (
                    <TouchableOpacity
                        onPress={() => { triggerHaptic('light'); onStartTour(); }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Show me around the app"
                        hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                    >
                        <Ionicons name="navigate" size={13} color={theme.primary} />
                        <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.primary, marginLeft: 5 }}>
                            Show me around
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}
