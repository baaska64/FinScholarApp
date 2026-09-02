import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * OnboardingService
 *
 * Tracks whether a user has already been through the first-run experience so
 * existing installs are never interrupted by it. All flags are local-only —
 * onboarding works identically in guest mode and in signed-in mode.
 */

const ONBOARDING_KEY = '@onboarding_completed_v1';
const CHECKLIST_KEY = '@getting_started_dismissed_v1';
const NOTIF_CHOICE_KEY = '@notification_opt_in_v1';
const TOUR_KEY_PREFIX = '@tour_seen_v1_';
const LEDGER_KEY = 'grade_ledger_v2_data';

export type NotificationChoice = 'granted' | 'denied' | 'skipped' | null;

export const OnboardingService = {
    /** True once the user has finished (or explicitly skipped) the intro flow. */
    async isCompleted(): Promise<boolean> {
        try {
            return (await AsyncStorage.getItem(ONBOARDING_KEY)) === 'true';
        } catch {
            // If storage is unavailable, assume completed so we never trap the user.
            return true;
        }
    },

    async complete(): Promise<void> {
        try {
            await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
        } catch {}
    },

    /**
     * Marks an install that predates onboarding as already done. Upgrading
     * users get neither the intro nor the Getting Started checklist, since
     * they have been using the app for a while. Runs at most once — after the
     * flag is set this is a no-op, so restoring the checklist from Settings
     * sticks.
     */
    async markExistingUserOnboarded(tourKeys: string[] = []): Promise<void> {
        try {
            if ((await AsyncStorage.getItem(ONBOARDING_KEY)) === 'true') return;
            await AsyncStorage.multiSet([
                [ONBOARDING_KEY, 'true'],
                [CHECKLIST_KEY, 'true'],
                ...tourKeys.map((key) => [TOUR_KEY_PREFIX + key, 'true'] as [string, string]),
            ]);
        } catch {}
    },

    /** Lets the user replay the intro from Settings. */
    async reset(): Promise<void> {
        try {
            await AsyncStorage.removeItem(ONBOARDING_KEY);
        } catch {}
    },

    /**
     * A genuinely fresh install: the intro has never been finished AND there is
     * no local ledger yet. Upgrading users always have a ledger (or a session,
     * which the router checks separately) so they skip straight to the app.
     */
    async isFirstRun(): Promise<boolean> {
        try {
            if ((await AsyncStorage.getItem(ONBOARDING_KEY)) === 'true') return false;
            const ledger = await AsyncStorage.getItem(LEDGER_KEY);
            return !ledger;
        } catch {
            return false;
        }
    },

    // ─── Getting Started checklist ────────────────────────────────────────────

    async isChecklistDismissed(): Promise<boolean> {
        try {
            return (await AsyncStorage.getItem(CHECKLIST_KEY)) === 'true';
        } catch {
            return false;
        }
    },

    async dismissChecklist(): Promise<void> {
        try {
            await AsyncStorage.setItem(CHECKLIST_KEY, 'true');
        } catch {}
    },

    async restoreChecklist(): Promise<void> {
        try {
            await AsyncStorage.removeItem(CHECKLIST_KEY);
        } catch {}
    },

    // ─── Guided tours ─────────────────────────────────────────────────────────

    /** True once a tour has been finished or skipped. */
    async hasSeenTour(key: string): Promise<boolean> {
        try {
            return (await AsyncStorage.getItem(TOUR_KEY_PREFIX + key)) === 'true';
        } catch {
            // Never re-run a tour we cannot track — repeating it would be worse.
            return true;
        }
    },

    async markTourSeen(key: string): Promise<void> {
        try {
            await AsyncStorage.setItem(TOUR_KEY_PREFIX + key, 'true');
        } catch {}
    },

    /** Lets the user replay every tour from Settings. */
    async resetTours(keys: string[]): Promise<void> {
        try {
            await AsyncStorage.multiRemove(keys.map((key) => TOUR_KEY_PREFIX + key));
        } catch {}
    },

    // ─── Notification opt-in ──────────────────────────────────────────────────

    async getNotificationChoice(): Promise<NotificationChoice> {
        try {
            return (await AsyncStorage.getItem(NOTIF_CHOICE_KEY)) as NotificationChoice;
        } catch {
            return null;
        }
    },

    async setNotificationChoice(choice: Exclude<NotificationChoice, null>): Promise<void> {
        try {
            await AsyncStorage.setItem(NOTIF_CHOICE_KEY, choice);
        } catch {}
    },
};
