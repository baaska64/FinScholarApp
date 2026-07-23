import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calculator } from '../../utils/calculator';
import { useColorScheme } from 'nativewind';
import { getTheme, Radius, Shadows } from '@/constants/Theme';

interface SubjectCardProps {
    subject: any;
    system: string;
    onClick: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onToggleTracking?: () => void;
    isSelectionMode?: boolean;
    isSelected?: boolean;
    onSelect?: () => void;
}

export default function SubjectCard({ subject, system, onClick, onDuplicate, onDelete, onToggleTracking, isSelectionMode, isSelected, onSelect }: SubjectCardProps) {
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

    // Grade tracking defaults to true for backwards compat
    const isTracked = subject.gradeTrackingEnabled !== false;
    const hasSchedule = subject.hasSchedule === true;

    const res = Calculator.calculateSubject(subject, system);
    const p = Math.max(0, Math.min(100, res.percent));

    let color = isDark ? '#94a3b8' : '#cbd5e1';
    if (isTracked) {
        if (p >= 90) { color = '#22c55e'; }
        else if (p >= 75) { color = '#3b82f6'; }
        else if (p >= 60) { color = '#eab308'; }
        else if (p > 0) { color = '#ef4444'; }
    } else {
        // Muted orange to signal "paused"
        color = isDark ? '#78716c' : '#a8a29e';
    }

    const displayVal = system === 'PERCENT' ? p.toFixed(1) + '%' : res.equivalent.toFixed(2);
    const periodsCount = subject.periods ? subject.periods.length : 0;

    return (
        <Animated.View style={{ transform: [{ scale }], marginBottom: 16 }}>
        <TouchableOpacity
            activeOpacity={1}
            onPress={isSelectionMode && onSelect ? onSelect : onClick}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={{
                borderRadius: Radius['3xl'],
                padding: 20,
                borderWidth: 1,
                borderColor: isTracked ? (isDark ? theme.cardBorder : '#f1f5f9') : (isDark ? 'rgba(51,65,85,0.5)' : '#e2e8f0'),
                backgroundColor: isTracked ? theme.surface : (isDark ? '#0f172a' : '#f8fafc'),
                ...Shadows.md,
            }}
        >
            {/* Not-tracked banner */}
            {!isTracked && (
                <View className={`flex-row items-center mb-3 px-3 py-1.5 rounded-xl self-start ${isDark ? 'bg-stone-800' : 'bg-stone-200'}`}>
                    <Ionicons name="pause-circle" size={12} color={isDark ? '#a8a29e' : '#78716c'} />
                    <Text className={`text-[10px] font-bold ml-1.5 tracking-wider ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                        NOT TRACKED
                    </Text>
                </View>
            )}

            {/* Header row: Name + actions */}
            <View className="flex-row justify-between items-start mb-3">
                <View className="flex-row items-center flex-1 mr-2">
                    {isSelectionMode && (
                        <View className={`w-6 h-6 rounded-full border-2 mr-3 items-center justify-center ${isSelected ? (isDark ? 'bg-indigo-500 border-indigo-500' : 'bg-indigo-600 border-indigo-600') : (isDark ? 'border-slate-600' : 'border-slate-300')}`}>
                            {isSelected && <Ionicons name="checkmark" size={16} color="white" />}
                        </View>
                    )}
                    <Text
                        className={`text-xl font-bold flex-1 ${
                            isTracked
                                ? (isDark ? 'text-white' : 'text-slate-800')
                                : (isDark ? 'text-slate-500' : 'text-slate-400')
                        }`}
                        numberOfLines={1}
                    >
                        {subject.name}
                    </Text>
                </View>
                <View className={`flex-row items-center space-x-1 rounded-full px-2 py-1 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                    {/* Grade tracking toggle */}
                    {onToggleTracking && (
                        <TouchableOpacity
                            onPress={onToggleTracking}
                            className="p-1.5"
                            hitSlop={10}
                        >
                            <Ionicons
                                name={isTracked ? 'eye' : 'eye-off'}
                                size={14}
                                color={isTracked ? (isDark ? '#60a5fa' : '#3b82f6') : (isDark ? '#78716c' : '#a8a29e')}
                            />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={onDuplicate} className="p-1.5" hitSlop={10}>
                        <Ionicons name="copy" size={14} color={isDark ? '#94a3b8' : '#94a3b8'} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onDelete} className="p-1.5" hitSlop={10}>
                        <Ionicons name="trash" size={14} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Meta row */}
            <View className="flex-row items-center mb-4" style={{ gap: 8 }}>
                <View className="flex-row items-center">
                    <Ionicons name="calendar" size={11} color={isDark ? '#64748b' : '#94a3b8'} style={{ marginRight: 4 }} />
                    <Text className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {periodsCount} period{periodsCount !== 1 ? 's' : ''} · {subject.passingPercent}% pass
                    </Text>
                </View>
                {/* Schedule status badge */}
                {!hasSchedule && (
                    <View className={`flex-row items-center px-2 py-0.5 rounded-full ${isDark ? 'bg-amber-950/60 border border-amber-800/50' : 'bg-amber-50 border border-amber-200'}`}>
                        <Ionicons name="time-outline" size={10} color="#f59e0b" />
                        <Text className="font-nunito-bold text-[9px] text-amber-500 ml-1">No schedule</Text>
                    </View>
                )}
            </View>

            {/* Stats blocks */}
            <View className="flex-row gap-3 mb-4">
                <View className={`rounded-2xl py-2.5 px-4 flex-1 flex-row justify-between items-center ${
                    isTracked
                        ? (isDark ? 'bg-slate-700' : 'bg-slate-50')
                        : (isDark ? 'bg-slate-800' : 'bg-slate-200/60')
                }`}>
                    <Text className={`text-[10px] font-bold tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>SCORE</Text>
                    <Text className={`text-sm font-bold ${isTracked ? (isDark ? 'text-slate-200' : 'text-slate-700') : (isDark ? 'text-slate-600' : 'text-slate-400')}`}>
                        {isTracked ? `${p.toFixed(1)}%` : '—'}
                    </Text>
                </View>
                <View className={`rounded-2xl py-2.5 px-4 flex-1 flex-row justify-between items-center ${
                    isTracked
                        ? (isDark ? 'bg-slate-700' : 'bg-slate-50')
                        : (isDark ? 'bg-slate-800' : 'bg-slate-200/60')
                }`}>
                    <Text className={`text-[10px] font-bold tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>GWA</Text>
                    <Text className={`text-sm font-bold ${isTracked ? (isDark ? 'text-slate-200' : 'text-slate-700') : (isDark ? 'text-slate-600' : 'text-slate-400')}`}>
                        {isTracked ? displayVal : '—'}
                    </Text>
                </View>
            </View>

            {/* Progress bar */}
            <View className={`h-2.5 rounded-full overflow-hidden w-full ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                {isTracked ? (
                    <View
                        className="h-full rounded-full"
                        style={{ width: `${p}%`, backgroundColor: color }}
                    />
                ) : (
                    /* Striped / greyed out effect when not tracked */
                    <View
                        className="h-full rounded-full"
                        style={{ width: '100%', backgroundColor: isDark ? '#44403c' : '#d6d3d1', opacity: 0.5 }}
                    />
                )}
            </View>

            {/* "Not tracked" footer note */}
            {!isTracked && (
                <Text className={`text-[10px] font-nunito text-center mt-2 ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>
                    Excluded from GWA calculations. Tap the 👁 icon to resume tracking.
                </Text>
            )}
        </TouchableOpacity>
        </Animated.View>
    );
}
