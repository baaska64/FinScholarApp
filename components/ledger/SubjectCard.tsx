import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calculator } from '../../utils/calculator';
import { useColorScheme } from 'nativewind';
import { getTheme, Radius, Shadows } from '@/constants/Theme';

export interface SubjectCardProps {
    subject: any;
    system: string;
    onClick?: () => void;
    onSelect?: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onToggleTracking?: () => void;
    isSelectionMode?: boolean;
    isEditMode?: boolean;
    isSelected?: boolean;
    onToggleSelect?: () => void;
}

export default function SubjectCard({ 
    subject, 
    system, 
    onClick, 
    onSelect,
    onDuplicate, 
    onDelete, 
    onToggleTracking, 
    isSelectionMode, 
    isEditMode,
    isSelected, 
    onToggleSelect 
}: SubjectCardProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const scale = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 8 }).start();
    };
    const handlePressOut = () => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
    };

    const effectiveEditMode = Boolean(isEditMode || isSelectionMode);
    const handleSelectToggle = onToggleSelect || onSelect;
    const handleCardPress = effectiveEditMode ? handleSelectToggle : (onClick || onSelect);

    // Grade tracking defaults to true for backwards compat
    const isTracked = subject?.gradeTrackingEnabled !== false;
    const hasSchedule = subject?.hasSchedule === true;

    const res = Calculator.calculateSubject(subject, system);
    const rawPercent = isNaN(res.percent) ? 0 : res.percent;
    const p = Math.max(0, Math.min(100, rawPercent));

    let color = isDark ? '#94a3b8' : '#cbd5e1';
    if (isTracked) {
        if (p >= 90) { color = isDark ? '#4ade80' : '#16a34a'; }
        else if (p >= 75) { color = isDark ? '#60a5fa' : '#2563eb'; }
        else if (p >= 60) { color = isDark ? '#facc15' : '#d97706'; }
        else if (p > 0) { color = isDark ? '#f87171' : '#dc2626'; }
    } else {
        color = isDark ? '#64748b' : '#94a3b8';
    }

    const displayVal = system === 'PERCENT' ? p.toFixed(1) + '%' : res.equivalent.toFixed(2);
    const periodsCount = subject?.periods ? subject.periods.length : 0;
    const units = subject?.units ?? 0;

    return (
        <Animated.View style={{ transform: [{ scale }], marginBottom: 16 }}>
            <TouchableOpacity
                activeOpacity={1}
                onPress={handleCardPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={{
                    borderRadius: Radius['2xl'],
                    padding: 20,
                    borderWidth: 1,
                    borderColor: isTracked 
                        ? (isDark ? theme.cardBorder : '#e2e8f0') 
                        : (isDark ? 'rgba(51,65,85,0.5)' : '#e2e8f0'),
                    backgroundColor: isTracked 
                        ? (isDark ? theme.card : theme.surface) 
                        : (isDark ? '#0f172a' : '#f8fafc'),
                    ...Shadows.md,
                }}
            >
                {/* Not-tracked banner */}
                {!isTracked && (
                    <View 
                        style={{ borderRadius: Radius.full }}
                        className={`flex-row items-center mb-3 px-3 py-1 self-start border ${
                            isDark ? 'bg-amber-950/70 border-amber-800/50' : 'bg-amber-50 border-amber-200'
                        }`}
                    >
                        <Ionicons name="pause-circle" size={13} color={isDark ? '#fbbf24' : '#d97706'} />
                        <Text className={`text-[10px] font-bold ml-1.5 tracking-wider uppercase ${
                            isDark ? 'text-amber-400' : 'text-amber-700'
                        }`}>
                            Paused · Excluded from GWA
                        </Text>
                    </View>
                )}

                {/* Header row: Name + actions */}
                <View className="flex-row justify-between items-center mb-3">
                    <View className="flex-row items-center flex-1 mr-2">
                        {effectiveEditMode && (
                            <TouchableOpacity
                                onPress={handleSelectToggle}
                                activeOpacity={0.7}
                                style={{ borderRadius: Radius.full }}
                                className={`w-6 h-6 border-2 mr-3 items-center justify-center ${
                                    isSelected 
                                        ? (isDark ? 'bg-indigo-500 border-indigo-500' : 'bg-indigo-600 border-indigo-600') 
                                        : (isDark ? 'border-slate-600' : 'border-slate-300')
                                }`}
                            >
                                {isSelected && <Ionicons name="checkmark" size={14} color="white" />}
                            </TouchableOpacity>
                        )}
                        <Text
                            className={`text-xl font-nunito-black flex-1 ${
                                isTracked
                                    ? (isDark ? 'text-white' : 'text-slate-800')
                                    : (isDark ? 'text-slate-500' : 'text-slate-400')
                            }`}
                            numberOfLines={1}
                        >
                            {subject?.name}
                        </Text>
                    </View>

                    {/* Action Toolbar */}
                    <View className="flex-row items-center gap-1.5">
                        {/* Grade tracking toggle */}
                        {onToggleTracking && (
                            <TouchableOpacity
                                onPress={onToggleTracking}
                                activeOpacity={0.7}
                                style={{ borderRadius: Radius.full }}
                                className={`w-8 h-8 items-center justify-center ${
                                    isDark ? 'bg-slate-800/90' : 'bg-slate-100'
                                }`}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Ionicons
                                    name={isTracked ? 'eye' : 'eye-off'}
                                    size={15}
                                    color={isTracked ? (isDark ? '#818cf8' : '#4f46e5') : (isDark ? '#64748b' : '#94a3b8')}
                                />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity 
                            onPress={onDuplicate} 
                            activeOpacity={0.7}
                            style={{ borderRadius: Radius.full }}
                            className={`w-8 h-8 items-center justify-center ${
                                isDark ? 'bg-slate-800/90' : 'bg-slate-100'
                            }`}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="copy-outline" size={15} color={isDark ? '#cbd5e1' : '#475569'} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={onDelete} 
                            activeOpacity={0.7}
                            style={{ borderRadius: Radius.full }}
                            className={`w-8 h-8 items-center justify-center ${
                                isDark ? 'bg-red-950/40' : 'bg-red-50'
                            }`}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="trash-outline" size={15} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Status Badges / Chips row */}
                <View className="flex-row items-center flex-wrap gap-2 mb-4">
                    {/* Units / Periods Badge */}
                    <View 
                        style={{ borderRadius: Radius.full }}
                        className={`px-2.5 py-1 flex-row items-center border ${
                            isDark ? 'bg-indigo-950/60 border-indigo-800/40' : 'bg-indigo-50 border-indigo-100'
                        }`}
                    >
                        <Ionicons name="book-outline" size={12} color={isDark ? '#818cf8' : '#4f46e5'} style={{ marginRight: 4 }} />
                        <Text className={`text-xs font-nunito-bold ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
                            {units > 0 ? `${units} Units` : `${periodsCount} Period${periodsCount !== 1 ? 's' : ''}`}
                        </Text>
                    </View>

                    {/* Schedule Status Badge */}
                    {!hasSchedule ? (
                        <View 
                            style={{ borderRadius: Radius.full }}
                            className={`px-2.5 py-1 flex-row items-center border ${
                                isDark ? 'bg-amber-950/60 border-amber-800/50' : 'bg-amber-50 border-amber-200'
                            }`}
                        >
                            <Ionicons name="time-outline" size={12} color="#f59e0b" style={{ marginRight: 4 }} />
                            <Text className="font-nunito-bold text-xs text-amber-600 dark:text-amber-400">No schedule</Text>
                        </View>
                    ) : (
                        <View 
                            style={{ borderRadius: Radius.full }}
                            className={`px-2.5 py-1 flex-row items-center border ${
                                isDark ? 'bg-emerald-950/60 border-emerald-800/50' : 'bg-emerald-50 border-emerald-200'
                            }`}
                        >
                            <Ionicons name="calendar-outline" size={12} color={isDark ? '#34d399' : '#10b981'} style={{ marginRight: 4 }} />
                            <Text className="font-nunito-bold text-xs text-emerald-600 dark:text-emerald-400">Scheduled</Text>
                        </View>
                    )}

                    {/* Grade Equivalent Chip */}
                    {isTracked && (
                        <View 
                            style={{ borderRadius: Radius.full }}
                            className={`px-2.5 py-1 flex-row items-center border ${
                                isDark ? 'bg-slate-800/90 border-slate-700' : 'bg-slate-100 border-slate-200'
                            }`}
                        >
                            <Ionicons name="ribbon-outline" size={12} color={color} style={{ marginRight: 4 }} />
                            <Text className={`font-nunito-bold text-xs ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                                {displayVal}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Stats blocks: SCORE and GWA */}
                <View className="flex-row gap-3 mb-3">
                    <View 
                        style={{ borderRadius: Radius.xl }}
                        className={`py-2.5 px-4 flex-1 flex-row justify-between items-center ${
                            isTracked
                                ? (isDark ? 'bg-slate-800/90' : 'bg-slate-50')
                                : (isDark ? 'bg-slate-900/60' : 'bg-slate-100/70')
                        }`}
                    >
                        <Text className={`text-[11px] font-nunito-bold tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>SCORE</Text>
                        <Text className={`text-sm font-nunito-bold ${isTracked ? (isDark ? 'text-slate-100' : 'text-slate-800') : (isDark ? 'text-slate-600' : 'text-slate-400')}`}>
                            {isTracked ? `${p.toFixed(1)}%` : '—'}
                        </Text>
                    </View>
                    <View 
                        style={{ borderRadius: Radius.xl }}
                        className={`py-2.5 px-4 flex-1 flex-row justify-between items-center ${
                            isTracked
                                ? (isDark ? 'bg-slate-800/90' : 'bg-slate-50')
                                : (isDark ? 'bg-slate-900/60' : 'bg-slate-100/70')
                        }`}
                    >
                        <Text className={`text-[11px] font-nunito-bold tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>GWA</Text>
                        <Text className={`text-sm font-nunito-bold ${isTracked ? (isDark ? 'text-slate-100' : 'text-slate-800') : (isDark ? 'text-slate-600' : 'text-slate-400')}`}>
                            {isTracked ? displayVal : '—'}
                        </Text>
                    </View>
                </View>

                {/* Score Progress Bar */}
                <View 
                    style={{ borderRadius: Radius.full }}
                    className={`h-2.5 overflow-hidden w-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
                >
                    {isTracked ? (
                        <View
                            style={{ 
                                width: `${p}%`, 
                                backgroundColor: color,
                                borderRadius: Radius.full,
                                height: '100%',
                            }}
                        />
                    ) : (
                        <View
                            style={{ 
                                width: '100%', 
                                backgroundColor: isDark ? '#44403c' : '#d6d3d1', 
                                opacity: 0.5,
                                borderRadius: Radius.full,
                                height: '100%',
                            }}
                        />
                    )}
                </View>

                {/* "Not tracked" footer note */}
                {!isTracked && (
                    <Text className={`text-[11px] font-nunito text-center mt-2.5 ${isDark ? 'text-amber-400/70' : 'text-amber-600/80'}`}>
                        Tap the 👁 icon to resume GWA calculation.
                    </Text>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
}

