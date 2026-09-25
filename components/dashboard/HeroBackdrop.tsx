import React from 'react';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Path, Circle, Rect } from 'react-native-svg';
import { getBrand } from '@/constants/Theme';

interface HeroBackdropProps {
    width: number;
    height: number;
    /**
     * How far the bottom edge sags at the centre, in dp. The band is the only
     * shape on the dashboard that is not a rounded rectangle — a shallow dome
     * is what stops the header reading as one more box stacked on the pile, and
     * it echoes the roundness of the icon it borrows its colour from.
     */
    curve?: number;
    /**
     * What floats in the glow. The dashboard gets Fin's bubbles; the study tab
     * gets a fanned stack of cards and the grades tab a rising bar chart, so the
     * bands share a colour without being the same picture.
     */
    motif?: 'bubbles' | 'cards' | 'bars';
    /**
     * Rise of a straight, slanted bottom edge from left to right, in dp. Used
     * instead of `curve` by the grades tab, so each tab's band ends in its own
     * shape: dome (dashboard), flat (study), slant (grades).
     */
    slant?: number;
    isDark: boolean;
}

/**
 * The brand band behind the dashboard header.
 *
 * Drawn in SVG rather than with `expo-linear-gradient` on purpose: the project
 * already ships `react-native-svg`, and a gradient, a sheen, the bubbles and
 * the curved edge are one flattened draw here instead of a stack of overlaid
 * views — and no new native module means no rebuild to see it.
 *
 * Purely decorative: it takes no children and reports nothing to accessibility.
 * Content is positioned over it by the caller.
 */
export default function HeroBackdrop({ width, height, curve = 22, motif = 'bubbles', slant = 0, isDark }: HeroBackdropProps) {
    const brand = getBrand(isDark);
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    const sag = Math.max(0, Math.min(curve, h - 1));
    const edge = h - sag;

    // A quadratic with its control point at (w/2, h + sag) passes through
    // exactly (w/2, h), so `sag` is the depth of the dome, not a control offset.
    const rise = Math.max(0, Math.min(slant, h - 1));
    const path = rise > 0
        ? `M0,0 H${w} V${h - rise} L0,${h} Z`
        : `M0,0 H${w} V${edge} Q${w / 2},${h + sag} 0,${edge} Z`;

    return (
        <Svg
            width={w}
            height={h}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
        >
            <Defs>
                {/* Strictly vertical. It was angled (x2=0.35), and in bounding-box
                    units on a band ~1.5x wider than tall that tilts the isolines
                    enough that the top-right corner starts ~30% of the way to
                    `heroTo` — a visible step under the flat app bar. The
                    off-centre glow below already supplies the asymmetry. */}
                <LinearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={brand.heroFrom} />
                    <Stop offset="1" stopColor={brand.heroTo} />
                </LinearGradient>
                {/*
                  Decoration lives in a narrow band between y=0.2h and y=0.65h,
                  and both edges of that window are load-bearing rather than
                  aesthetic.

                  Above it: the app bar is pinned and painted a flat `heroFrom`
                  while this scrolls under it, so the two only read as one
                  surface while the band's first rows are also flat `heroFrom`.
                  Nothing bright may go near y=0.

                  Below it: the stat card overlaps the bottom ~48dp, so a sheen
                  pooled at the curve is simply painted under the card — invisible
                  everywhere except as a sliver clipped by the card's edge, which
                  reads as a rendering artefact rather than as depth.
                */}
                <RadialGradient id="heroGlow" cx="0.84" cy="0.42" r="0.72">
                    <Stop offset="0" stopColor={brand.glow} stopOpacity={isDark ? 0.26 : 0.34} />
                    <Stop offset="1" stopColor={brand.glow} stopOpacity="0" />
                </RadialGradient>
            </Defs>

            <Path d={path} fill="url(#heroFill)" />
            <Path d={path} fill="url(#heroGlow)" />

            {motif === 'bars' ? (
                // Four rising bars, bottoms aligned at 0.64h so none reaches the
                // slanted edge or the flat strip under the app bar.
                [0.16, 0.24, 0.32, 0.42].map((frac, i) => {
                    const bw = 16;
                    const gap = 9;
                    const base = h * 0.64;
                    const bh = Math.min(h * frac, h * 0.44);
                    return (
                        <Rect
                            key={i}
                            x={w * 0.62 + i * (bw + gap)}
                            y={base - bh}
                            width={bw}
                            height={bh}
                            rx={5}
                            fill="#ffffff"
                            opacity={0.045 + i * 0.012}
                        />
                    );
                })
            ) : motif === 'cards' ? (
                // Three cards fanned from a common pivot, kept inside the same
                // 0.2h-0.65h window as the bubbles for the same reasons.
                [-16, -4, 8].map((deg, i) => {
                    const ch = Math.min(78, h * 0.4);
                    const cw = ch * 0.74;
                    const cx = w * 0.6;
                    const cy = h * 0.42;
                    return (
                        <Rect
                            key={deg}
                            x={cx - cw / 2}
                            y={cy - ch / 2}
                            width={cw}
                            height={ch}
                            rx={10}
                            fill="#ffffff"
                            opacity={0.04 + i * 0.015}
                            transform={`rotate(${deg} ${cx} ${cy + ch})`}
                        />
                    );
                })
            ) : (
                <>
                    {/* Bubbles. Fin is a dolphin; a few faint circles are enough to say so
                        without putting an illustration back at the top of the page. */}
                    <Circle cx={w * 0.88} cy={h * 0.3} r={34} fill="#ffffff" opacity={0.05} />
                    <Circle cx={w * 0.72} cy={h * 0.56} r={13} fill="#ffffff" opacity={0.055} />
                    <Circle cx={w * 0.96} cy={h * 0.62} r={20} fill="#ffffff" opacity={0.045} />
                </>
            )}
        </Svg>
    );
}
