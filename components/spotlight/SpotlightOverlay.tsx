import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    Pressable,
    TouchableOpacity,
    Animated,
    Easing,
    StyleSheet,
    useWindowDimensions,
    Platform,
    BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTheme, Typography, Radius } from '@/constants/Theme';
import { triggerHaptic } from '@/components/tasks/utils';
import {
    resolveTooltipLayout,
    highlightRadius,
    ARROW_SIZE,
    type Rect,
} from '@/utils/spotlightGeometry';
import type { SpotlightStep } from './types';

interface SpotlightOverlayProps {
    step: SpotlightStep;
    /** Already inflated by the provider; null while measuring or unanchored. */
    highlight: Rect | null;
    /** False while `highlight` still belongs to the previous step. */
    highlightReady: boolean;
    stepIndex: number;
    stepCount: number;
    onNext: () => void;
    onBack: () => void;
    onSkip: () => void;
}

/**
 * The scrim is drawn as four opaque panels inside a group that carries the
 * alpha. Opaque children can overlap at the corners without double-darkening
 * because the group is composited once and *then* faded — which is what lets
 * every panel be a fixed-size view moved by `translate` alone.
 */
const DIM_COLOR_LIGHT = '#0f172a';
const DIM_COLOR_DARK = '#020617';
const DIM_ALPHA_LIGHT = 0.72;
const DIM_ALPHA_DARK = 0.82;

const MOVE_DURATION = 280;
const CARD_OUT_DURATION = 120;
const CARD_IN_DURATION = 200;
/** Lets the spotlight nearly finish travelling before the card reappears. */
const CARD_IN_DELAY = 80;

interface Hole {
    x: number;
    y: number;
    w: number;
    h: number;
}

