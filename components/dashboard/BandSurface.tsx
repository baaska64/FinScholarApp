import React, { useState } from 'react';
import { View, StyleProp, ViewStyle, useWindowDimensions } from 'react-native';
import HeroBackdrop from '@/components/dashboard/HeroBackdrop';

interface BandSurfaceProps {
    isDark: boolean;
    motif?: 'bubbles' | 'cards' | 'bars';
    curve?: number;
    slant?: number;
    style?: StyleProp<ViewStyle>;
    children: React.ReactNode;
}

/**
 * The brand band sized to whatever it holds.
 *
 * `HeroBackdrop` needs numbers, and a band whose content changes (a term with
 * or without dates, a subject with or without scores) cannot be given a fixed
 * height without either clipping or leaving a hole — so this measures itself
 * and redraws the backdrop at the measured height.
 */
export default function BandSurface({ isDark, motif, curve = 0, slant = 0, style, children }: BandSurfaceProps) {
    const { width } = useWindowDimensions();
    const [h, setH] = useState(0);

    return (
        <View
            style={style}
            onLayout={(e) => {
                const next = Math.round(e.nativeEvent.layout.height);
                if (next !== h) setH(next);
            }}
        >
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                {h > 0 && <HeroBackdrop width={width} height={h} curve={curve} slant={slant} motif={motif} isDark={isDark} />}
            </View>
            {children}
        </View>
    );
}
