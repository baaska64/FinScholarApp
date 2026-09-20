import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Image, Animated, Easing, TextInput, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import KeyboardSheet from '@/components/ui/KeyboardSheet';
import ProgressBar from '@/components/ui/ProgressBar';
import { getTheme, getTints, Radius } from '@/constants/Theme';
import { formatTimer, triggerHaptic } from './utils';
import { BREAK_PRESETS, FOCUS_PRESETS, type FocusTimer } from './useFocusTimer';

interface FocusSheetProps {
    visible: boolean;
    onClose: () => void;
    timer: FocusTimer;
}

/**
 * Fin's Focus Station.
 *
 * It used to be a permanently mounted card at the top of the tasks tab, which
 * meant the first full screen of a *task list* was a timer. As a sheet it is
 * summoned when a student actually wants it — and it gets more room than it
 * ever had on the tab, so Fin is 120pt here rather than 90pt in a corner.
 *
 * Fin's three sprites are the state indicator, and they are the reason this
 * screen has any warmth: `sleeping` while idle, `studying` while a session
 * runs, `happy` when one lands. The float and the celebratory bounce are the
 * same animations the card had.
 */
export default function FocusSheet({ visible, onClose, timer }: FocusSheetProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const tints = getTints(isDark);

    const [customising, setCustomising] = useState(false);
    const [customMinutes, setCustomMinutes] = useState('');

    const float = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(1)).current;

    // Fin bobs only while a session is actually running — a mascot that floats
    // forever is decoration; one that moves when the timer moves is feedback.
    useEffect(() => {
        if (!timer.isRunning) {
            float.setValue(0);
            return;
        }
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(float, { toValue: -7, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                Animated.timing(float, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [timer.isRunning, float]);

    useEffect(() => {
        if (timer.timeLeft !== 0) return;
        Animated.sequence([
            Animated.spring(scale, { toValue: 1.22, friction: 3, useNativeDriver: true }),
            Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
        ]).start();
    }, [timer.timeLeft, scale]);

    const mascot = timer.isRunning
        ? require('../../assets/images/studying.png')
        : timer.timeLeft === 0
            ? require('../../assets/images/happy.png')
            : require('../../assets/images/sleeping.png');

    // Focus is INDIGO — the app's own colour — and break is emerald.
    // `tints.tasks` (amber) is the tab's domain tint, correct on the app bar
    // icon and on a "due today" warning, but as a full-panel wash behind a
    // timer it made the whole sheet read as a caution state and stopped
    // looking like this app at all.
    const tint = timer.mode === 'focus' ? tints.schedule : tints.attendance;

    const caption = timer.isRunning
        ? timer.mode === 'focus'
            ? 'Fin is studying hard with you!'
            : 'Relaxing time — sip some water.'
        : timer.timeLeft === 0
            ? 'Session complete! Fin is super proud.'
            : timer.mode === 'focus'
                ? 'Fin is resting. Ready to focus?'
                : 'Ready to take a quick break?';

    const presets = (timer.mode === 'focus' ? FOCUS_PRESETS : BREAK_PRESETS).map(m => ({
        label: `${m}m`,
        seconds: m * 60,
    }));
    const activeDuration = timer.mode === 'focus' ? timer.focusDuration : timer.breakDuration;

    const applyCustom = () => {
        const minutes = parseInt(customMinutes, 10);
        if (Number.isFinite(minutes) && minutes > 0 && minutes <= 180) {
            timer.setPreset(minutes * 60);
        }
        setCustomising(false);
        setCustomMinutes('');
        Keyboard.dismiss();
    };

    return (
        <KeyboardSheet
            visible={visible}
            onClose={onClose}
            title="Fin's Focus Station"
            subtitle={
                timer.taskTitle
                    ? `Focusing on ${timer.taskTitle}`
                    : `${timer.sessionsCompleted} ${timer.sessionsCompleted === 1 ? 'session' : 'sessions'} done today`
            }
            icon={timer.mode === 'focus' ? 'flame' : 'cafe'}
            tint={tint}
            maxHeightRatio={0.92}
        >
            {/* Mode switch */}
            <View
                style={{
                    flexDirection: 'row',
                    padding: 3,
                    borderRadius: Radius.full,
                    backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9',
                    borderWidth: 1,
                    borderColor: theme.cardBorder,
                }}
            >
                {(['focus', 'break'] as const).map(m => {
                    const active = timer.mode === m;
                    return (
                        <TouchableOpacity
                            key={m}
                            onPress={() => timer.switchMode(m)}
                            activeOpacity={0.8}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={m === 'focus' ? 'Focus session' : 'Break'}
                            style={{
                                flex: 1,
                                paddingVertical: 8,
                                borderRadius: Radius.full,
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'row',
                                backgroundColor: active ? (m === 'focus' ? tints.schedule.solid : tints.attendance.solid) : 'transparent',
                            }}
                        >
                            <Ionicons
                                name={m === 'focus' ? 'flame' : 'cafe'}
                                size={13}
                                color={active ? '#ffffff' : theme.textSecondary}
                            />
                            <Text
                                style={{
                                    marginLeft: 5,
                                    fontFamily: 'Nunito_800ExtraBold',
                                    fontSize: 12.5,
                                    color: active ? '#ffffff' : theme.textSecondary,
                                }}
                            >
                                {m === 'focus' ? 'Focus' : 'Break'}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Fin + the clock */}
            <View
                accessibilityRole="timer"
                accessibilityLiveRegion="polite"
                accessibilityLabel={`${formatTimer(timer.timeLeft)} remaining in ${timer.mode} session`}
                style={{
                    alignItems: 'center',
                    paddingVertical: 18,
                    marginTop: 14,
                    borderRadius: Radius['3xl'],
                    backgroundColor: tint.fill,
                    borderWidth: 1,
                    borderColor: tint.line,
                }}
            >
                <Animated.View style={{ transform: [{ translateY: float }, { scale }] }}>
                    <Image source={mascot} style={{ width: 120, height: 120 }} resizeMode="contain" />
                </Animated.View>

                <Text
                    allowFontScaling={false}
                    style={{
                        fontFamily: 'Nunito_900Black',
                        fontSize: 52,
                        lineHeight: 60,
                        letterSpacing: 1,
                        color: tint.ink,
                        marginTop: 4,
                    }}
                >
                    {formatTimer(timer.timeLeft)}
                </Text>

                <Text
                    numberOfLines={2}
                    style={{
                        fontFamily: 'Nunito_600SemiBold',
                        fontSize: 12.5,
                        color: theme.textSecondary,
                        textAlign: 'center',
                        marginTop: 2,
                        paddingHorizontal: 24,
                    }}
                >
                    {caption}
                </Text>

                <View style={{ alignSelf: 'stretch', paddingHorizontal: 22, marginTop: 14 }}>
                    <ProgressBar
                        progress={timer.progressPercent / 100}
                        height={6}
                        color={tint.solid}
                        animate={false}
                        accessibilityLabel={`${Math.round(timer.progressPercent)} percent through this session`}
                    />
                </View>
            </View>

            {/* Duration presets */}
            <Text
                style={{
                    fontFamily: 'Nunito_800ExtraBold',
                    fontSize: 11,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    color: theme.textTertiary,
                    marginTop: 18,
                    marginBottom: 8,
                }}
            >
                Session length
            </Text>

            {customising ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                        value={customMinutes}
                        onChangeText={setCustomMinutes}
                        keyboardType="number-pad"
                        autoFocus
                        placeholder="Minutes (1–180)"
                        placeholderTextColor={theme.textTertiary}
                        accessibilityLabel="Custom session length in minutes"
                        onSubmitEditing={applyCustom}
                        style={{
                            flex: 1,
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            borderRadius: Radius.lg,
                            borderWidth: 1,
                            borderColor: theme.inputBorder,
                            backgroundColor: theme.inputBg,
                            fontFamily: 'Nunito_700Bold',
                            fontSize: 14,
                            color: theme.text,
                        }}
                    />
                    <TouchableOpacity
                        onPress={applyCustom}
                        accessibilityRole="button"
                        accessibilityLabel="Apply custom length"
                        style={{
                            paddingHorizontal: 16,
                            paddingVertical: 11,
                            borderRadius: Radius.lg,
                            backgroundColor: tint.solid,
                        }}
                    >
                        <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: '#ffffff' }}>Set</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => {
                            setCustomising(false);
                            setCustomMinutes('');
                            Keyboard.dismiss();
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel custom length"
                        style={{ paddingHorizontal: 12, paddingVertical: 11 }}
                    >
                        <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: theme.textSecondary }}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                    {presets.map(preset => {
                        const active = activeDuration === preset.seconds;
                        return (
                            <TouchableOpacity
                                key={preset.label}
                                onPress={() => timer.setPreset(preset.seconds)}
                                activeOpacity={0.8}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: active }}
                                accessibilityLabel={`${preset.label} session`}
                                style={{
                                    paddingHorizontal: 15,
                                    paddingVertical: 8,
                                    borderRadius: Radius.full,
                                    borderWidth: 1,
                                    backgroundColor: active ? tint.fill : 'transparent',
                                    borderColor: active ? tint.solid : theme.cardBorder,
                                }}
                            >
                                <Text
                                    style={{
                                        fontFamily: 'Nunito_700Bold',
                                        fontSize: 12.5,
                                        color: active ? tint.ink : theme.textSecondary,
                                    }}
                                >
                                    {preset.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                    <TouchableOpacity
                        onPress={() => {
                            triggerHaptic('light');
                            setCustomising(true);
                        }}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel="Set a custom session length"
                        style={{
                            paddingHorizontal: 15,
                            paddingVertical: 8,
                            borderRadius: Radius.full,
                            borderWidth: 1,
                            borderColor: theme.cardBorder,
                        }}
                    >
                        <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: theme.textSecondary }}>
                            Custom
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Controls */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 20, marginBottom: 6 }}>
                <TouchableOpacity
                    onPress={timer.toggle}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={timer.isRunning ? 'Pause timer' : timer.mode === 'focus' ? 'Start focus' : 'Start break'}
                    style={{
                        flex: 2,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingVertical: 14,
                        borderRadius: Radius.xl,
                        backgroundColor: tint.solid,
                        borderBottomWidth: 3,
                        borderBottomColor: 'rgba(0,0,0,0.22)',
                    }}
                >
                    <Ionicons name={timer.isRunning ? 'pause' : 'play'} size={18} color="#ffffff" />
                    <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 14.5, color: '#ffffff', marginLeft: 7 }}>
                        {timer.isRunning ? 'Pause' : timer.mode === 'focus' ? 'Start focus' : 'Start break'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={timer.addFiveMinutes}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Add five minutes"
                    style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingVertical: 14,
                        borderRadius: Radius.xl,
                        borderWidth: 1,
                        borderColor: theme.cardBorder,
                        backgroundColor: theme.surface,
                    }}
                >
                    <Ionicons name="add" size={16} color={theme.text} />
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: theme.text, marginLeft: 2 }}>5m</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={timer.reset}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Reset timer"
                    style={{
                        width: 48,
                        paddingVertical: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: Radius.xl,
                        borderWidth: 1,
                        borderColor: theme.cardBorder,
                        backgroundColor: theme.surface,
                    }}
                >
                    <Ionicons name="refresh" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
            </View>

            {timer.taskTitle && (
                <TouchableOpacity
                    onPress={() => timer.setTaskTitle(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Stop focusing on this task"
                    style={{ alignSelf: 'center', paddingVertical: 8 }}
                >
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textTertiary }}>
                        Clear task
                    </Text>
                </TouchableOpacity>
            )}
        </KeyboardSheet>
    );
}
