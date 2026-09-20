import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { AlertService } from '@/components/CustomAlert';
import { triggerHaptic } from './utils';

export type FocusMode = 'focus' | 'break';

export const FOCUS_PRESETS = [15, 25, 45, 50];
export const BREAK_PRESETS = [5, 10, 15];

/**
 * Fin's Focus Station, as state rather than a card.
 *
 * The timer used to live inside the Pomodoro card, so it existed only while
 * that card was mounted — and the card was the first thing on the tasks tab,
 * taking a whole screen before a student could see a single task. Moving it
 * into a sheet would have made a 25-minute session die the moment the sheet
 * closed, which is exactly when a student wants to go look at their list. The
 * state lives on the screen now and the sheet is only its face, so a session
 * keeps running while the sheet is shut and the app bar can show it ticking.
 *
 * Two behaviours are load-bearing and carried over unchanged:
 *
 * - **The countdown is derived from a target timestamp**, not decremented. A
 *   `setInterval` that subtracts one per tick drifts, and is throttled to a
 *   crawl when the OS backgrounds the JS thread, so a 25-minute session would
 *   finish minutes late.
 * - **`AppState` resynchronises on foreground**, so returning to the app after
 *   the screen slept shows the real remaining time rather than the time when it
 *   went away.
 */
export function useFocusTimer() {
    const [mode, setMode] = useState<FocusMode>('focus');
    const [focusDuration, setFocusDuration] = useState(25 * 60);
    const [breakDuration, setBreakDuration] = useState(5 * 60);
    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [isRunning, setIsRunning] = useState(false);
    const [sessionsCompleted, setSessionsCompleted] = useState(0);
    /** The task this session was started from, if any. */
    const [taskTitle, setTaskTitle] = useState<string | null>(null);

    const targetEndRef = useRef<number | null>(null);

    const totalDuration = mode === 'focus' ? focusDuration : breakDuration;
    const progressPercent =
        totalDuration > 0 ? Math.min(100, Math.max(0, ((totalDuration - timeLeft) / totalDuration) * 100)) : 0;

    useEffect(() => {
        const onChange = (next: AppStateStatus) => {
            if (next === 'active' && isRunning && targetEndRef.current) {
                setTimeLeft(Math.max(0, Math.round((targetEndRef.current - Date.now()) / 1000)));
            }
        };
        const sub = AppState.addEventListener('change', onChange);
        return () => sub.remove();
    }, [isRunning]);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null;

        if (isRunning && timeLeft > 0) {
            if (!targetEndRef.current) targetEndRef.current = Date.now() + timeLeft * 1000;
            interval = setInterval(() => {
                if (targetEndRef.current) {
                    setTimeLeft(Math.max(0, Math.round((targetEndRef.current - Date.now()) / 1000)));
                } else {
                    setTimeLeft(prev => (prev <= 1 ? 0 : prev - 1));
                }
            }, 500);
        } else if (isRunning && timeLeft === 0) {
            setIsRunning(false);
            targetEndRef.current = null;
            triggerHaptic('success');
            if (mode === 'focus') {
                setSessionsCompleted(s => s + 1);
                AlertService.alert('Focus done!', 'Great job! Time for a short break to recharge.');
            } else {
                AlertService.alert('Break done!', 'Break is over! Ready to dive back in?');
            }
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isRunning, timeLeft, mode]);

    const toggle = useCallback(() => {
        triggerHaptic('medium');
        setTimeLeft(prev => {
            if (prev === 0) {
                const fresh = totalDuration > 0 ? totalDuration : mode === 'focus' ? 25 * 60 : 5 * 60;
                targetEndRef.current = Date.now() + fresh * 1000;
                setIsRunning(true);
                return fresh;
            }
            if (isRunning) {
                targetEndRef.current = null;
                setIsRunning(false);
            } else {
                targetEndRef.current = Date.now() + prev * 1000;
                setIsRunning(true);
            }
            return prev;
        });
    }, [isRunning, mode, totalDuration]);

    const reset = useCallback(() => {
        triggerHaptic('light');
        targetEndRef.current = null;
        setIsRunning(false);
        setTimeLeft(totalDuration);
    }, [totalDuration]);

    const switchMode = useCallback(
        (next: FocusMode) => {
            triggerHaptic('light');
            targetEndRef.current = null;
            setIsRunning(false);
            setMode(next);
            setTimeLeft(next === 'focus' ? focusDuration : breakDuration);
        },
        [focusDuration, breakDuration],
    );

    const setPreset = useCallback(
        (seconds: number) => {
            triggerHaptic('light');
            targetEndRef.current = null;
            setIsRunning(false);
            if (mode === 'focus') setFocusDuration(seconds);
            else setBreakDuration(seconds);
            setTimeLeft(seconds);
        },
        [mode],
    );

    const addFiveMinutes = useCallback(() => {
        triggerHaptic('light');
        if (targetEndRef.current) targetEndRef.current += 5 * 60 * 1000;
        setTimeLeft(prev => {
            const next = prev + 5 * 60;
            if (mode === 'focus') setFocusDuration(d => Math.max(d, next));
            else setBreakDuration(d => Math.max(d, next));
            return next;
        });
    }, [mode]);

    /** Starts a focus session attributed to one task. */
    const startForTask = useCallback(
        (title: string) => {
            targetEndRef.current = Date.now() + focusDuration * 1000;
            setTaskTitle(title);
            setMode('focus');
            setTimeLeft(focusDuration);
            setIsRunning(true);
            triggerHaptic('medium');
        },
        [focusDuration],
    );

    return {
        mode,
        timeLeft,
        isRunning,
        sessionsCompleted,
        progressPercent,
        focusDuration,
        breakDuration,
        totalDuration,
        taskTitle,
        setTaskTitle,
        toggle,
        reset,
        switchMode,
        setPreset,
        addFiveMinutes,
        startForTask,
    };
}

export type FocusTimer = ReturnType<typeof useFocusTimer>;
