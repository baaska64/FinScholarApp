import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import type { SpotlightStep, SpotlightTourOptions } from './types';
import type { Rect } from '@/utils/spotlightGeometry';
import { inflateRect, isMeasurableRect, SPOTLIGHT_PADDING } from '@/utils/spotlightGeometry';
import SpotlightOverlay from './SpotlightOverlay';
import { OnboardingService } from '@/services/OnboardingService';

type TargetRef = React.RefObject<View | null>;

interface SpotlightContextValue {
    registerTarget: (id: string, ref: TargetRef) => () => void;
    startTour: (steps: SpotlightStep[], options?: SpotlightTourOptions) => void;
    stopTour: () => void;
    isTourActive: boolean;
}

const noop = () => {};

const SpotlightContext = createContext<SpotlightContextValue>({
    registerTarget: () => noop,
    startTour: noop,
    stopTour: noop,
    isTourActive: false,
});

/** Safe to call outside the provider — every method becomes a no-op. */
export function useSpotlight(): SpotlightContextValue {
    return useContext(SpotlightContext);
}

/** How long we keep looking for a target that has not been laid out yet. */
const MEASURE_ATTEMPTS = 24;
const MEASURE_INTERVAL_MS = 110;

export default function SpotlightProvider({ children }: { children: React.ReactNode }) {
    const targets = useRef(new Map<string, TargetRef>()).current;
    const overlayRef = useRef<View>(null);

    const { width: screenWidth, height: screenHeight } = useWindowDimensions();

    const [steps, setSteps] = useState<SpotlightStep[]>([]);
    const [index, setIndex] = useState(0);
    const [rect, setRect] = useState<Rect | null>(null);
    // Which step the current rect belongs to. Until this matches the active
    // step we are still measuring, and the overlay keeps the card hidden so it
    // never paints new copy at the previous control's position.
    const [measuredFor, setMeasuredFor] = useState<SpotlightStep | null>(null);
    // Held in a ref rather than state: it is only read when a tour ends, and
    // reading it from a state updater would be a side effect.
    const tourKeyRef = useRef<string | undefined>(undefined);

    // Guards async measurement against a tour that ended while we were waiting.
    const runIdRef = useRef(0);

    const isTourActive = steps.length > 0;
    const step = isTourActive ? steps[index] : undefined;

    const registerTarget = useCallback(
        (id: string, ref: TargetRef) => {
            targets.set(id, ref);
            return () => {
                // Only drop the entry if it is still ours — a remount of the same
                // id elsewhere must not be unregistered by the old instance.
                if (targets.get(id) === ref) targets.delete(id);
            };
        },
        [targets]
    );

    const stopTour = useCallback(() => {
        runIdRef.current += 1;
        const key = tourKeyRef.current;
        tourKeyRef.current = undefined;
        setSteps([]);
        setIndex(0);
        setRect(null);
        setMeasuredFor(null);
        if (key) OnboardingService.markTourSeen(key);
    }, []);

    const startTour = useCallback(
        (nextSteps: SpotlightStep[], options?: SpotlightTourOptions) => {
            if (!nextSteps || nextSteps.length === 0) return;
            runIdRef.current += 1;
            tourKeyRef.current = options?.key;
            setRect(null);
            setMeasuredFor(null);
            setIndex(0);
            setSteps(nextSteps);
        },
        []
    );

    const goNext = useCallback(() => {
        setIndex((i) => {
            if (i + 1 >= steps.length) {
                // Defer so we are not calling setState on another component mid-render.
                setTimeout(stopTour, 0);
                return i;
            }
            return i + 1;
        });
    }, [steps.length, stopTour]);

    const goBack = useCallback(() => {
        setIndex((i) => Math.max(0, i - 1));
    }, []);

    // ─── Measure the current step's target ────────────────────────────────────
    useEffect(() => {
        if (!step) return;

        runIdRef.current += 1;
        const runId = runIdRef.current;
        let attempts = 0;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let cancelled = false;

        // The previous highlight stays put while we measure, so the spotlight
        // glides to the next control instead of blinking through a full dim.
        if (!step.targetId) {
            setRect(null);
            setMeasuredFor(step);
            return;
        }

        const attempt = () => {
            if (cancelled || runId !== runIdRef.current) return;
            attempts += 1;

            const targetRef = targets.get(step.targetId as string);
            const overlayNode = overlayRef.current;

            const retry = () => {
                if (attempts < MEASURE_ATTEMPTS) {
                    timer = setTimeout(attempt, MEASURE_INTERVAL_MS);
                } else {
                    // Control never appeared — show the step centred rather than
                    // leaving the previous control spotlit.
                    setRect(null);
                    setMeasuredFor(step);
                }
            };

            if (!targetRef?.current || !overlayNode) {
                retry();
                return;
            }

            // Measure both in window coordinates and subtract, so the highlight
            // lines up regardless of where the overlay sits in the view tree
            // (status bar insets, edge-to-edge, etc).
            overlayNode.measureInWindow((ox, oy) => {
                if (cancelled || runId !== runIdRef.current) return;
                targetRef.current?.measureInWindow((tx, ty, width, height) => {
                    if (cancelled || runId !== runIdRef.current) return;
                    const measured: Rect = { x: tx - ox, y: ty - oy, width, height };
                    if (!isMeasurableRect(measured)) {
                        retry();
                        return;
                    }
                    setRect(measured);
                    setMeasuredFor(step);
                });
            });
        };

        attempt();

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [step, targets]);

    const highlight = useMemo(() => {
        if (!isMeasurableRect(rect)) return null;
        return inflateRect(rect, SPOTLIGHT_PADDING, { width: screenWidth, height: screenHeight });
    }, [rect, screenWidth, screenHeight]);

    const value = useMemo<SpotlightContextValue>(
        () => ({ registerTarget, startTour, stopTour, isTourActive }),
        [registerTarget, startTour, stopTour, isTourActive]
    );

    return (
        <SpotlightContext.Provider value={value}>
            {children}
            <View
                ref={overlayRef}
                collapsable={false}
                style={StyleSheet.absoluteFill}
                pointerEvents={isTourActive ? 'auto' : 'box-none'}
            >
                {step && (
                    <SpotlightOverlay
                        step={step}
                        highlight={highlight}
                        stepIndex={index}
                        stepCount={steps.length}
                        highlightReady={measuredFor === step}
                        onNext={goNext}
                        onBack={goBack}
                        onSkip={stopTour}
                    />
                )}
            </View>
        </SpotlightContext.Provider>
    );
}
