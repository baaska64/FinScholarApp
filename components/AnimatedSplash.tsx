import React, { useEffect, useRef } from 'react';
import {
  View,
  Image,
  Text,
  Dimensions,
  StyleSheet,
  StatusBar,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  interpolate,
  interpolateColor,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface AnimatedSplashProps {
  onFinish: () => void;
  /**
   * Whether the app behind the splash is ready to show. The exit waits for
   * this: previously the splash faded itself out on a fixed 2.5s timer while
   * the root layout kept it mounted until fonts finished, so a slow load left
   * the user staring at an invisible splash over a blank screen.
   */
  ready?: boolean;
}

/** Floor for how long the splash stays up, so a fast boot doesn't flash it. */
const MIN_VISIBLE_MS = 1500;

export default function AnimatedSplash({ onFinish, ready = true }: AnimatedSplashProps) {
  const exitStarted = useRef(false);
  const introDoneAt = useRef(Date.now() + MIN_VISIBLE_MS);
  // ─── Shared values ────────────────────────────────────────────
  // The native splash already showed Fin on this exact indigo, so the mascot
  // starts on screen and only settles. Springing it from 0.3 / opacity 0 made
  // it blink out and pop back the instant the native splash handed over — the
  // same fault `app/welcome.tsx` fixed by springing its mascot from 0.94.
  const mascotScale = useSharedValue(0.94);
  const mascotOpacity = useSharedValue(1);
  const mascotFloat = useSharedValue(0);

  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(24);

  const subtitleOpacity = useSharedValue(0);
  const subtitleTranslateY = useSharedValue(16);

  const overallOpacity = useSharedValue(1);
  const overallScale = useSharedValue(1);
  const overallLift = useSharedValue(0);

  // Decorative blobs (matching welcome screen)
  const blob1Scale = useSharedValue(0.5);
  const blob2Scale = useSharedValue(0.4);
  const blob3Scale = useSharedValue(0.3);

  // Sparkle dots
  const sparkle1Opacity = useSharedValue(0);
  const sparkle2Opacity = useSharedValue(0);
  const sparkle3Opacity = useSharedValue(0);

  // Bottom accent bar
  const barWidth = useSharedValue(0);

  /**
   * 0 = the launch icon's blue, 1 = the app's indigo.
   *
   * The native splash paints `#3991f6` so the app icon's own background melts
   * into it — that is what makes the first frame look like the icon rather than
   * a logo pasted onto a coloured card. This screen therefore has to *start*
   * there, or the hand-off is a hard cut between two different blues. It cannot
   * simply stay there either: at 16px the subtitle only reaches ~2.3:1 on that
   * light blue, against ~4.4:1 on indigo. So it begins matched and settles into
   * the brand colour, which is both seamless and legible.
   */
  const bgMorph = useSharedValue(0);

  useEffect(() => {
    // ─── Step 1: Decorative blobs scale in (immediate) ──────────
    blob1Scale.value = withSpring(1, { damping: 8, stiffness: 40 });
    blob2Scale.value = withDelay(100, withSpring(1, { damping: 8, stiffness: 40 }));
    blob3Scale.value = withDelay(200, withSpring(1, { damping: 8, stiffness: 40 }));

    // ─── Step 1b: Ease off the icon's blue onto the brand indigo ─
    bgMorph.value = withDelay(180, withTiming(1, { duration: 520, easing: Easing.inOut(Easing.quad) }));

    // ─── Step 2: Mascot settles into place (no delay, no pop) ───
    mascotScale.value = withSpring(1, {
      damping: 12,
      stiffness: 120,
      mass: 0.9,
    });

    // ─── Step 3: Gentle float loop ──────────────────────────────
    setTimeout(() => {
      mascotFloat.value = withRepeat(
        withSequence(
          withTiming(-8, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
          withTiming(8, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    }, 500);

    // ─── Step 4: Title slides up (450ms) ────────────────────────
    titleOpacity.value = withDelay(380, withTiming(1, { duration: 340 }));
    titleTranslateY.value = withDelay(380, withSpring(0, { damping: 14, stiffness: 110 }));

    // ─── Step 5: Subtitle slides up (650ms) ─────────────────────
    subtitleOpacity.value = withDelay(540, withTiming(1, { duration: 300 }));
    subtitleTranslateY.value = withDelay(540, withSpring(0, { damping: 14, stiffness: 110 }));

    // ─── Step 6: Bottom accent bar slides in (800ms) ────────────
    barWidth.value = withDelay(660, withSpring(60, { damping: 12, stiffness: 80 }));

    // ─── Step 7: Sparkle twinkle loops ──────────────────────────
    sparkle1Opacity.value = withDelay(600, withRepeat(
      withSequence(
        withTiming(0.8, { duration: 800 }),
        withTiming(0.15, { duration: 800 }),
      ), -1, true,
    ));
    sparkle2Opacity.value = withDelay(900, withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1000 }),
        withTiming(0.1, { duration: 1000 }),
      ), -1, true,
    ));
    sparkle3Opacity.value = withDelay(750, withRepeat(
      withSequence(
        withTiming(0.9, { duration: 700 }),
        withTiming(0.2, { duration: 700 }),
      ), -1, true,
    ));

  }, []);

  // ─── Exit: as soon as the app is ready, never before the floor ────
  useEffect(() => {
    if (!ready || exitStarted.current) return;
    const wait = Math.max(0, introDoneAt.current - Date.now());
    const timeout = setTimeout(() => {
      if (exitStarted.current) return;
      exitStarted.current = true;
      // Lift and fade rather than zoom: the welcome screen shows the same
      // mascot in roughly the same place, so the splash should get out of
      // its way, not push toward the viewer.
      overallOpacity.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
      overallLift.value = withTiming(-26, { duration: 320, easing: Easing.out(Easing.cubic) });
      overallScale.value = withTiming(1.03, { duration: 320, easing: Easing.out(Easing.cubic) }, () => {
        runOnJS(onFinish)();
      });
    }, wait);
    return () => clearTimeout(timeout);
  }, [ready]);

  // ─── Animated styles ──────────────────────────────────────────
  const containerStyle = useAnimatedStyle(() => ({
    opacity: overallOpacity.value,
    // Overrides `styles.container`'s static fill; must stay in sync with the
    // `expo-splash-screen` backgroundColor in app.json at the 0 end.
    backgroundColor: interpolateColor(bgMorph.value, [0, 1], ['#3991f6', '#4f46e5']),
    transform: [{ translateY: overallLift.value }, { scale: overallScale.value }],
  }));

  const mascotStyle = useAnimatedStyle(() => ({
    opacity: mascotOpacity.value,
    transform: [
      { scale: mascotScale.value },
      { translateY: mascotFloat.value },
    ],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleTranslateY.value }],
  }));

  const blob1Style = useAnimatedStyle(() => ({
    transform: [{ scale: blob1Scale.value }],
    opacity: interpolate(blob1Scale.value, [0.5, 1], [0, 1]),
  }));
  const blob2Style = useAnimatedStyle(() => ({
    transform: [{ scale: blob2Scale.value }],
    opacity: interpolate(blob2Scale.value, [0.4, 1], [0, 1]),
  }));
  const blob3Style = useAnimatedStyle(() => ({
    transform: [{ scale: blob3Scale.value }],
    opacity: interpolate(blob3Scale.value, [0.3, 1], [0, 1]),
  }));

  const sparkle1Style = useAnimatedStyle(() => ({ opacity: sparkle1Opacity.value }));
  const sparkle2Style = useAnimatedStyle(() => ({ opacity: sparkle2Opacity.value }));
  const sparkle3Style = useAnimatedStyle(() => ({ opacity: sparkle3Opacity.value }));

  const barStyle = useAnimatedStyle(() => ({
    width: barWidth.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <StatusBar barStyle="light-content" />

      {/* ─── Background Blobs (matching welcome screen) ─── */}
      <Animated.View style={[styles.blob, styles.blob1, blob1Style]} />
      <Animated.View style={[styles.blob, styles.blob2, blob2Style]} />
      <Animated.View style={[styles.blob, styles.blob3, blob3Style]} />

      {/* ─── Sparkle Dots ─── */}
      <Animated.View style={[styles.sparkle, { top: SCREEN_H * 0.15, left: SCREEN_W * 0.18 }, sparkle1Style]} />
      <Animated.View style={[styles.sparkle, styles.sparkleSm, { top: SCREEN_H * 0.22, right: SCREEN_W * 0.15 }, sparkle2Style]} />
      <Animated.View style={[styles.sparkle, styles.sparkleMd, { top: SCREEN_H * 0.55, left: SCREEN_W * 0.12 }, sparkle3Style]} />

      {/* ─── Content ─── */}
      <View style={styles.content}>
        {/* Mascot — large and transparent, just like welcome screen */}
        <Animated.View style={mascotStyle}>
          <Image
            source={require('../assets/images/loginfin.png')}
            style={styles.mascot}
            resizeMode="contain"
          />
        </Animated.View>

        {/* App Name */}
        <Animated.View style={titleStyle}>
          <Text style={styles.title}>FinScholar</Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View style={subtitleStyle}>
          <Text style={styles.subtitle}>Your friendly academic companion 🐬</Text>
        </Animated.View>
      </View>

      {/* ─── Bottom Accent Bar ─── */}
      <View style={styles.bottomContainer}>
        <Animated.View style={[styles.accentBar, barStyle]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Decorative blobs (identical to welcome screen) ───────────
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blob1: {
    top: -70,
    left: -80,
    width: 180,
    height: 180,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  blob2: {
    top: 10,
    right: -60,
    width: 140,
    height: 140,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  blob3: {
    bottom: 80,
    left: -50,
    width: 90,
    height: 90,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  // ─── Sparkle dots ─────────────────────────────────────────────
  sparkle: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  sparkleSm: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  sparkleMd: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // ─── Content ──────────────────────────────────────────────────
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  mascot: {
    width: SCREEN_W * 0.7,
    height: SCREEN_W * 0.7,
  },
  title: {
    fontFamily: 'Nunito_900Black',
    fontSize: 38,
    color: '#ffffff',
    letterSpacing: -0.5,
    marginTop: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
    textAlign: 'center',
  },

  // ─── Bottom accent ────────────────────────────────────────────
  bottomContainer: {
    position: 'absolute',
    bottom: 50,
    width: '100%',
    alignItems: 'center',
  },
  accentBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
});
