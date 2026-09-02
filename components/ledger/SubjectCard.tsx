import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calculator } from '../../utils/calculator';
import { useColorScheme } from 'nativewind';
import Card from '@/components/ui/Card';
import ProgressBar from '@/components/ui/ProgressBar';
import { getTheme, getTints, Radius } from '@/constants/Theme';
import { getGradeTierColor } from '@/utils/gradeTiers';

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
 * One subject, in one glance: name, grade, how far through it you are.
 *
 * The previous card stacked five bands (paused banner, name + three buttons,
 * three status chips, two stat boxes, progress bar, footer note) into ~200pt,
 * printed the grade twice, and fit two subjects on a phone screen. This one is
 * ~96pt and fits five, with everything that was dropped from the surface
 * reachable from the overflow menu.
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

    const tierColor = getGradeTierColor(p, isDark, isTracked && res.hasData);
    const railColor = isTracked ? tierColor : (isDark ? '#3d4468' : '#cbd5e1');

    const displayVal = system === 'PERCENT' ? `${p.toFixed(1)}%` : res.equivalent.toFixed(2);
    const periodsCount = subject?.periods ? subject.periods.length : 0;
    const units = Number(subject?.units) || 0;

    const loadLabel = units > 0
        ? `${units} unit${units !== 1 ? 's' : ''}`
        : `${periodsCount} period${periodsCount !== 1 ? 's' : ''}`;

    const accessibilityLabel = [
        subject?.name,
        isTracked
            ? (res.hasData ? `grade ${displayVal}, score ${p.toFixed(1)} percent` : 'no scores yet')
            : 'paused, excluded from GWA',
        loadLabel,
        hasSchedule ? 'scheduled' : 'no class times yet',
    ].join(', ');

    return (
        <Card
            padding={0}
            radius={Radius.lg}
            onPress={handleCardPress}
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={effectiveEditMode ? 'Toggles selection' : 'Opens this subject'}
            style={{
                marginBottom: 10,
                overflow: 'hidden',
                borderColor: isSelected ? theme.primary : theme.cardBorder,
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
                {/* Selection box in edit mode, otherwise the grade-tier rail. */}
                {effectiveEditMode ? (
                    <TouchableOpacity
                        onPress={handleSelectToggle}
                        activeOpacity={0.7}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: Boolean(isSelected) }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
                        style={{
                            width: 22, height: 22, borderRadius: 7, marginRight: 11,
                            alignItems: 'center', justifyContent: 'center',
                            borderWidth: 2,
                            borderColor: isSelected ? theme.primary : (isDark ? '#464d75' : '#cbd5e1'),
                            backgroundColor: isSelected ? theme.primary : 'transparent',
                        }}
                    >
                        {isSelected && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 4, alignSelf: 'stretch', minHeight: 46, borderRadius: 2, backgroundColor: railColor, marginRight: 11 }} />
                )}

                <View style={{ flex: 1 }}>
                    {/* Name + the grade in the student's own system */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text
                            numberOfLines={1}
                            style={{
                                flex: 1,
                                fontFamily: 'Nunito_900Black',
                                fontSize: 15.5,
                                letterSpacing: -0.3,
                                marginRight: 8,
                                color: isTracked ? theme.text : theme.textTertiary,
                            }}
                        >
                            {subject?.name}
                        </Text>

                        {!isTracked && (
                            <View style={{
                                flexDirection: 'row', alignItems: 'center',
                                paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
                                backgroundColor: tints.tasks.fill,
                                borderWidth: 1, borderColor: tints.tasks.line,
                            }}>
                                <Ionicons name="pause" size={9} color={tints.tasks.ink} style={{ marginRight: 3 }} />
                                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 9.5, color: tints.tasks.ink, letterSpacing: 0.2 }}>
                                    PAUSED
                                </Text>
                            </View>
                        )}

                        {isTracked && (
                            <Text
                                numberOfLines={1}
                                style={{ fontFamily: 'Nunito_900Black', fontSize: 17, letterSpacing: -0.5, color: res.hasData ? tierColor : theme.textTertiary }}
                            >
                                {res.hasData ? displayVal : '—'}
                            </Text>
                        )}
                    </View>

                    {/* One quiet meta line instead of three chip pills */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                        <Text numberOfLines={1} style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary, flexShrink: 1 }}>
                            {loadLabel}
                            {isTracked && res.hasData ? ` · ${p.toFixed(1)}% earned` : ''}
                            {!isTracked ? ' · Excluded from GWA' : ''}
                            {' · '}
                        </Text>
                        <Text
                            numberOfLines={1}
                            style={{ fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: hasSchedule ? theme.textTertiary : tints.tasks.ink }}
                        >
                            {hasSchedule ? 'Scheduled' : 'No class times'}
                        </Text>
                    </View>

                    <ProgressBar
                        progress={isTracked ? p / 100 : 1}
                        height={5}
                        color={isTracked ? tierColor : (isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0')}
                        animate={false}
                        style={{ marginTop: 9 }}
                        accessibilityLabel={`${subject?.name} score`}
                    />
                </View>

                {/* Every action the card used to wear on its sleeve now lives here. */}
                {!effectiveEditMode && onOpenMenu && (
                    <TouchableOpacity
                        onPress={onOpenMenu}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`More options for ${subject?.name}`}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                        style={{
                            width: 30, height: 30, borderRadius: 10, marginLeft: 8,
                            alignItems: 'center', justifyContent: 'center',
                            backgroundColor: theme.surfaceSecondary,
                        }}
                    >
                        <Ionicons name="ellipsis-horizontal" size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>
        </Card>
    );
}
