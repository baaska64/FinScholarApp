import React from 'react';
import { View, Text } from 'react-native';

export interface ScaleMark {
    /** Position on the 0-100 scale. */
    at: number;
    label: string;
    /** Draws the tick taller and the label bolder — the passing mark, a target. */
    strong?: boolean;
}

interface GradeScaleProps {
    /** 0-100, or null for no grades yet (no fill, no pin). */
    percent: number | null;
    marks: ScaleMark[];
    track: string;
    fill: string;
    /** Tick and label colour. */
    ink: string;
    inkMuted: string;
    /** Pin outline; the band colour under it, so the pin reads as cut out. */
    pinRing: string;
    accessibilityLabel?: string;
}

const LABEL_W = 56;

/**
 * A ruler, not a progress bar: the grade's position against labelled marks.
 *
 * The dashboard draws a progress bar and the study tab a ring; the grades tab
 * gets the one shape that says *where you stand relative to the lines that
 * matter* — the passing mark, your target, the tier boundaries. A bare bar
 * only says "how full".
 */
export default function GradeScale({ percent, marks, track, fill, ink, inkMuted, pinRing, accessibilityLabel }: GradeScaleProps) {
    const p = percent === null || !Number.isFinite(percent) ? null : Math.max(0, Math.min(100, percent));

    return (
        <View accessible accessibilityLabel={accessibilityLabel} style={{ paddingTop: 4 }}>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: track }}>
                {p !== null && <View style={{ width: `${p}%`, height: '100%', borderRadius: 4, backgroundColor: fill }} />}

                {marks.map((m) => (
                    <View
                        key={`${m.label}-${m.at}`}
                        style={{
                            position: 'absolute',
                            left: `${Math.max(0, Math.min(100, m.at))}%`,
                            top: m.strong ? -4 : -2,
                            bottom: m.strong ? -4 : -2,
                            width: 2,
                            marginLeft: -1,
                            borderRadius: 1,
                            backgroundColor: ink,
                            opacity: m.strong ? 0.95 : 0.55,
                        }}
                    />
                ))}

                {p !== null && (
                    <View
                        style={{
                            position: 'absolute',
                            left: `${p}%`,
                            top: -5,
                            width: 18,
                            height: 18,
                            marginLeft: -9,
                            borderRadius: 9,
                            backgroundColor: fill,
                            borderWidth: 3,
                            borderColor: pinRing,
                        }}
                    />
                )}
            </View>

            <View style={{ height: 18, marginTop: 7 }}>
                {marks.map((m) => (
                    <Text
                        key={`${m.label}-${m.at}-l`}
                        numberOfLines={1}
                        style={{
                            position: 'absolute',
                            left: `${Math.max(0, Math.min(100, m.at))}%`,
                            width: LABEL_W,
                            marginLeft: -LABEL_W / 2,
                            textAlign: 'center',
                            fontFamily: m.strong ? 'Nunito_800ExtraBold' : 'Nunito_700Bold',
                            fontSize: 10,
                            color: m.strong ? ink : inkMuted,
                        }}
                    >
                        {m.label}
                    </Text>
                ))}
            </View>
        </View>
    );
}