export default function SpotlightOverlay({
    step,
    highlight,
    highlightReady,
    stepIndex,
    stepCount,
    onNext,
    onBack,
    onSkip,
}: SpotlightOverlayProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const insets = useSafeAreaInsets();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();

    /**
     * Only the hole's *position* is animated, and only ever through
     * `translateX` / `translateY` so the whole scrim runs on the native driver.
     * Its size is plain layout that changes once per step, never per frame —
     * animating width/height would put a full layout pass on every frame, which
     * is what made the transition stutter.
     */
    const tx = useRef(new Animated.Value(screenWidth / 2)).current;
    const ty = useRef(new Animated.Value(screenHeight / 2)).current;
    const [hole, setHole] = useState<Hole>({ x: screenWidth / 2, y: screenHeight / 2, w: 0, h: 0 });
    const hasPositioned = useRef(false);

    const fade = useRef(new Animated.Value(0)).current;
    const cardOpacity = useRef(new Animated.Value(0)).current;
    const cardShift = useRef(new Animated.Value(10)).current;
    const cardTop = useRef(new Animated.Value(0)).current;
    const pulse = useRef(new Animated.Value(0)).current;

    /**
     * The step the card is currently showing. It lags behind `stepIndex` until
     * the outgoing card has faded out, so copy never swaps in front of the user
     * or paints at the previous control's position.
     */
    const [shown, setShown] = useState<{ step: SpotlightStep; index: number }>({ step, index: stepIndex });
    const [cardHeight, setCardHeight] = useState(190);
    /**
     * Safety net: if a measurement is slow the card still appears, and the
     * position effect slides it into place once the rect lands. The tour must
     * never sit there with an invisible card.
     */
    const [revealTimedOut, setRevealTimedOut] = useState(false);

    const isCurrent = shown.index === stepIndex;
    const isLast = shown.index === stepCount - 1;
    const isFirst = shown.index === 0;

    // Fade the whole overlay in once.
    useEffect(() => {
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }, []);

    // Android back dismisses the tour rather than navigating away behind it.
    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            onSkip();
            return true;
        });
        return () => sub.remove();
    }, [onSkip]);

    // Gentle breathing ring so the eye lands on the control.
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    toValue: 1,
                    duration: 1100,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(pulse, {
                    toValue: 0,
                    duration: 1100,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, []);

    // ─── Step transition, part 1: hide the outgoing card ──────────────────────
    useEffect(() => {
        if (isCurrent) return;
        let cancelled = false;
        Animated.parallel([
            Animated.timing(cardOpacity, {
                toValue: 0,
                duration: CARD_OUT_DURATION,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }),
            Animated.timing(cardShift, {
                toValue: -8,
                duration: CARD_OUT_DURATION,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }),
        ]).start(({ finished }) => {
            if (finished && !cancelled) setShown({ step, index: stepIndex });
        });
        return () => {
            cancelled = true;
        };
    }, [stepIndex, step, isCurrent]);

    // ─── Glide the spotlight to the new control ───────────────────────────────
    // An unanchored step collapses the hole to a point so the screen dims evenly.
    useEffect(() => {
        const next = highlight ?? { x: screenWidth / 2, y: screenHeight / 2, width: 0, height: 0 };
        setHole({ x: next.x, y: next.y, w: next.width, h: next.height });

        if (!hasPositioned.current) {
            // First step: appear in place rather than sweeping in from the centre.
            hasPositioned.current = true;
            tx.setValue(next.x);
            ty.setValue(next.y);
            return;
        }
        const config = {
            duration: MOVE_DURATION,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        } as const;
        const anim = Animated.parallel([
            Animated.timing(tx, { toValue: next.x, ...config }),
            Animated.timing(ty, { toValue: next.y, ...config }),
        ]);
        anim.start();
        return () => anim.stop();
    }, [highlight, screenWidth, screenHeight]);

    // Derived edges are memoised so a card re-render never rebuilds the node
    // graph underneath a running native animation.
    const rightEdge = useMemo(() => Animated.add(tx, hole.w), [tx, hole.w]);
    const bottomEdge = useMemo(() => Animated.add(ty, hole.h), [ty, hole.h]);
    const cardTranslate = useMemo(() => Animated.add(cardTop, cardShift), [cardTop, cardShift]);

    // Where the card belongs for the step it is currently showing.
    const layout = resolveTooltipLayout({
        target: highlight,
        screen: { width: screenWidth, height: screenHeight },
        insets,
        tooltipHeight: cardHeight,
    });

    // ─── Step transition, part 2: seat the card, then reveal it ───────────────
    // Position and opacity are deliberately owned by two separate effects. The
    // card measures itself, which changes `layout.top`; if that re-ran the
    // effect owning `cardOpacity` it would cancel the fade-in mid-flight and
    // strand the card at opacity 0.
    const canReveal = isCurrent && (highlightReady || revealTimedOut);

    useEffect(() => {
        setRevealTimedOut(false);
        const timer = setTimeout(() => setRevealTimedOut(true), 600);
        return () => clearTimeout(timer);
    }, [shown.index]);

    // Placement is read at reveal time without being a dependency.
    const placementRef = useRef(layout.placement);
    placementRef.current = layout.placement;

    const seatedFor = useRef<number | null>(null);
    useEffect(() => {
        if (!canReveal) return;
        if (seatedFor.current !== shown.index) {
            // First reveal of this step: snap into place while still invisible.
            seatedFor.current = shown.index;
            cardTop.setValue(layout.top);
            return;
        }
        // Already seated: a late height correction glides instead of jumping.
        const anim = Animated.timing(cardTop, {
            toValue: layout.top,
            duration: 160,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        });
        anim.start();
        return () => anim.stop();
    }, [canReveal, shown.index, layout.top]);

    useEffect(() => {
        if (!canReveal) return;
        cardShift.setValue(placementRef.current === 'above' ? 10 : -10);
        const anim = Animated.parallel([
            Animated.timing(cardOpacity, {
                toValue: 1,
                duration: CARD_IN_DURATION,
                delay: CARD_IN_DELAY,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.spring(cardShift, {
                toValue: 0,
                friction: 9,
                tension: 70,
                delay: CARD_IN_DELAY,
                useNativeDriver: true,
            }),
        ]);
        anim.start();
        return () => anim.stop();
    }, [canReveal, shown.index]);

    const radius = highlightRadius(
        { x: hole.x, y: hole.y, width: hole.w, height: hole.h },
        shown.step.shape || 'rect'
    );

    const handleAdvance = () => {
        triggerHaptic('light');
        onNext();
    };

    const panelBase = {
        position: 'absolute' as const,
        width: screenWidth,
        height: screenHeight,
        backgroundColor: isDark ? DIM_COLOR_DARK : DIM_COLOR_LIGHT,
    };

    return (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
            {/* Tapping anywhere in the dimmed area moves the tour along. */}
            <Pressable
                style={StyleSheet.absoluteFill}
                onPress={handleAdvance}
                accessibilityRole="button"
                accessibilityLabel="Continue the tour"
            >
                <View
                    pointerEvents="none"
                    needsOffscreenAlphaCompositing
                    style={[
                        StyleSheet.absoluteFill,
                        { opacity: isDark ? DIM_ALPHA_DARK : DIM_ALPHA_LIGHT },
                    ]}
                >
                    <Animated.View
                        style={[panelBase, { left: 0, top: -screenHeight, transform: [{ translateY: ty }] }]}
                    />
                    <Animated.View
                        style={[panelBase, { left: 0, top: 0, transform: [{ translateY: bottomEdge }] }]}
                    />
                    <Animated.View
                        style={[panelBase, { left: -screenWidth, top: 0, transform: [{ translateX: tx }] }]}
                    />
                    <Animated.View
                        style={[panelBase, { left: 0, top: 0, transform: [{ translateX: rightEdge }] }]}
                    />
                </View>
            </Pressable>

            {/* Spotlight ring */}
            {hole.w > 0 && hole.h > 0 && (
                <Animated.View
                    pointerEvents="none"
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: hole.w,
                        height: hole.h,
                        borderRadius: radius,
                        borderWidth: 2.5,
                        borderColor: isDark ? '#a5b4fc' : '#ffffff',
                        transform: [{ translateX: tx }, { translateY: ty }],
                    }}
                >
                    <Animated.View
                        style={{
                            position: 'absolute',
                            left: -6,
                            top: -6,
                            right: -6,
                            bottom: -6,
                            borderRadius: radius + 6,
                            borderWidth: 2,
                            borderColor: theme.primary,
                            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                            transform: [
                                { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
                            ],
                        }}
                    />
                </Animated.View>
            )}

            {/* Coaching card */}
            <Animated.View
                pointerEvents={canReveal ? 'auto' : 'none'}
                onLayout={(e) => {
                    const h = Math.round(e.nativeEvent.layout.height);
                    if (h > 0 && Math.abs(h - cardHeight) > 2) setCardHeight(h);
                }}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: layout.left,
                    width: layout.width,
                    opacity: cardOpacity,
                    transform: [{ translateY: cardTranslate }],
                }}
            >
                {/* Arrow pointing at the control */}
                {layout.arrowLeft !== null && layout.placement !== 'center' && (
                    <View
                        style={[
                            {
                                position: 'absolute',
                                left: layout.arrowLeft,
                                width: ARROW_SIZE,
                                height: ARROW_SIZE,
                                backgroundColor: theme.surface,
                                transform: [{ rotate: '45deg' }],
                                borderRadius: 3,
                            },
                            layout.placement === 'below'
                                ? { top: -ARROW_SIZE / 2 }
                                : { bottom: -ARROW_SIZE / 2 },
                        ]}
                    />
                )}

                <View
                    style={{
                        backgroundColor: theme.surface,
                        borderRadius: Radius['3xl'],
                        padding: 20,
                        borderWidth: 1,
                        borderColor: theme.cardBorder,
                        ...Platform.select({
                            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 24 },
                            android: { elevation: 14 },
                        }),
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                        <View
                            style={{
                                width: 34,
                                height: 34,
                                borderRadius: Radius.md,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: isDark ? 'rgba(129,140,248,0.18)' : '#eef2ff',
                                marginRight: 10,
                            }}
                        >
                            <Ionicons name={shown.step.icon || 'sparkles'} size={17} color={theme.primary} />
                        </View>
                        <Text style={{ ...Typography.subtitle, fontSize: 17, color: theme.text, flex: 1 }}>
                            {shown.step.title}
                        </Text>
                        <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.textTertiary }}>
                            {shown.index + 1}/{stepCount}
                        </Text>
                    </View>

                    <Text style={{ ...Typography.body, fontSize: 14, lineHeight: 20, color: theme.textSecondary }}>
                        {shown.step.body}
                    </Text>

                    {/* Progress pips */}
                    <View style={{ flexDirection: 'row', gap: 5, marginTop: 16, marginBottom: 16 }}>
                        {Array.from({ length: stepCount }).map((_, i) => (
                            <View
                                key={i}
                                style={{
                                    height: 4,
                                    flex: 1,
                                    borderRadius: 2,
                                    backgroundColor: i <= shown.index ? theme.primary : theme.surfaceSecondary,
                                }}
                            />
                        ))}
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity
                            onPress={() => { triggerHaptic('light'); onSkip(); }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityRole="button"
                            accessibilityLabel="Skip the tour"
                        >
                            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 13, color: theme.textTertiary }}>
                                Skip tour
                            </Text>
                        </TouchableOpacity>

                        <View style={{ flex: 1 }} />

                        {!isFirst && (
                            <TouchableOpacity
                                onPress={() => { triggerHaptic('light'); onBack(); }}
                                accessibilityRole="button"
                                style={{
                                    paddingHorizontal: 16,
                                    paddingVertical: 10,
                                    borderRadius: Radius.full,
                                    marginRight: 8,
                                    backgroundColor: theme.surfaceSecondary,
                                }}
                            >
                                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 13, color: theme.textSecondary }}>
                                    Back
                                </Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            onPress={handleAdvance}
                            accessibilityRole="button"
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: 20,
                                paddingVertical: 10,
                                borderRadius: Radius.full,
                                backgroundColor: theme.primary,
                            }}
                        >
                            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13, color: '#fff' }}>
                                {isLast ? 'Done' : 'Next'}
                            </Text>
                            <Ionicons
                                name={isLast ? 'checkmark' : 'arrow-forward'}
                                size={15}
                                color="#fff"
                                style={{ marginLeft: 6 }}
                            />
                        </TouchableOpacity>
                    </View>
                </View>
            </Animated.View>
        </Animated.View>
    );
}
