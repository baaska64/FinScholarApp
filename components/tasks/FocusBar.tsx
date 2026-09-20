import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import ProgressBar from '@/components/ui/ProgressBar';
import { getTheme, getTints, Radius } from '@/constants/Theme';
import { formatTimer } from './utils';
import type { FocusTimer } from './useFocusTimer';

interface FocusBarProps {
    timer: FocusTimer;
    /** Opens the full station for presets, break mode and reset. */
    onOpen: () => void;
}

/**
 * Fin's Focus Station, in one row.
 *
 * The station has now been in two wrong places. As a full card it owned the
 * entire first screen of a *task list*. Moved wholesale into a sheet, starting
 * a session — the thing a student actually does with it — went from zero taps
 * to two, and Fin disappeared from the tab completely.
 *
 * The split that works: the **action** is inline and the **configuration** is
 * in the sheet. Fin, the clock and Start/Pause live here at ~72pt; session
 * length, break mode and reset are one tap away. Nothing was hidden that a
 * student reaches for often.
 *
 * It scrolls with the list rather than being pinned, so it greets you on open
 * and gets out of the way while you work through the list.
 */
export default function FocusBar({ timer, onOpen }: FocusBarProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const tints = getTints(isDark);

    // Indigo for focus, emerald for break — the app's own colours. Amber is the
    // tasks domain tint and belongs on the tab's icon, not washing a timer.
    const tint = timer.mode === 'focus' ? tints.schedule : tints.attendance;

    const float = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (!timer.isRunning) {
            float.setValue(0);
            return;
        }
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(float, { toValue: -4, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                Animated.timing(float, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [timer.isRunning, float]);

    const mascot = timer.isRunning
        ? require('../../assets/images/studying.png')
        : timer.timeLeft === 0
            ? require('../../assets/images/happy.png')
            : require('../../assets/images/sleeping.png');

    const caption = timer.taskTitle
        ? timer.taskTitle
        : timer.isRunning
            ? timer.mode === 'focus'
                ? 'Fin is studying with you'
                : 'Break time — go stretch'
            : timer.timeLeft === 0
                ? 'Session complete!'
                : `${timer.sessionsCompleted} ${timer.sessionsCompleted === 1 ? 'session' : 'sessions'} today`;

    return (
        <TouchableOpacity
            onPress={onOpen}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Fin's Focus Station. ${formatTimer(timer.timeLeft)} ${timer.isRunning ? 'remaining' : 'ready'}. Opens session settings.`}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 10,
                paddingLeft: 8,
                paddingRight: 12,
                borderRadius: Radius['2xl'],
                backgroundColor: tint.fill,
                borderWidth: 1,
                borderColor: tint.line,
                marginBottom: 16,
            }}
        >
            <Animated.View style={{ transform: [{ translateY: float }] }}>
                <Image source={mascot} style={{ width: 54, height: 54 }} resizeMode="contain" />
            </Animated.View>

            <View style={{ flex: 1, marginLeft: 6, marginRight: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <Text
                        allowFontScaling={false}
                        style={{ fontFamily: 'Nunito_900Black', fontSize: 24, color: tint.ink, letterSpacing: 0.5 }}
                    >
                        {formatTimer(timer.timeLeft)}
                    </Text>
                    <Text
                        style={{
                            fontFamily: 'Nunito_800ExtraBold',
                            fontSize: 10.5,
                            letterSpacing: 0.6,
                            textTransform: 'uppercase',
                            color: tint.ink,
                            marginLeft: 8,
                            opacity: 0.75,
                        }}
                    >
                        {timer.mode === 'focus' ? 'Focus' : 'Break'}
                    </Text>
                </View>

                <Text numberOfLines={1} style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 11.5, color: theme.textSecondary, marginTop: 1 }}>
                    {caption}
                </Text>

                {timer.isRunning && (
                    <View style={{ marginTop: 6 }}>
                        <ProgressBar progress={timer.progressPercent / 100} height={3} color={tint.solid} animate={false} />
                    </View>
                )}
            </View>

            {/* Start/pause without leaving the list. */}
            <TouchableOpacity
                onPress={timer.toggle}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={timer.isRunning ? 'Pause session' : timer.mode === 'focus' ? 'Start focus session' : 'Start break'}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: Radius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: tint.solid,
                    borderBottomWidth: 2,
                    borderBottomColor: 'rgba(0,0,0,0.22)',
                }}
            >
                <Ionicons name={timer.isRunning ? 'pause' : 'play'} size={20} color="#ffffff" />
            </TouchableOpacity>

            <Ionicons name="chevron-forward" size={14} color={tint.ink} style={{ marginLeft: 6, opacity: 0.6 }} />
        </TouchableOpacity>
    );
}
