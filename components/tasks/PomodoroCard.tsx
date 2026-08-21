import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, Animated, Easing, AppState, AppStateStatus, TextInput, Keyboard, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { getTheme, Typography, Radius, Shadows } from '@/constants/Theme';
import { AlertService } from '@/components/CustomAlert';
import { formatTimer, triggerHaptic } from './utils';

export interface PomodoroCardProps {
  initialFocusDuration?: number; // in seconds, default 25 * 60
  initialBreakDuration?: number; // in seconds, default 5 * 60
  onSessionComplete?: (mode: 'focus' | 'break') => void;
}

const FOCUS_PRESETS = [
  { label: '15m', seconds: 15 * 60 },
  { label: '25m', seconds: 25 * 60 },
  { label: '45m', seconds: 45 * 60 },
  { label: '50m', seconds: 50 * 60 },
];

const BREAK_PRESETS = [
  { label: '5m', seconds: 5 * 60 },
  { label: '10m', seconds: 10 * 60 },
  { label: '15m', seconds: 15 * 60 },
];

export default function PomodoroCard({
  initialFocusDuration = 25 * 60,
  initialBreakDuration = 5 * 60,
  onSessionComplete,
}: PomodoroCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark);

  const [timerMode, setTimerMode] = useState<'focus' | 'break'>('focus');
  const [focusDuration, setFocusDuration] = useState(initialFocusDuration);
  const [breakDuration, setBreakDuration] = useState(initialBreakDuration);
  const [timeLeft, setTimeLeft] = useState(initialFocusDuration);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [customMinutesStr, setCustomMinutesStr] = useState('');

  const targetEndTimeRef = useRef<number | null>(null);

  const totalDuration = timerMode === 'focus' ? focusDuration : breakDuration;
  const progressPercent = totalDuration > 0 ? Math.min(100, Math.max(0, ((totalDuration - timeLeft) / totalDuration) * 100)) : 0;

  // Mascot floating & breathing animation
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (isRunning) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: -6,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
    } else {
      floatAnim.setValue(0);
    }
    return () => {
      if (loop) loop.stop();
    };
  }, [isRunning]);

  // Mascot celebratory bounce on finish
  const bounceMascot = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.25, friction: 3, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  };

  // AppState background/foreground synchronization
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isRunning && targetEndTimeRef.current) {
        const remaining = Math.max(0, Math.round((targetEndTimeRef.current - Date.now()) / 1000));
        setTimeLeft(remaining);
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      sub.remove();
    };
  }, [isRunning]);

  // Main countdown interval with timestamp diffing (immune to clock drift & throttling)
  useEffect(() => {
    let interval: any = null;
    if (isRunning && timeLeft > 0) {
      if (!targetEndTimeRef.current) {
        targetEndTimeRef.current = Date.now() + timeLeft * 1000;
      }
      interval = setInterval(() => {
        if (targetEndTimeRef.current) {
          const remaining = Math.max(0, Math.round((targetEndTimeRef.current - Date.now()) / 1000));
          setTimeLeft(remaining);
        } else {
          setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
        }
      }, 500);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      targetEndTimeRef.current = null;
      bounceMascot();
      triggerHaptic('success');
      if (timerMode === 'focus') {
        setSessionsCompleted((s) => s + 1);
        AlertService.alert(
          'Focus Done!',
          'Great job! Time for a short break to recharge.'
        );
      } else {
        AlertService.alert(
          'Break Done!',
          'Break is over! Ready to dive back in and focus?'
        );
      }
      onSessionComplete?.(timerMode);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft, timerMode, onSessionComplete]);

  const handleTogglePlay = () => {
    triggerHaptic('medium');
    if (timeLeft === 0) {
      const newDuration = totalDuration > 0 ? totalDuration : (timerMode === 'focus' ? 25 * 60 : 5 * 60);
      setTimeLeft(newDuration);
      targetEndTimeRef.current = Date.now() + newDuration * 1000;
      setIsRunning(true);
    } else if (isRunning) {
      targetEndTimeRef.current = null;
      setIsRunning(false);
    } else {
      targetEndTimeRef.current = Date.now() + timeLeft * 1000;
      setIsRunning(true);
    }
  };

  const handleReset = () => {
    triggerHaptic('light');
    targetEndTimeRef.current = null;
    setIsRunning(false);
    setTimeLeft(totalDuration);
  };

  const handleSwitchMode = (newMode: 'focus' | 'break') => {
    triggerHaptic('light');
    targetEndTimeRef.current = null;
    setTimerMode(newMode);
    setIsRunning(false);
    const duration = newMode === 'focus' ? focusDuration : breakDuration;
    setTimeLeft(duration);
  };

  const handleSelectPreset = (seconds: number) => {
    triggerHaptic('light');
    targetEndTimeRef.current = null;
    if (timerMode === 'focus') {
      setFocusDuration(seconds);
    } else {
      setBreakDuration(seconds);
    }
    setTimeLeft(seconds);
    setIsRunning(false);
  };

  const handleAddFiveMinutes = () => {
    triggerHaptic('light');
    setTimeLeft((prev) => {
      const nextTime = prev + 5 * 60;
      if (targetEndTimeRef.current) {
        targetEndTimeRef.current += 5 * 60 * 1000;
      }
      if (timerMode === 'focus') {
        setFocusDuration((d) => Math.max(d, nextTime));
      } else {
        setBreakDuration((d) => Math.max(d, nextTime));
      }
      return nextTime;
    });
  };

  const formatTime = formatTimer;

  // Image source logic
  const mascotSource = isRunning
    ? require('../../assets/images/studying.png')
    : timeLeft === 0
    ? require('../../assets/images/happy.png')
    : require('../../assets/images/sleeping.png');

  // Colors based on mode
  const modeAccent = timerMode === 'focus' ? theme.primary : theme.success;
  const modeBg = isDark
    ? timerMode === 'focus' ? 'rgba(79, 70, 229, 0.12)' : 'rgba(16, 185, 129, 0.12)'
    : timerMode === 'focus' ? '#eef2ff' : '#ecfdf5';

  return (
    <View
      accessible={true}
      accessibilityRole="summary"
      accessibilityLabel={`Fin's Focus Station, ${timerMode === 'focus' ? 'Focus' : 'Break'} session, ${formatTime(timeLeft)} remaining`}
      style={{
        borderRadius: 24,
        padding: 20,
        backgroundColor: theme.surface,
        borderWidth: 1.5,
        borderColor: isDark ? (timerMode === 'focus' ? 'rgba(129, 140, 248, 0.25)' : 'rgba(52, 211, 153, 0.25)') : (timerMode === 'focus' ? '#e0e7ff' : '#d1fae5'),
        ...Shadows.md,
        marginBottom: 20,
      }}
    >
      {/* Top Header & Mode Toggle Chips */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, paddingRight: 8 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              backgroundColor: modeBg,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <Ionicons
              name={timerMode === 'focus' ? 'flame' : 'cafe'}
              size={18}
              color={modeAccent}
            />
          </View>
          <View style={{ flexShrink: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontFamily: 'Nunito_900Black', fontSize: 16, color: theme.text, flexShrink: 1 }}>
                Fin's Focus Station
              </Text>
              <TouchableOpacity
                onPress={() => {
                  triggerHaptic('light');
                  AlertService.alert(
                    'How Pomodoro Works',
                    '1. Pick a task to focus on.\n2. Start the Focus timer (e.g. 25m) and work without distractions.\n3. When time is up, take a quick Break (e.g. 5m).\n4. Repeat to stay productive and avoid burnout!'
                  );
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="help-circle-outline" size={16} color={theme.textTertiary} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textTertiary, marginTop: 2, paddingRight: 4 }}>
              {timerMode === 'focus' ? 'Deep Work' : 'Recharge'} • {sessionsCompleted}{'\u00A0'}{sessionsCompleted === 1 ? 'session\u00A0done' : 'sessions\u00A0done'}
            </Text>
          </View>
        </View>

        {/* Mode Switcher Segment */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9',
            borderRadius: 14,
            padding: 3,
          }}
        >
          <TouchableOpacity
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Focus mode"
            accessibilityState={{ selected: timerMode === 'focus' }}
            onPress={() => handleSwitchMode('focus')}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 11,
              backgroundColor: timerMode === 'focus' ? theme.primary : 'transparent',
            }}
          >
            <Text
              style={{
                fontFamily: 'Nunito_700Bold',
                fontSize: 11,
                color: timerMode === 'focus' ? '#ffffff' : theme.textSecondary,
              }}
            >
              Focus
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Break mode"
            accessibilityState={{ selected: timerMode === 'break' }}
            onPress={() => handleSwitchMode('break')}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 11,
              backgroundColor: timerMode === 'break' ? theme.success : 'transparent',
            }}
          >
            <Text
              style={{
                fontFamily: 'Nunito_700Bold',
                fontSize: 11,
                color: timerMode === 'break' ? '#ffffff' : theme.textSecondary,
              }}
            >
              Break
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Preset Chips */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
        <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textTertiary, marginRight: 2 }}>
          Presets:
        </Text>
        
        {isCustomizing ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 }}>
            <TextInput
              keyboardType="number-pad"
              placeholder="Mins"
              placeholderTextColor={theme.textTertiary}
              value={customMinutesStr}
              onChangeText={setCustomMinutesStr}
              autoFocus
              style={{
                flex: 1,
                fontFamily: 'Nunito_700Bold',
                fontSize: 11,
                color: theme.text,
                paddingHorizontal: 10,
                paddingVertical: 2,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: theme.primary,
                backgroundColor: isDark ? theme.surfaceSecondary : '#ffffff',
                height: 28,
              }}
            />
            <TouchableOpacity
              onPress={() => {
                const mins = parseInt(customMinutesStr, 10);
                if (!isNaN(mins) && mins > 0) {
                  handleSelectPreset(mins * 60);
                }
                setIsCustomizing(false);
                setCustomMinutesStr('');
                Keyboard.dismiss();
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: theme.primary,
              }}
            >
              <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#ffffff' }}>Set</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setIsCustomizing(false);
                setCustomMinutesStr('');
                Keyboard.dismiss();
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9',
              }}
            >
              <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {(timerMode === 'focus' ? FOCUS_PRESETS : BREAK_PRESETS).map((preset) => {
              const isSelected = (timerMode === 'focus' ? focusDuration : breakDuration) === preset.seconds;
              return (
                <TouchableOpacity
                  key={preset.label}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`${preset.label} preset`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => handleSelectPreset(preset.seconds)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: isSelected ? modeAccent : (isDark ? theme.cardBorder : '#e2e8f0'),
                    backgroundColor: isSelected ? modeBg : (isDark ? theme.surfaceSecondary : '#f8fafc'),
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Nunito_700Bold',
                      fontSize: 11,
                      color: isSelected ? modeAccent : theme.textSecondary,
                    }}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            
            {/* Custom Time Button */}
            <TouchableOpacity
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Custom time preset"
              onPress={() => {
                triggerHaptic('light');
                setIsCustomizing(true);
              }}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: isDark ? theme.cardBorder : '#e2e8f0',
                backgroundColor: isDark ? theme.surfaceSecondary : '#f8fafc',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Nunito_700Bold',
                  fontSize: 11,
                  color: theme.textSecondary,
                }}
              >
                Custom
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      {/* Main Timer Display & Mascot Centerpiece */}
      <View
        accessible={true}
        accessibilityRole="timer"
        accessibilityLabel={`${formatTime(timeLeft)} remaining in ${timerMode === 'focus' ? 'Focus' : 'Break'} session`}
        accessibilityLiveRegion="polite"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
          borderRadius: 20,
          padding: 16,
          borderWidth: 1,
          borderColor: isDark ? theme.cardBorder : '#f1f5f9',
          marginBottom: 16,
        }}
      >
        {/* Mascot Avatar with Animated Pulse/Float */}
        <Animated.View
          style={{
            transform: [{ translateY: floatAnim }, { scale: scaleAnim }],
            marginRight: 16,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            source={mascotSource}
            style={{ width: 90, height: 90 }}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Big Digital Timer & Motivational Text */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: 'Nunito_900Black',
              fontSize: 38,
              lineHeight: 44,
              color: modeAccent,
              letterSpacing: 1,
            }}
          >
            {formatTime(timeLeft)}
          </Text>
          <Text
            numberOfLines={2}
            style={{
              fontFamily: 'Nunito_600SemiBold',
              fontSize: 12,
              color: theme.textSecondary,
              marginTop: 2,
            }}
          >
            {isRunning
              ? (timerMode === 'focus' ? 'Fin is studying hard with you!' : 'Relaxing time! Sip some water.')
              : (timeLeft === 0
                ? 'Session complete! Fin is super proud!'
                : (timerMode === 'focus' ? 'Fin is resting. Ready to focus?' : 'Ready to take a quick break?'))}
          </Text>
        </View>
      </View>

      {/* Progress Bar Island */}
      <View
        accessible={true}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progressPercent) }}
        accessibilityLabel={`${timerMode === 'focus' ? 'Focus' : 'Break'} progress ${Math.round(progressPercent)} percent`}
        style={{ marginBottom: 16 }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textTertiary }}>
            {timerMode === 'focus' ? 'Focus Progress' : 'Break Progress'}
          </Text>
          <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: modeAccent }}>
            {Math.round(progressPercent)}%
          </Text>
        </View>
        <View
          style={{
            height: 7,
            borderRadius: 999,
            backgroundColor: isDark ? theme.surfaceSecondary : '#e2e8f0',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              backgroundColor: modeAccent,
              borderRadius: 999,
            }}
          />
        </View>
      </View>

      {/* Interactive Controls Bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {/* Play/Pause Button */}
        <TouchableOpacity
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={isRunning ? 'Pause timer' : (timerMode === 'focus' ? 'Start Focus' : 'Start Break')}
          accessibilityHint={isRunning ? 'Pauses the active timer' : 'Starts the focus or break countdown'}
          onPress={handleTogglePlay}
          activeOpacity={0.8}
          style={{
            flex: 2,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isRunning ? '#f59e0b' : modeAccent,
            paddingVertical: 12,
            borderRadius: 14,
            ...Shadows.sm,
          }}
        >
          <Ionicons name={isRunning ? 'pause' : 'play'} size={18} color="#ffffff" />
          <Text
            style={{
              fontFamily: 'Nunito_900Black',
              fontSize: 14,
              color: '#ffffff',
              marginLeft: 6,
            }}
          >
            {isRunning ? 'Pause' : (timerMode === 'focus' ? 'Start Focus' : 'Start Break')}
          </Text>
        </TouchableOpacity>

        {/* Quick +5m Button */}
        <TouchableOpacity
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Add 5 minutes"
          accessibilityHint="Extends current timer duration by 5 minutes"
          onPress={handleAddFiveMinutes}
          activeOpacity={0.8}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9',
            borderWidth: 1,
            borderColor: isDark ? theme.cardBorder : '#e2e8f0',
            paddingVertical: 12,
            borderRadius: 14,
          }}
        >
          <Ionicons name="add" size={16} color={theme.text} />
          <Text
            style={{
              fontFamily: 'Nunito_700Bold',
              fontSize: 12,
              color: theme.text,
              marginLeft: 2,
            }}
          >
            +5m
          </Text>
        </TouchableOpacity>

        {/* Reset Button */}
        <TouchableOpacity
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Reset timer"
          accessibilityHint="Resets the countdown timer to its initial duration"
          onPress={handleReset}
          activeOpacity={0.8}
          style={{
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9',
            borderWidth: 1,
            borderColor: isDark ? theme.cardBorder : '#e2e8f0',
            borderRadius: 14,
          }}
        >
          <Ionicons name="refresh" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
