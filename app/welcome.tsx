import { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function WelcomeScreen() {
  const { colorScheme } = useColorScheme();
  
  // Force light mode
  const isDark = false;

  // ─── Colors ────────────────────────────────────────────────────────────
  const heroBg = isDark ? '#12103d' : '#4f46e5';
  const pageBg = isDark ? '#1a1f3d' : '#ffffff'; // Match cardBg to prevent ugly gaps at the bottom
  const cardBg = isDark ? '#1a1f3d' : '#ffffff';
  const cardBorder = isDark ? '#2d2f54' : '#e3e5f0';
  const textPrimary = isDark ? '#f1f2f9' : '#1e293b';
  const textSecondary = isDark ? '#c2c6dc' : '#525f78';
  const lip = isDark ? '#0d0e21' : '#d8dbea';

  // ─── Animations ────────────────────────────────────────────────────────
  const mascotFloat = useRef(new Animated.Value(0)).current;
  const mascotScale = useRef(new Animated.Value(0.94)).current;
  const titleFade = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(0)).current;
  const blob1 = useRef(new Animated.Value(0.5)).current;
  const blob2 = useRef(new Animated.Value(0.4)).current;
  const blob3 = useRef(new Animated.Value(0.3)).current;
  const sparkle1 = useRef(new Animated.Value(0)).current;
  const sparkle2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Settle, don't bounce: the splash just showed this mascot at full size,
    // so this is a continuation of that shot rather than a new entrance.
    Animated.spring(mascotScale, {
      toValue: 1, friction: 7, tension: 80, useNativeDriver: true,
    }).start();

    // Gentle float loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(mascotFloat, { toValue: -8, duration: 2000, useNativeDriver: true }),
        Animated.timing(mascotFloat, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    // Staggered entrance
    Animated.stagger(100, [
      Animated.spring(blob1, { toValue: 1, friction: 5, tension: 30, useNativeDriver: true }),
      Animated.spring(blob2, { toValue: 1, friction: 5, tension: 30, useNativeDriver: true }),
      Animated.spring(blob3, { toValue: 1, friction: 5, tension: 30, useNativeDriver: true }),
      Animated.spring(titleFade, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      Animated.spring(cardSlide, { toValue: 1, friction: 7, tension: 35, useNativeDriver: true }),
    ]).start();

    // Sparkle twinkle loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(sparkle1, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(sparkle1, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(sparkle2, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(sparkle2, { toValue: 0.2, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: pageBg }}>
      <StatusBar barStyle="light-content" />

      {/* ─── Theme Toggle Removed (Forced Light Mode) ─── */}

      {/* ═══════════════════════════════════════════════════════════════════
          HERO ZONE — Top 60% with mascot as the star
          ═══════════════════════════════════════════════════════════════════ */}
      <View
        style={{
          height: SCREEN_H * 0.58,
          backgroundColor: heroBg,
          overflow: 'visible', // Changed to visible so the graduation cap doesn't clip
        }}
      >
        {/* ─── Subtle Decorative Blobs (very faint, pushed to edges) ─── */}
        <Animated.View
          style={{
            position: 'absolute', top: -70, left: -80,
            width: 180, height: 180, borderRadius: 90,
            backgroundColor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.06)',
            transform: [{ scale: blob1 }],
          }}
        />
        <Animated.View
          style={{
            position: 'absolute', top: 10, right: -60,
            width: 140, height: 140, borderRadius: 70,
            backgroundColor: isDark ? 'rgba(124,58,237,0.06)' : 'rgba(255,255,255,0.04)',
            transform: [{ scale: blob2 }],
          }}
        />
        <Animated.View
          style={{
            position: 'absolute', bottom: 80, left: -50,
            width: 90, height: 90, borderRadius: 45,
            backgroundColor: isDark ? 'rgba(56,189,248,0.05)' : 'rgba(255,255,255,0.04)',
            transform: [{ scale: blob3 }],
          }}
        />

        {/* ─── Sparkle Dots ─── */}
        <Animated.View style={{ position: 'absolute', top: 100, left: 50, width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', opacity: sparkle1 }} />
        <Animated.View style={{ position: 'absolute', top: 80, right: 70, width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.2)', opacity: sparkle2 }} />

        {/* ─── Mascot + Title ─── */}
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: Platform.OS === 'ios' ? 80 : 70,
            paddingBottom: 50,
          }}
        >
          {/* Mascot — big and proud */}
          <Animated.View
            style={{
              transform: [
                { translateY: mascotFloat },
                { scale: mascotScale },
              ],
              marginBottom: 20,
            }}
          >
            <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center' }}>
              <Image
                source={require('../assets/images/loginfin.png')}
                style={{ width: SCREEN_W * 0.95, height: SCREEN_W * 0.95, position: 'absolute' }}
                resizeMode="contain"
              />
            </View>
          </Animated.View>

          {/* Title */}
          <Animated.View
            style={{
              opacity: titleFade,
              transform: [{ translateY: titleFade.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontFamily: 'Nunito_900Black',
                fontSize: 36,
                color: '#ffffff',
                letterSpacing: -0.5,
                textAlign: 'center',
              }}
            >
              FinScholar
            </Text>
            <Text
              style={{
                fontFamily: 'Nunito_600SemiBold',
                fontSize: 15,
                color: 'rgba(255,255,255,0.7)',
                marginTop: 6,
                textAlign: 'center',
              }}
            >
              Your friendly academic companion 🐬
            </Text>
          </Animated.View>
        </View>
      </View>

      {/* ═══════════════════════════════════════════════════════════════════
          BOTTOM ZONE — Welcome card with CTA buttons
          ═══════════════════════════════════════════════════════════════════ */}
      <Animated.View
        style={{
          flex: 1,
          marginTop: -36,
          opacity: cardSlide,
          transform: [{ translateY: cardSlide.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }],
        }}
      >
        <View
          style={{
            flex: 1,
            padding: 28,
            paddingHorizontal: 32,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            backgroundColor: cardBg,
            borderTopWidth: 1,
            borderLeftWidth: 0,
            borderRightWidth: 0,
            borderBottomWidth: 0,
            borderColor: cardBorder,
            ...Platform.select({
              ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: isDark ? 0.3 : 0.08, shadowRadius: 16 },
              android: { elevation: isDark ? 12 : 8 },
            }),
          }}
        >
          {/* Welcome heading */}
          <Text
            style={{
              fontFamily: 'Nunito_900Black',
              fontSize: 26,
              color: textPrimary,
              marginBottom: 8,
            }}
          >
            Welcome! 👋
          </Text>
          <Text
            style={{
              fontFamily: 'Nunito_400Regular',
              fontSize: 15,
              color: textSecondary,
              lineHeight: 22,
              marginBottom: 28,
            }}
          >
            Track your grades, manage tasks, and ace your semester — all in one place.
          </Text>

          {/* Sign In / Sign Up buttons side by side */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            {/* Sign In — Primary filled */}
            <TouchableOpacity
              style={{
                flex: 1, height: 54, borderRadius: 16,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: '#4f46e5',
                borderBottomWidth: 3,
                borderBottomColor: '#3730a3',
              }}
              onPress={() => router.push({ pathname: '/login', params: { mode: 'signin' } })}
              activeOpacity={0.85}
            >
              <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: '#ffffff' }}>
                Sign In
              </Text>
            </TouchableOpacity>

            {/* Sign Up — Outlined */}
            <TouchableOpacity
              style={{
                flex: 1, height: 54, borderRadius: 16,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: isDark ? 'rgba(129,140,248,0.10)' : '#eef0fe',
                borderWidth: 1.5,
                borderColor: isDark ? 'rgba(129,140,248,0.45)' : '#c7cbf7',
                borderBottomWidth: 3,
                borderBottomColor: isDark ? 'rgba(129,140,248,0.55)' : '#b3b8f2',
              }}
              onPress={() => router.push({ pathname: '/login', params: { mode: 'signup' } })}
              activeOpacity={0.85}
            >
              <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: '#4f46e5' }}>
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>

          {/* Guest access */}
          <TouchableOpacity
            style={{
              height: 52,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              borderRadius: 16,
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f4f5fb',
              borderWidth: 1,
              borderColor: cardBorder,
              borderBottomWidth: 2,
              borderBottomColor: lip,
            }}
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Continue without an account"
          >
            <Ionicons name="phone-portrait-outline" size={16} color={textSecondary} style={{ marginRight: 6 }} />
            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 14, color: textSecondary }}>
              Continue without an account
            </Text>
          </TouchableOpacity>

          <Text
            style={{
              fontFamily: 'Nunito_400Regular',
              fontSize: 12,
              color: textSecondary,
              textAlign: 'center',
              marginTop: 12,
              lineHeight: 17,
            }}
          >
            Everything works offline. Signing in later adds cloud backup — nothing you enter now is lost.
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
