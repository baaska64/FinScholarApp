import type { Ionicons } from '@expo/vector-icons';

export type SpotlightShape = 'rect' | 'circle' | 'pill';

export interface SpotlightStep {
    /** Stable id, unique within a tour. */
    id: string;
    /**
     * Id of the registered control to highlight. When the control is not on
     * screen the step still shows, centred and without a highlight, so a tour
     * never dead-ends on a conditionally rendered button.
     */
    targetId?: string;
    title: string;
    body: string;
    icon?: keyof typeof Ionicons.glyphMap;
    shape?: SpotlightShape;
}

export interface SpotlightTourOptions {
    /**
     * Persisted key. When set, finishing or skipping the tour records it so it
     * does not reappear on the next launch.
     */
    key?: string;
}
