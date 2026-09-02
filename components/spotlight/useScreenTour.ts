import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import type { SpotlightStep } from './types';
import { useSpotlight } from './SpotlightProvider';
import { OnboardingService } from '@/services/OnboardingService';

/**
 * Runs a short tour the first time a screen is opened, then never again.
 *
 * `ready` lets a screen wait until the control it wants to point at is
 * actually on screen (data loaded, empty state resolved). The tour is skipped
 * entirely for installs that predate onboarding, because
 * `markExistingUserOnboarded` marks every tour as already seen.
 */
export function useScreenTour(key: string, steps: SpotlightStep[], ready: boolean = true) {
    const { startTour, isTourActive } = useSpotlight();
    const attempted = useRef(false);
    const focused = useRef(false);

    useFocusEffect(
        useCallback(() => {
            focused.current = true;
            return () => {
                focused.current = false;
            };
        }, [])
    );

    useEffect(() => {
        if (attempted.current || !ready || isTourActive) return;

        let cancelled = false;
        // Small delay so the screen has settled and we are not fighting the
        // navigation transition for the measurement.
        const timer = setTimeout(async () => {
            if (cancelled || attempted.current) return;
            const seen = await OnboardingService.hasSeenTour(key);
            if (cancelled || seen || !focused.current) return;
            attempted.current = true;
            startTour(steps, { key });
        }, 700);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [key, steps, ready, isTourActive, startTour]);
}
