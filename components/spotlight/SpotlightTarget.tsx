import React, { useEffect, useRef } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { useSpotlight } from './SpotlightProvider';

interface SpotlightTargetProps {
    /**
     * Must match the `targetId` of a step in `constants/tours.ts`. Leave it
     * undefined on a shared component instance that should not be a target —
     * the wrapper still renders, it just does not register.
     */
    id?: string;
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

/**
 * Marks a control so the guided tour can find and highlight it. This is a
 * plain wrapper View — pass the layout style the child needs (e.g. flex: 1)
 * so wrapping does not change how the control sits in its row.
 *
 * `collapsable={false}` keeps the view in the native hierarchy on Android,
 * which is what makes it measurable.
 */
export default function SpotlightTarget({ id, children, style }: SpotlightTargetProps) {
    const { registerTarget } = useSpotlight();
    const ref = useRef<View>(null);

    useEffect(() => {
        if (!id) return;
        return registerTarget(id, ref);
    }, [id, registerTarget]);

    return (
        <View ref={ref} collapsable={false} style={style}>
            {children}
        </View>
    );
}
