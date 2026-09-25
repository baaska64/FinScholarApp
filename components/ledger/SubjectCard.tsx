import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calculator } from '../../utils/calculator';
import { useColorScheme } from 'nativewind';
import Card from '@/components/ui/Card';
import { getTheme, getTints, Radius } from '@/constants/Theme';
import { getGradeTierColor, getGradeTierWash } from '@/utils/gradeTiers';
import { countScores } from '@/utils/gradeEntry';

export interface SubjectCardProps {
    subject: any;
    system: string;
    onClick?: () => void;
    onSelect?: () => void;
    /**
     * Opens the subject's action sheet — pause/resume tracking, duplicate,
     * delete. Those used to be three always-visible buttons on every card,
     * which made the list read as a management console rather than something
     * you tap to open. The sheet lives on the screen so the list renders one
     * modal, not one per row.
     */
    onOpenMenu?: () => void;
    isSelectionMode?: boolean;
    isEditMode?: boolean;
    isSelected?: boolean;
    onToggleSelect?: () => void;
}

/**
 * One subject as a report-card line: the grade in a tier-tinted tile, then the
 * name, how many scores are in, and where the percentage sits against the
 * subject's own passing mark.
 *
 * The tile is the difference from every other list in the app — the dashboard
 * and study rows lead with an icon or a time; a grade leads with the grade.
 */
export default function SubjectCard({
    subject,
    system,
    onClick,
    onSelect,
    onOpenMenu,
    isSelectionMode,
    isEditMode,
    isSelected,
    onToggleSelect,
}: SubjectCardProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const tints = getTints(isDark);

    const effectiveEditMode = Boolean(isEditMode || isSelectionMode);
    const handleSelectToggle = onToggleSelect || onSelect;
    const handleCardPress = effectiveEditMode ? handleSelectToggle : (onClick || onSelect);

    // Grade tracking defaults to true for backwards compat
    const isTracked = subject?.gradeTrackingEnabled !== false;
    const hasSchedule = subject?.hasSchedule === true;

    const res = Calculator.calculateSubject(subject, system);
    const rawPercent = isNaN(res.percent) ? 0 : res.percent;
    const p = Math.max(0, Math.min(100, rawPercent));
    const showGrade = isTracked && res.hasData;
    const passPct = Math.max(0, Math.min(100, Number(subject?.passingPercent) || 60));

    const tierColor = getGradeTierColor(p, isDark, showGrade);
    const wash = getGradeTierWash(p, isDark, showGrade);

    const displayVal = system === 'PERCENT' ? `${Math.round(p)}%` : res.equivalent.toFixed(2);
    const units = Number(subject?.units) || 0;

    let filled = 0, total = 0;
    for (const per of subject?.periods || []) for (const c of per?.components || []) for (const it of c?.items || []) {
        const n = countScores(it);
        filled += n.filled;
        total += n.total;
    }
    const scoresLabel = total === 0 ? 'No grading setup' : `${filled} of ${total} score${total !== 1 ? 's' : ''} in`;

    const accessibilityLabel = [
        subject?.name,
        isTracked
            ? (res.hasData ? `grade ${displayVal}, score ${p.toFixed(1)} percent` : 'no scores yet')
            : 'paused, excluded from GWA',
        units > 0 ? `${units} units` : null,
        scoresLabel,
        hasSchedule ? 'scheduled' : 'no class times yet',
    ].filter(Boolean).join(', ');

    return (
        <Card
            padding={0}
            radius={Radius.xl}
            onPress={handleCardPress}
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={effectiveEditMode ? 'Toggles selection' : 'Opens this subject'}
            style={{
                marginBottom: 10,
                borderColor: isSelected ? theme.primary : theme.cardBorder,
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 11, gap: 12 }}>
                {/* ── The grade, as a tile ─────────────────────────────── */}
                <View
                    style={{
                        width: 60, height: 60, borderRadius: 16,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: isTracked ? wash.fill : theme.surfaceSecondary,
                        borderWidth: 1, borderColor: isTracked ? wash.line : theme.cardBorder,
                    }}
                >
                    {isTracked ? (
                        <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            style={{ fontFamily: 'Nunito_900Black', fontSize: 18, letterSpacing: -0.6, color: showGrade ? tierColor : theme.textTertiary, maxWidth: 52 }}
                        >
                            {showGrade ? displayVal : '—'}
                        </Text>
                    ) : (
                        <Ionicons name="pause" size={18} color={tints.tasks.ink} />
                    )}
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 8.5, letterSpacing: 0.6, color: isTracked ? (showGrade ? tierColor : theme.textTertiary) : tints.tasks.ink, marginTop: 1 }}>
                        {!isTracked ? 'PAUSED' : showGrade ? (system === 'PERCENT' ? 'SCORE' : 'GRADE') : 'NO DATA'}
                    </Text>
                </View>

                {/* ── Name, meta, and the percentage against the pass mark ── */}
                <View style={{ flex: 1 }}>
                    <Text
                        numberOfLines={1}
                        style={{ fontFamily: 'Nunito_900Black', fontSize: 15, letterSpacing: -0.3, color: isTracked ? theme.text : theme.textTertiary }}
                    >
                        {subject?.name}
                    </Text>

                    <Text numberOfLines={1} style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 11.5, color: theme.textTertiary, marginTop: 2 }}>
                        {units > 0 ? `${units} unit${units !== 1 ? 's' : ''} · ` : ''}
                        {isTracked ? scoresLabel : 'Not counted in GWA'}
                        {!hasSchedule && <Text style={{ fontFamily: 'Nunito_700Bold', color: tints.tasks.ink }}> · No class times</Text>}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
                        <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: theme.surfaceSecondary }}>
                            {showGrade && <View style={{ width: `${p}%`, height: '100%', borderRadius: 3, backgroundColor: tierColor }} />}
                            {isTracked && (
                                <View style={{ position: 'absolute', left: `${passPct}%`, top: -2, bottom: -2, width: 2, marginLeft: -1, borderRadius: 1, backgroundColor: theme.textTertiary, opacity: 0.7 }} />
                            )}
                        </View>
                        <Text style={{ minWidth: 38, textAlign: 'right', fontFamily: 'Nunito_800ExtraBold', fontSize: 11, color: showGrade ? theme.textSecondary : theme.textTertiary }}>
                            {showGrade ? `${p.toFixed(1)}%` : '—'}
                        </Text>
                    </View>
                </View>

                {/* ── Selection, or the overflow that holds every action ── */}
                {effectiveEditMode ? (
                    <TouchableOpacity
                        onPress={handleSelectToggle}
                        activeOpacity={0.7}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: Boolean(isSelected) }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={{
                            width: 24, height: 24, borderRadius: 8,
                            alignItems: 'center', justifyContent: 'center',
                            borderWidth: 2,
                            borderColor: isSelected ? theme.primary : (isDark ? '#464d75' : '#cbd5e1'),
                            backgroundColor: isSelected ? theme.primary : 'transparent',
                        }}
                    >
                        {isSelected && <Ionicons name="checkmark" size={15} color="#ffffff" />}
                    </TouchableOpacity>
                ) : onOpenMenu ? (
                    <TouchableOpacity
                        onPress={onOpenMenu}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`More options for ${subject?.name}`}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                        style={{ width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Ionicons name="ellipsis-vertical" size={16} color={theme.textTertiary} />
                    </TouchableOpacity>
                ) : null}
            </View>
        </Card>
    );
}
