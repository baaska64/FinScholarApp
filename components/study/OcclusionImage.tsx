import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, TouchableWithoutFeedback, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import Svg, { Rect, Ellipse } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { OcclusionData, OcclusionMask } from './types';
import { MaskState } from './occlusion';
import { getImageUri } from './imageStore';

/**
 * Mask colours, the same in both themes: they sit on a photograph, not on
 * the app's surface. Covered masks are a calm amber; the asked one is a
 * saturated coral so "which one am I being asked?" is never a question —
 * the thing Anki users most often add to their occlusion templates.
 */
export const MASK_COLORS = {
    covered: { fill: '#f6c667', stroke: '#b7851f' },
    target: { fill: '#f0706a', stroke: '#b3302a' },
    revealed: { stroke: '#16a34a' },
    chosen: { stroke: '#dc2626' },
};

/** Loads a stored image's uri. `undefined` while loading, `null` when it is not on this device. */
export function useStoredImage(id: string | undefined): string | null | undefined {
    const [uri, setUri] = useState<string | null | undefined>(undefined);
    useEffect(() => {
        let live = true;
        setUri(undefined);
        if (!id) {
            setUri(null);
            return;
        }
        getImageUri(id).then((u) => live && setUri(u));
        return () => {
            live = false;
        };
    }, [id]);
    return uri;
}

interface OcclusionImageProps {
    data: OcclusionData;
    states: Record<string, MaskState>;
    /** Show each revealed mask's label on the picture. */
    showLabels?: boolean;
    /** Locate cards: called with the tapped point in 0-1 image coordinates. */
    onPressPoint?: (x: number, y: number) => void;
    /** A mask the student picked on a locate card, outlined in red when wrong. */
    chosenId?: string | null;
    /** Caps the height so a tall diagram still leaves room for the buttons. */
    maxHeight?: number;
    style?: StyleProp<ViewStyle>;
    isDark: boolean;
}

export default function OcclusionImage({ data, states, showLabels, onPressPoint, chosenId, maxHeight, style, isDark }: OcclusionImageProps) {
    const uri = useStoredImage(data.imageId);
    const [box, setBox] = useState({ w: 0, h: 0 });
    const contentRef = useRef<View>(null);
    const ratio = data.width > 0 && data.height > 0 ? data.width / data.height : 4 / 3;

    // Fit inside the available width, and inside maxHeight when given.
    const width = box.w;
    let drawW = width;
    let drawH = width / ratio;
    if (maxHeight && drawH > maxHeight) {
        drawH = maxHeight;
        drawW = maxHeight * ratio;
    }

    const masks = data.masks || [];
    const labelled = showLabels ? masks.filter((m) => states[m.id] === 'revealed' && (m.label || '').trim()) : [];

    const content = (
        <View ref={contentRef} collapsable={false} style={{ width: drawW, height: drawH, alignSelf: 'center', borderRadius: 12, overflow: 'hidden', backgroundColor: isDark ? '#0d0e21' : '#e9ebf3' }}>
            {uri ? (
                <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="stretch" accessibilityIgnoresInvertColors />
            ) : uri === undefined ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator />
                </View>
            ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <Ionicons name="image-outline" size={26} color={isDark ? '#8a90b0' : '#646d87'} />
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: isDark ? '#c2c6dc' : '#525f78', textAlign: 'center', marginTop: 6 }}>
                        This picture is saved on the device it was added on.
                    </Text>
                </View>
            )}

            {drawW > 0 && (
                <Svg width={drawW} height={drawH} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
                    {masks.map((m) => {
                        const st = states[m.id];
                        const chosen = chosenId === m.id && st !== 'revealed';
                        if (st === 'open' && !chosen) return null;
                        const common = {
                            fill: st === 'covered' ? MASK_COLORS.covered.fill : st === 'target' ? MASK_COLORS.target.fill : 'transparent',
                            stroke: chosen ? MASK_COLORS.chosen.stroke : st === 'covered' ? MASK_COLORS.covered.stroke : st === 'target' ? MASK_COLORS.target.stroke : MASK_COLORS.revealed.stroke,
                            strokeWidth: st === 'revealed' || chosen ? 3 : 1.5,
                            vectorEffect: 'non-scaling-stroke' as const,
                        };
                        return m.shape === 'ellipse' ? (
                            <Ellipse key={m.id} {...common} cx={(m.x + m.w / 2) * 100} cy={(m.y + m.h / 2) * 100} rx={(m.w / 2) * 100} ry={(m.h / 2) * 100} />
                        ) : (
                            <Rect key={m.id} {...common} x={m.x * 100} y={m.y * 100} width={m.w * 100} height={m.h * 100} rx={1.2} ry={1.2 * ratio} />
                        );
                    })}
                </Svg>
            )}

            {labelled.map((m) => (
                <View
                    key={`l-${m.id}`}
                    pointerEvents="none"
                    style={{
                        position: 'absolute', left: `${(m.x + m.w / 2) * 100}%`, top: `${(m.y + m.h) * 100}%`,
                        transform: [{ translateX: -60 }], width: 120, alignItems: 'center', marginTop: 3,
                    }}
                >
                    <Text numberOfLines={2} style={{
                        fontFamily: 'Nunito_800ExtraBold', fontSize: 11.5, color: '#ffffff', textAlign: 'center',
                        backgroundColor: 'rgba(22,101,52,0.92)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden',
                    }}>
                        {m.label}
                    </Text>
                </View>
            ))}
        </View>
    );

    return (
        <View style={style} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
            {onPressPoint ? (
                <TouchableWithoutFeedback
                    accessibilityRole="imagebutton"
                    accessibilityLabel="Tap where it is on the picture"
                    onPress={(e) => {
                        if (drawW <= 0 || drawH <= 0) return;
                        const { locationX, locationY, pageX, pageY } = e.nativeEvent as any;
                        // Native gives the point within the picture directly.
                        // react-native-web leaves locationX/Y undefined on this
                        // event, so measure the picture and use page coordinates.
                        if (Number.isFinite(locationX) && Number.isFinite(locationY)) {
                            onPressPoint(locationX / drawW, locationY / drawH);
                            return;
                        }
                        contentRef.current?.measure((_x, _y, w, h, left, top) => {
                            if (w > 0 && h > 0) onPressPoint((pageX - left) / w, (pageY - top) / h);
                        });
                    }}
                >
                    {content}
                </TouchableWithoutFeedback>
            ) : (
                content
            )}
        </View>
    );
}

export type { OcclusionMask };
