import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface GoalRingProps {
    done: number;
    goal: number;
    /** Track colour — a translucent well when drawn on the brand band. */
    track: string;
    fill: string;
    ink: string;
    inkMuted: string;
    size?: number;
}

/**
 * Today's reviews against the daily goal, as a ring.
 *
 * The study band carries this where the dashboard carries a stat card: a ring
 * is the one shape the dashboard never uses, and the goal is the only headline
 * number with a natural "full" state.
 */
export default function GoalRing({ done, goal, track, fill, ink, inkMuted, size = 72 }: GoalRingProps) {
    const stroke = 7;
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const pct = goal > 0 ? Math.max(0, Math.min(1, done / goal)) : 0;

    return (
        <View
            style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
            accessible
            accessibilityLabel={`Daily goal: ${done} of ${goal} cards`}
        >
            <Svg width={size} height={size} style={{ position: 'absolute' }}>
                <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
                {pct > 0 && (
                    // Starts at 12 o'clock: SVG arcs begin at 3 o'clock, so rotate a quarter turn back.
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={r}
                        stroke={fill}
                        strokeWidth={stroke}
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${circ * pct} ${circ}`}
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    />
                )}
            </Svg>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: 'Nunito_900Black', fontSize: 15, color: ink, letterSpacing: -0.4, maxWidth: size - stroke * 2 - 6 }}>
                {Math.min(done, 999)}/{goal}
            </Text>
            <Text numberOfLines={1} style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 9, letterSpacing: 0.6, textTransform: 'uppercase', color: inkMuted, marginTop: -1 }}>
                Goal
            </Text>
        </View>
    );
}
